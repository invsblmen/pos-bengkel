package httpserver

import (
	"database/sql"
	"encoding/json"
	"errors"
	"net/http"
	"strings"
	"time"
)

type serviceOrderUpdateStatusRequest struct {
	Status     string `json:"status"`
	OdometerKM *int64 `json:"odometer_km"`
	Notes      string `json:"notes"`
}

func serviceOrderUpdateStatusHandler(db *sql.DB) http.HandlerFunc {
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

		var payload serviceOrderUpdateStatusRequest
		if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
			writeJSON(w, http.StatusBadRequest, response{"message": "invalid json payload"})
			return
		}

		newStatus := strings.TrimSpace(payload.Status)
		if !serviceOrderStatusIsAllowed(newStatus) {
			writeJSON(w, http.StatusUnprocessableEntity, response{
				"message": "The given data was invalid.",
				"errors": response{
					"status": []string{"Status service order tidak valid."},
				},
			})
			return
		}

		if payload.OdometerKM != nil && *payload.OdometerKM < 0 {
			writeJSON(w, http.StatusUnprocessableEntity, response{
				"message": "The given data was invalid.",
				"errors": response{
					"odometer_km": []string{"Odometer (km) tidak valid."},
				},
			})
			return
		}

		var (
			oldStatus  string
			vehicleID  sql.NullInt64
			existingKM sql.NullInt64
		)

		err := db.QueryRow(`SELECT status, vehicle_id, odometer_km FROM service_orders WHERE id = ?`, orderID).Scan(&oldStatus, &vehicleID, &existingKM)
		if errors.Is(err, sql.ErrNoRows) {
			writeJSON(w, http.StatusNotFound, response{"message": "service order not found"})
			return
		}
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, response{"message": "failed to read service order"})
			return
		}

		if (newStatus == "completed" || newStatus == "paid") && !existingKM.Valid && payload.OdometerKM == nil {
			writeJSON(w, http.StatusUnprocessableEntity, response{
				"message": "The given data was invalid.",
				"errors": response{
					"odometer_km": []string{"Odometer (km) wajib diisi saat menyelesaikan atau menandai order sebagai dibayar."},
				},
			})
			return
		}

		if payload.OdometerKM != nil && vehicleID.Valid && vehicleID.Int64 > 0 {
			var prevKM sql.NullInt64
			err = db.QueryRow(`
				SELECT MAX(odometer_km)
				FROM service_orders
				WHERE vehicle_id = ? AND id != ? AND odometer_km IS NOT NULL
			`, vehicleID.Int64, orderID).Scan(&prevKM)
			if err != nil {
				writeJSON(w, http.StatusInternalServerError, response{"message": "failed to validate odometer"})
				return
			}

			if prevKM.Valid && *payload.OdometerKM < prevKM.Int64 {
				writeJSON(w, http.StatusUnprocessableEntity, response{
					"message": "The given data was invalid.",
					"errors": response{
						"odometer_km": []string{"Odometer tidak boleh kurang dari km sebelumnya."},
					},
				})
				return
			}
		}

		tx, err := db.Begin()
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, response{"message": "failed to update service order status"})
			return
		}

		rollback := true
		defer func() {
			if rollback {
				_ = tx.Rollback()
			}
		}()

		_, err = tx.Exec(`
			UPDATE service_orders
			SET status = ?, odometer_km = COALESCE(?, odometer_km), updated_at = ?
			WHERE id = ?
		`, newStatus, payload.OdometerKM, time.Now(), orderID)
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, response{"message": "failed to update service order status"})
			return
		}

		if serviceOrderStatusIsFinalized(newStatus) && !serviceOrderStatusIsFinalized(oldStatus) {
			if err := serviceOrderDeductInventoryOnFinalize(tx, orderID); err != nil {
				writeJSON(w, http.StatusInternalServerError, response{"message": "failed to deduct inventory"})
				return
			}
		}

		_, err = tx.Exec(`
			INSERT INTO service_order_status_histories (service_order_id, old_status, new_status, user_id, notes, created_at, updated_at)
			VALUES (?, ?, ?, ?, ?, ?, ?)
		`, orderID, oldStatus, newStatus, nil, serviceOrderStatusNullableString(payload.Notes), time.Now(), time.Now())
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, response{"message": "failed to write status history"})
			return
		}

		if err := tx.Commit(); err != nil {
			writeJSON(w, http.StatusInternalServerError, response{"message": "failed to update service order status"})
			return
		}
		rollback = false

		finalKM := any(nil)
		if payload.OdometerKM != nil {
			finalKM = *payload.OdometerKM
		} else if existingKM.Valid {
			finalKM = existingKM.Int64
		}

		writeJSON(w, http.StatusOK, response{
			"message": "Status updated.",
			"order": response{
				"id":          orderID,
				"status":      newStatus,
				"odometer_km": finalKM,
			},
		})
	}
}

func serviceOrderStatusIsAllowed(status string) bool {
	switch status {
	case "pending", "in_progress", "completed", "paid", "cancelled":
		return true
	default:
		return false
	}
}

func serviceOrderStatusIsFinalized(status string) bool {
	return status == "completed" || status == "paid"
}

func serviceOrderStatusNullableString(value string) any {
	trimmed := strings.TrimSpace(value)
	if trimmed == "" {
		return nil
	}
	return trimmed
}

func serviceOrderDeductInventoryOnFinalize(tx *sql.Tx, orderID int64) error {
	rows, err := tx.Query(`SELECT part_id, qty FROM service_order_details WHERE service_order_id = ? AND part_id IS NOT NULL`, orderID)
	if err != nil {
		return err
	}
	defer rows.Close()

	for rows.Next() {
		var partID sql.NullInt64
		var qty int64
		if err := rows.Scan(&partID, &qty); err != nil {
			return err
		}

		if !partID.Valid || partID.Int64 <= 0 || qty <= 0 {
			continue
		}

		if _, err := tx.Exec(`UPDATE parts SET current_stock = current_stock - ?, updated_at = ? WHERE id = ?`, qty, time.Now(), partID.Int64); err != nil {
			return err
		}
	}

	return rows.Err()
}