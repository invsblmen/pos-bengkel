package httpserver

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"net/http"
	"strconv"
	"strings"
	"time"
)

type serviceOrderStoreRequest struct {
	SubmissionToken  string                  `json:"submission_token"`
	CustomerID       *int64                  `json:"customer_id"`
	VehicleID        *int64                  `json:"vehicle_id"`
	MechanicID       *int64                  `json:"mechanic_id"`
	Status           string                  `json:"status"`
	OdometerKM       *int64                  `json:"odometer_km"`
	EstimatedStartAt string                  `json:"estimated_start_at"`
	EstimatedEndAt   string                  `json:"estimated_finish_at"`
	LaborCost        *int64                  `json:"labor_cost"`
	Notes            string                  `json:"notes"`
	MaintenanceType  string                  `json:"maintenance_type"`
	NextServiceKM    *int64                  `json:"next_service_km"`
	NextServiceDate  string                  `json:"next_service_date"`
	DiscountType     string                  `json:"discount_type"`
	DiscountValue    any                     `json:"discount_value"`
	TaxType          string                  `json:"tax_type"`
	TaxValue         any                     `json:"tax_value"`
	VoucherCode      string                  `json:"voucher_code"`
	Items            []serviceOrderStoreItem `json:"items"`
}

type serviceOrderStoreItem struct {
	ServiceID *int64                   `json:"service_id"`
	Parts     []serviceOrderStorePart  `json:"parts"`
}

type serviceOrderStorePart struct {
	PartID        *int64 `json:"part_id"`
	Qty           int64  `json:"qty"`
	Price         int64  `json:"price"`
	DiscountType  string `json:"discount_type"`
	DiscountValue any    `json:"discount_value"`
}

func serviceOrderStoreHandler(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if db == nil {
			writeJSON(w, http.StatusServiceUnavailable, response{"message": "database is not configured"})
			return
		}

		var payload serviceOrderStoreRequest
		if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
			writeJSON(w, http.StatusBadRequest, response{"message": "invalid json payload"})
			return
		}

		if strings.TrimSpace(payload.SubmissionToken) == "" {
			writeJSON(w, http.StatusUnprocessableEntity, response{
				"message": "The given data was invalid.",
				"errors": response{"submission_token": []string{"Submission token wajib diisi."}},
			})
			return
		}

		if payload.OdometerKM == nil || *payload.OdometerKM < 0 {
			writeJSON(w, http.StatusUnprocessableEntity, response{
				"message": "The given data was invalid.",
				"errors": response{"odometer_km": []string{"Odometer (km) wajib diisi dengan nilai valid."}},
			})
			return
		}

		if len(payload.Items) == 0 {
			writeJSON(w, http.StatusUnprocessableEntity, response{
				"message": "The given data was invalid.",
				"errors": response{"items": []string{"Minimal harus ada 1 item."}},
			})
			return
		}

		status := strings.TrimSpace(payload.Status)
		if status == "" {
			status = "pending"
		}
		if !serviceOrderStatusIsAllowed(status) {
			writeJSON(w, http.StatusUnprocessableEntity, response{
				"message": "The given data was invalid.",
				"errors": response{"status": []string{"Status service order tidak valid."}},
			})
			return
		}

		now := time.Now()
		orderNumber := fmt.Sprintf("SO-%08X", uint32(now.UnixNano()))

		tx, err := db.Begin()
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, response{"message": "failed to create service order"})
			return
		}

		rollback := true
		defer func() {
			if rollback {
				_ = tx.Rollback()
			}
		}()

		result, err := tx.Exec(`
			INSERT INTO service_orders (
				order_number, customer_id, vehicle_id, mechanic_id, status,
				odometer_km, estimated_start_at, estimated_finish_at,
				total, notes, maintenance_type, next_service_km, next_service_date,
				labor_cost, material_cost,
				discount_type, discount_value, discount_amount,
				tax_type, tax_value, tax_amount, grand_total,
				voucher_id, voucher_code, voucher_discount_amount,
				created_at, updated_at
			)
			VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
		`,
			orderNumber,
			payload.CustomerID,
			payload.VehicleID,
			payload.MechanicID,
			status,
			payload.OdometerKM,
			serviceOrderStoreNullableDateTime(payload.EstimatedStartAt),
			serviceOrderStoreNullableDateTime(payload.EstimatedEndAt),
			int64(0),
			serviceOrderStatusNullableString(payload.Notes),
			serviceOrderStatusNullableString(payload.MaintenanceType),
			payload.NextServiceKM,
			serviceOrderStoreNullableDate(payload.NextServiceDate),
			serviceOrderStoreInt64OrDefault(payload.LaborCost, 0),
			int64(0),
			serviceOrderStoreEnumOrDefault(payload.DiscountType, "none"),
			serviceOrderStoreFloatOrDefault(payload.DiscountValue, 0),
			int64(0),
			serviceOrderStoreEnumOrDefault(payload.TaxType, "none"),
			serviceOrderStoreFloatOrDefault(payload.TaxValue, 0),
			int64(0),
			int64(0),
			nil,
			serviceOrderStatusNullableString(payload.VoucherCode),
			int64(0),
			now,
			now,
		)
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, response{"message": "failed to create service order"})
			return
		}

		orderID, err := result.LastInsertId()
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, response{"message": "failed to read created service order id"})
			return
		}

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
					writeJSON(w, http.StatusInternalServerError, response{"message": "failed to create service order detail"})
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
					writeJSON(w, http.StatusInternalServerError, response{"message": "failed to create service order detail"})
					return
				}
			}
		}

		if err := tx.Commit(); err != nil {
			writeJSON(w, http.StatusInternalServerError, response{"message": "failed to create service order"})
			return
		}
		rollback = false

		writeJSON(w, http.StatusOK, response{
			"message": "Service order created.",
			"order": response{
				"id":           orderID,
				"order_number": orderNumber,
				"status":       status,
			},
		})
	}
}

func serviceOrderStoreNullableDateTime(value string) any {
	trimmed := strings.TrimSpace(value)
	if trimmed == "" {
		return nil
	}
	return trimmed
}

func serviceOrderStoreNullableDate(value string) any {
	trimmed := strings.TrimSpace(value)
	if trimmed == "" {
		return nil
	}
	return trimmed
}

func serviceOrderStoreInt64OrDefault(value *int64, fallback int64) int64 {
	if value == nil {
		return fallback
	}
	return *value
}

func serviceOrderStoreFloatOrDefault(value any, fallback float64) float64 {
	if value == nil {
		return fallback
	}

	switch v := value.(type) {
	case float64:
		return v
	case int64:
		return float64(v)
	case int:
		return float64(v)
	case string:
		trimmed := strings.TrimSpace(v)
		if trimmed == "" {
			return fallback
		}
		parsed, err := strconv.ParseFloat(trimmed, 64)
		if err != nil {
			return fallback
		}
		return parsed
	default:
		return fallback
	}
}

func serviceOrderStoreEnumOrDefault(value string, fallback string) string {
	trimmed := strings.TrimSpace(value)
	if trimmed == "" {
		return fallback
	}
	return trimmed
}
