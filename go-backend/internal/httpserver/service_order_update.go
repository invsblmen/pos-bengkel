package httpserver

import (
	"database/sql"
	"encoding/json"
	"errors"
	"net/http"
	"strings"
	"time"
)

type serviceOrderUpdateRequest struct {
	CustomerID       *int64                   `json:"customer_id"`
	VehicleID        *int64                   `json:"vehicle_id"`
	MechanicID       *int64                   `json:"mechanic_id"`
	OdometerKM       *int64                   `json:"odometer_km"`
	EstimatedStartAt string                   `json:"estimated_start_at"`
	EstimatedEndAt   string                   `json:"estimated_finish_at"`
	LaborCost        *int64                   `json:"labor_cost"`
	Notes            string                   `json:"notes"`
	MaintenanceType  string                   `json:"maintenance_type"`
	NextServiceKM    *int64                   `json:"next_service_km"`
	NextServiceDate  string                   `json:"next_service_date"`
	DiscountType     string                   `json:"discount_type"`
	DiscountValue    any                      `json:"discount_value"`
	TaxType          string                   `json:"tax_type"`
	TaxValue         any                      `json:"tax_value"`
	VoucherCode      string                   `json:"voucher_code"`
	Items            []serviceOrderUpdateItem `json:"items"`
}

type serviceOrderUpdateItem struct {
	ServiceID *int64                    `json:"service_id"`
	Parts     []serviceOrderUpdatePart  `json:"parts"`
}

type serviceOrderUpdatePart struct {
	PartID        *int64 `json:"part_id"`
	Qty           int64  `json:"qty"`
	Price         int64  `json:"price"`
	DiscountType  string `json:"discount_type"`
	DiscountValue any    `json:"discount_value"`
}

func serviceOrderUpdateHandler(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if db == nil {
			writeJSON(w, http.StatusServiceUnavailable, response{"message": "database is not configured"})
			return
		}

		idRaw := strings.TrimSpace(r.PathValue("id"))
		if idRaw == "" {
			writeJSON(w, http.StatusBadRequest, response{"message": "service order id is required"})
			return
		}

		orderID := parseInt64WithDefault(idRaw)
		if orderID <= 0 {
			writeJSON(w, http.StatusBadRequest, response{"message": "service order id is required"})
			return
		}

		var payload serviceOrderUpdateRequest
		if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
			writeJSON(w, http.StatusBadRequest, response{"message": "invalid json payload"})
			return
		}

		if len(payload.Items) == 0 {
			writeJSON(w, http.StatusUnprocessableEntity, response{
				"message": "The given data was invalid.",
				"errors": response{"items": []string{"Minimal harus ada 1 item."}},
			})
			return
		}

		var existingLaborCost sql.NullInt64
		err := db.QueryRow(`SELECT labor_cost FROM service_orders WHERE id = ?`, orderID).Scan(&existingLaborCost)
		if errors.Is(err, sql.ErrNoRows) {
			writeJSON(w, http.StatusNotFound, response{"message": "service order not found"})
			return
		}
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, response{"message": "failed to read service order"})
			return
		}

		tx, err := db.Begin()
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, response{"message": "failed to update service order"})
			return
		}

		rollback := true
		defer func() {
			if rollback {
				_ = tx.Rollback()
			}
		}()

		_, err = tx.Exec(`
			UPDATE service_orders SET
				customer_id = ?, vehicle_id = ?, mechanic_id = ?, odometer_km = ?,
				estimated_start_at = ?, estimated_finish_at = ?, labor_cost = ?,
				notes = ?, maintenance_type = ?, next_service_km = ?, next_service_date = ?,
				discount_type = ?, discount_value = ?, tax_type = ?, tax_value = ?,
				voucher_id = NULL, voucher_code = ?, voucher_discount_amount = 0,
				updated_at = ?
			WHERE id = ?
		`,
			payload.CustomerID,
			payload.VehicleID,
			payload.MechanicID,
			payload.OdometerKM,
			serviceOrderUpdateNullableDateTime(payload.EstimatedStartAt),
			serviceOrderUpdateNullableDateTime(payload.EstimatedEndAt),
			serviceOrderUpdateInt64WithFallback(payload.LaborCost, existingLaborCost),
			serviceOrderStatusNullableString(payload.Notes),
			serviceOrderStatusNullableString(payload.MaintenanceType),
			payload.NextServiceKM,
			serviceOrderUpdateNullableDate(payload.NextServiceDate),
			serviceOrderStoreEnumOrDefault(payload.DiscountType, "none"),
			serviceOrderStoreFloatOrDefault(payload.DiscountValue, 0),
			serviceOrderStoreEnumOrDefault(payload.TaxType, "none"),
			serviceOrderStoreFloatOrDefault(payload.TaxValue, 0),
			serviceOrderStatusNullableString(payload.VoucherCode),
			time.Now(),
			orderID,
		)
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, response{"message": "failed to update service order"})
			return
		}

		if _, err := tx.Exec(`DELETE FROM service_order_details WHERE service_order_id = ?`, orderID); err != nil {
			writeJSON(w, http.StatusInternalServerError, response{"message": "failed to replace service order details"})
			return
		}

		now := time.Now()
		for _, item := range payload.Items {
			if item.ServiceID != nil && *item.ServiceID > 0 {
				if _, err := tx.Exec(`
					INSERT INTO service_order_details (
						service_order_id, service_id, part_id, qty, price,
						amount, base_amount, auto_discount_amount, auto_discount_notes,
						discount_type, discount_value, discount_amount,
						final_amount, incentive_percentage, incentive_amount,
						created_at, updated_at
					)
					VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
				`, orderID, item.ServiceID, nil, 1, 0, 0, 0, 0, nil, "none", 0, 0, 0, 0, 0, now, now); err != nil {
					writeJSON(w, http.StatusInternalServerError, response{"message": "failed to replace service order details"})
					return
				}
			}

			for _, part := range item.Parts {
				if part.Qty <= 0 {
					continue
				}
				amount := part.Qty * part.Price
				if _, err := tx.Exec(`
					INSERT INTO service_order_details (
						service_order_id, service_id, part_id, qty, price,
						amount, base_amount, auto_discount_amount, auto_discount_notes,
						discount_type, discount_value, discount_amount,
						final_amount, incentive_percentage, incentive_amount,
						created_at, updated_at
					)
					VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
				`, orderID, nil, part.PartID, part.Qty, part.Price, amount, amount, 0, nil, serviceOrderStoreEnumOrDefault(part.DiscountType, "none"), serviceOrderStoreFloatOrDefault(part.DiscountValue, 0), 0, amount, 0, 0, now, now); err != nil {
					writeJSON(w, http.StatusInternalServerError, response{"message": "failed to replace service order details"})
					return
				}
			}
		}

		if err := tx.Commit(); err != nil {
			writeJSON(w, http.StatusInternalServerError, response{"message": "failed to update service order"})
			return
		}
		rollback = false

		writeJSON(w, http.StatusOK, response{
			"message": "Service order updated.",
			"order": response{
				"id": orderID,
			},
		})
	}
}

func serviceOrderUpdateNullableDateTime(value string) any {
	trimmed := strings.TrimSpace(value)
	if trimmed == "" {
		return nil
	}
	return trimmed
}

func serviceOrderUpdateNullableDate(value string) any {
	trimmed := strings.TrimSpace(value)
	if trimmed == "" {
		return nil
	}
	return trimmed
}

func serviceOrderUpdateInt64WithFallback(value *int64, fallback sql.NullInt64) any {
	if value != nil {
		return *value
	}
	if fallback.Valid {
		return fallback.Int64
	}
	return int64(0)
}