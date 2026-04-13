package httpserver

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
	"time"

	"posbengkel/go-backend/internal/events"
)

type partPurchaseUpdateStatusRequest struct {
	Status             string `json:"status"`
	ActualDeliveryDate string `json:"actual_delivery_date"`
	ActorUserID        *int64 `json:"actor_user_id"`
}

func partPurchaseUpdateStatusHandler(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if db == nil {
			writeJSON(w, http.StatusServiceUnavailable, response{"message": "database is not configured"})
			return
		}

		purchaseID := strings.TrimSpace(r.PathValue("id"))
		if purchaseID == "" {
			writeJSON(w, http.StatusBadRequest, response{"message": "part purchase id is required"})
			return
		}

		purchaseIntID := parseInt64WithDefault(purchaseID)
		if purchaseIntID <= 0 {
			writeJSON(w, http.StatusBadRequest, response{"message": "part purchase id is required"})
			return
		}

		var payload partPurchaseUpdateStatusRequest
		if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
			writeJSON(w, http.StatusBadRequest, response{"message": "invalid json payload"})
			return
		}

		payload.Status = strings.TrimSpace(payload.Status)
		if payload.Status != "pending" && payload.Status != "ordered" && payload.Status != "received" && payload.Status != "cancelled" {
			writeJSON(w, http.StatusUnprocessableEntity, response{
				"message": "The given data was invalid.",
				"errors": response{
					"status": []string{"The selected status is invalid."},
				},
			})
			return
		}

		var actualDeliveryAt *time.Time
		if strings.TrimSpace(payload.ActualDeliveryDate) != "" {
			parsed, err := time.ParseInLocation("2006-01-02", strings.TrimSpace(payload.ActualDeliveryDate), time.Local)
			if err != nil {
				writeJSON(w, http.StatusUnprocessableEntity, response{
					"message": "The given data was invalid.",
					"errors": response{
						"actual_delivery_date": []string{"The actual delivery date is not a valid date."},
					},
				})
				return
			}
			actualDeliveryAt = &parsed
		}

		tx, err := db.BeginTx(r.Context(), nil)
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, response{"message": "failed to start transaction"})
			return
		}
		defer func() { _ = tx.Rollback() }()
		now := time.Now()

		var oldStatus string
		var supplierID sql.NullInt64
		var purchaseNumber sql.NullString
		if err := tx.QueryRow(`
			SELECT status, supplier_id, purchase_number
			FROM part_purchases
			WHERE id = ?
			LIMIT 1
		`, purchaseIntID).Scan(&oldStatus, &supplierID, &purchaseNumber); err != nil {
			if err == sql.ErrNoRows {
				writeJSON(w, http.StatusNotFound, response{"message": "Purchase not found."})
				return
			}

			writeJSON(w, http.StatusInternalServerError, response{"message": "failed to read purchase"})
			return
		}

		if payload.Status == "received" && actualDeliveryAt != nil {
			if _, err := tx.Exec(`UPDATE part_purchases SET status = ?, actual_delivery_date = ?, updated_at = ? WHERE id = ?`, payload.Status, actualDeliveryAt.Format("2006-01-02"), now, purchaseIntID); err != nil {
				writeJSON(w, http.StatusInternalServerError, response{"message": "failed to update purchase status"})
				return
			}
		} else {
			if _, err := tx.Exec(`UPDATE part_purchases SET status = ?, updated_at = ? WHERE id = ?`, payload.Status, now, purchaseIntID); err != nil {
				writeJSON(w, http.StatusInternalServerError, response{"message": "failed to update purchase status"})
				return
			}
		}

		if payload.Status == "received" && oldStatus != "received" {
			supplierName := "Unknown Supplier"
			if supplierID.Valid {
				var supplierNameDB sql.NullString
				if err := tx.QueryRow(`SELECT name FROM suppliers WHERE id = ? LIMIT 1`, supplierID.Int64).Scan(&supplierNameDB); err == nil && supplierNameDB.Valid {
					supplierName = supplierNameDB.String
				}
			}

			rows, err := tx.Query(`
				SELECT ppd.part_id, ppd.quantity, ppd.unit_price, COALESCE(ppd.discount_type, 'none'), COALESCE(ppd.discount_value, 0), COALESCE(p.stock, 0)
				FROM part_purchase_details ppd
				JOIN parts p ON p.id = ppd.part_id
				WHERE ppd.part_purchase_id = ?
			`, purchaseIntID)
			if err != nil {
				writeJSON(w, http.StatusInternalServerError, response{"message": "failed to read purchase details"})
				return
			}
			defer rows.Close()

			for rows.Next() {
				var partID int64
				var quantity int64
				var unitPrice int64
				var discountType string
				var discountValue float64
				var beforeStock int64

				if err := rows.Scan(&partID, &quantity, &unitPrice, &discountType, &discountValue, &beforeStock); err != nil {
					writeJSON(w, http.StatusInternalServerError, response{"message": "failed to read purchase details"})
					return
				}

				priceAfterDiscount := applyDiscountTaxServiceStyle(unitPrice, discountType, discountValue)
				afterStock := beforeStock + quantity

				if _, err := tx.Exec(`UPDATE parts SET stock = ?, buy_price = ?, updated_at = ? WHERE id = ?`, afterStock, priceAfterDiscount, now, partID); err != nil {
					writeJSON(w, http.StatusInternalServerError, response{"message": "failed to update part stock"})
					return
				}

				note := fmt.Sprintf("Purchase from %s - %s", supplierName, nullStringValue(purchaseNumber))
				if _, err := tx.Exec(`
					INSERT INTO part_stock_movements (part_id, type, qty, before_stock, after_stock, unit_price, supplier_id, reference_type, reference_id, notes, created_by, created_at, updated_at)
					VALUES (?, 'purchase', ?, ?, ?, ?, ?, 'App\\Models\\PartPurchase', ?, ?, ?, ?, ?)
				`, partID, quantity, beforeStock, afterStock, priceAfterDiscount, nullInt(supplierID), purchaseIntID, note, nullableInt64Ptr(payload.ActorUserID), now, now); err != nil {
					writeJSON(w, http.StatusInternalServerError, response{"message": "failed to create stock movement"})
					return
				}
			}

			if err := rows.Err(); err != nil {
				writeJSON(w, http.StatusInternalServerError, response{"message": "failed to process purchase details"})
				return
			}
		}

		if err := tx.Commit(); err != nil {
			writeJSON(w, http.StatusInternalServerError, response{"message": "failed to commit transaction"})
			return
		}

		writeJSON(w, http.StatusOK, response{
			"ok":      true,
			"message": "Purchase status updated to: " + payload.Status,
		})

		EmitEvent(events.NewEvent(events.EventPartPurchaseUpdated, events.DomainPartPurchase).
			WithID(purchaseID).
			WithAction("status_changed").
			WithData(response{
				"old_status": oldStatus,
				"new_status": payload.Status,
			}))
	}
}

func applyDiscountTaxServiceStyle(amount int64, discountType string, discountValue float64) int64 {
	if discountType == "none" || discountValue == 0 {
		return amount
	}

	if discountType == "percent" {
		discountAmount := int64(float64(amount)*(discountValue/100.0) + 0.5)
		return amount - discountAmount
	}

	if discountType == "fixed" {
		discountAmount := int64(discountValue*100.0 + 0.5)
		return amount - discountAmount
	}

	return amount
}
