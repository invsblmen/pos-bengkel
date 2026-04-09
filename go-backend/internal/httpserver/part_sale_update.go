package httpserver

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
	"time"
)

type partSaleUpdateItemRequest struct {
	PartID             int64    `json:"part_id"`
	Quantity           int64    `json:"quantity"`
	UnitPrice          int64    `json:"unit_price"`
	DiscountType       *string  `json:"discount_type"`
	DiscountValue      *float64 `json:"discount_value"`
	WarrantyPeriodDays *int64   `json:"warranty_period_days"`
}

type partSaleUpdateRequest struct {
	CustomerID    int64                       `json:"customer_id"`
	SaleDate      string                      `json:"sale_date"`
	Items         []partSaleUpdateItemRequest `json:"items"`
	DiscountType  *string                     `json:"discount_type"`
	DiscountValue *float64                    `json:"discount_value"`
	TaxType       *string                     `json:"tax_type"`
	TaxValue      *float64                    `json:"tax_value"`
	PaidAmount    *int64                      `json:"paid_amount"`
	Status        *string                     `json:"status"`
	Notes         *string                     `json:"notes"`
	VoucherCode   *string                     `json:"voucher_code"`
	ActorUserID   *int64                      `json:"actor_user_id"`
}

type partSaleUpdateState struct {
	ID         int64
	SaleNumber string
	Status     string
	PaidAmount int64
}

func partSaleUpdateHandler(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if db == nil {
			writeJSON(w, http.StatusServiceUnavailable, response{"message": "database is not configured"})
			return
		}

		partSaleID := strings.TrimSpace(r.PathValue("id"))
		if partSaleID == "" {
			writeJSON(w, http.StatusBadRequest, response{"message": "part sale id is required"})
			return
		}

		partSaleIntID := parseInt64WithDefault(partSaleID)
		if partSaleIntID <= 0 {
			writeJSON(w, http.StatusBadRequest, response{"message": "part sale id is required"})
			return
		}

		var payload partSaleUpdateRequest
		if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
			writeJSON(w, http.StatusBadRequest, response{"message": "invalid json payload"})
			return
		}

		if payload.CustomerID <= 0 {
			writeJSON(w, http.StatusUnprocessableEntity, response{
				"message": "The given data was invalid.",
				"errors": response{
					"customer_id": []string{"The customer id field is required."},
				},
			})
			return
		}

		saleDate, err := time.ParseInLocation("2006-01-02", strings.TrimSpace(payload.SaleDate), time.Local)
		if err != nil {
			writeJSON(w, http.StatusUnprocessableEntity, response{
				"message": "The given data was invalid.",
				"errors": response{
					"sale_date": []string{"The sale date is not a valid date."},
				},
			})
			return
		}

		if len(payload.Items) == 0 {
			writeJSON(w, http.StatusUnprocessableEntity, response{
				"message": "The given data was invalid.",
				"errors": response{
					"items": []string{"The items field is required."},
				},
			})
			return
		}

		discountType := strings.TrimSpace(psStoreStringOrDefault(payload.DiscountType, "none"))
		taxType := strings.TrimSpace(psStoreStringOrDefault(payload.TaxType, "none"))
		if !isAllowedDiscountType(discountType) {
			writeJSON(w, http.StatusUnprocessableEntity, response{
				"message": "The given data was invalid.",
				"errors": response{
					"discount_type": []string{"The selected discount type is invalid."},
				},
			})
			return
		}
		if !isAllowedDiscountType(taxType) {
			writeJSON(w, http.StatusUnprocessableEntity, response{
				"message": "The given data was invalid.",
				"errors": response{
					"tax_type": []string{"The selected tax type is invalid."},
				},
			})
			return
		}

		discountValue := psStoreFloatOrDefault(payload.DiscountValue, 0)
		taxValue := psStoreFloatOrDefault(payload.TaxValue, 0)
		if discountValue < 0 {
			writeJSON(w, http.StatusUnprocessableEntity, response{
				"message": "The given data was invalid.",
				"errors": response{
					"discount_value": []string{"The discount value field must be at least 0."},
				},
			})
			return
		}
		if taxValue < 0 {
			writeJSON(w, http.StatusUnprocessableEntity, response{
				"message": "The given data was invalid.",
				"errors": response{
					"tax_value": []string{"The tax value field must be at least 0."},
				},
			})
			return
		}

		for i, item := range payload.Items {
			if item.PartID <= 0 {
				writeJSON(w, http.StatusUnprocessableEntity, response{
					"message": "The given data was invalid.",
					"errors": response{
						fmt.Sprintf("items.%d.part_id", i): []string{"The part id field is required."},
					},
				})
				return
			}
			if item.Quantity <= 0 {
				writeJSON(w, http.StatusUnprocessableEntity, response{
					"message": "The given data was invalid.",
					"errors": response{
						fmt.Sprintf("items.%d.quantity", i): []string{"The quantity field must be at least 1."},
					},
				})
				return
			}
			if item.UnitPrice < 0 {
				writeJSON(w, http.StatusUnprocessableEntity, response{
					"message": "The given data was invalid.",
					"errors": response{
						fmt.Sprintf("items.%d.unit_price", i): []string{"The unit price field must be at least 0."},
					},
				})
				return
			}

			itemDiscountType := strings.TrimSpace(psStoreStringOrDefault(item.DiscountType, "none"))
			if !isAllowedDiscountType(itemDiscountType) {
				writeJSON(w, http.StatusUnprocessableEntity, response{
					"message": "The given data was invalid.",
					"errors": response{
						fmt.Sprintf("items.%d.discount_type", i): []string{"The selected discount type is invalid."},
					},
				})
				return
			}
			if psStoreFloatOrDefault(item.DiscountValue, 0) < 0 {
				writeJSON(w, http.StatusUnprocessableEntity, response{
					"message": "The given data was invalid.",
					"errors": response{
						fmt.Sprintf("items.%d.discount_value", i): []string{"The discount value field must be at least 0."},
					},
				})
				return
			}
		}

		now := time.Now()
		tx, err := db.BeginTx(r.Context(), nil)
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, response{"message": "failed to start transaction"})
			return
		}
		defer func() { _ = tx.Rollback() }()

		saleState, err := queryPartSaleUpdateStateForUpdate(tx, partSaleIntID)
		if err == sql.ErrNoRows {
			writeJSON(w, http.StatusNotFound, response{"message": "Part sale not found."})
			return
		}
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, response{"message": "failed to read part sale"})
			return
		}

		if saleState.Status != "draft" {
			writeJSON(w, http.StatusUnprocessableEntity, response{
				"message": "The given data was invalid.",
				"errors": response{
					"error": []string{"Hanya penjualan draft yang bisa diupdate"},
				},
			})
			return
		}

		customerExists, err := recordExistsTx(tx, "customers", payload.CustomerID)
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, response{"message": "failed to read customer"})
			return
		}
		if !customerExists {
			writeJSON(w, http.StatusUnprocessableEntity, response{
				"message": "The given data was invalid.",
				"errors": response{
					"customer_id": []string{"Selected customer id is invalid."},
				},
			})
			return
		}

		status := strings.TrimSpace(psStoreStringOrDefault(payload.Status, saleState.Status))
		if !allowedPartSaleStatuses[status] {
			writeJSON(w, http.StatusUnprocessableEntity, response{
				"message": "The given data was invalid.",
				"errors": response{
					"status": []string{"The selected status is invalid."},
				},
			})
			return
		}

		directReserve := status == "confirmed" || status == "ready_to_notify" || status == "waiting_pickup" || status == "completed"
		if directReserve {
			for _, item := range payload.Items {
				partRow, err := queryPartSnapshotForUpdate(tx, item.PartID)
				if err == sql.ErrNoRows {
					writeJSON(w, http.StatusUnprocessableEntity, response{
						"message": "The given data was invalid.",
						"errors": response{
							"items": []string{"Selected part id is invalid."},
						},
					})
					return
				}
				if err != nil {
					writeJSON(w, http.StatusInternalServerError, response{"message": "failed to read part stock"})
					return
				}

				if partRow.Stock < item.Quantity {
					writeJSON(w, http.StatusUnprocessableEntity, response{
						"message": "The given data was invalid.",
						"errors": response{
							"error": []string{fmt.Sprintf("Stock %s tidak mencukupi. Tersedia: %d, dibutuhkan tambahan: %d", partRow.Name, partRow.Stock, item.Quantity)},
						},
					})
					return
				}
			}
		}

		paidAmount := saleState.PaidAmount
		if payload.PaidAmount != nil {
			paidAmount = *payload.PaidAmount
		}
		if paidAmount < 0 {
			writeJSON(w, http.StatusUnprocessableEntity, response{
				"message": "The given data was invalid.",
				"errors": response{
					"paid_amount": []string{"The paid amount field must be at least 0."},
				},
			})
			return
		}

		if _, err := tx.Exec(`
			UPDATE part_sales
			SET customer_id = ?, sale_date = ?, discount_type = ?, discount_value = ?,
				tax_type = ?, tax_value = ?, paid_amount = ?, status = ?, notes = ?, voucher_code = ?, updated_at = ?
			WHERE id = ?
		`, payload.CustomerID, saleDate.Format("2006-01-02"), discountType, discountValue, taxType, taxValue, paidAmount, status, psStoreNullableStringPtr(payload.Notes), psStoreNullableStringPtr(payload.VoucherCode), now, partSaleIntID); err != nil {
			writeJSON(w, http.StatusInternalServerError, response{"message": "failed to update part sale"})
			return
		}

		if _, err := tx.Exec(`UPDATE warranty_registrations SET deleted_at = ?, updated_at = ? WHERE source_type = 'App\\Models\\PartSale' AND source_id = ? AND deleted_at IS NULL`, now, now, partSaleIntID); err != nil {
			writeJSON(w, http.StatusInternalServerError, response{"message": "failed to clear warranty registrations"})
			return
		}

		if _, err := tx.Exec(`DELETE FROM part_sale_details WHERE part_sale_id = ?`, partSaleIntID); err != nil {
			writeJSON(w, http.StatusInternalServerError, response{"message": "failed to delete previous sale details"})
			return
		}

		subtotal := int64(0)
		for _, item := range payload.Items {
			partRow, err := queryPartSnapshotForUpdate(tx, item.PartID)
			if err == sql.ErrNoRows {
				writeJSON(w, http.StatusUnprocessableEntity, response{
					"message": "The given data was invalid.",
					"errors": response{
						"items": []string{"Selected part id is invalid."},
					},
				})
				return
			}
			if err != nil {
				writeJSON(w, http.StatusInternalServerError, response{"message": "failed to read part"})
				return
			}

			lineSubtotal := item.Quantity * item.UnitPrice
			lineDiscountType := psStoreStringOrDefault(item.DiscountType, "none")
			lineDiscountValue := psStoreFloatOrDefault(item.DiscountValue, 0)
			lineDiscountAmount := calculateDiscountOrTaxAmount(lineSubtotal, lineDiscountType, lineDiscountValue)
			lineFinalAmount := lineSubtotal - lineDiscountAmount
			if lineFinalAmount < 0 {
				lineFinalAmount = 0
			}
			subtotal += lineFinalAmount

			warrantyPeriodDays := psStoreInt64OrDefault(item.WarrantyPeriodDays, 0)
			if warrantyPeriodDays <= 0 && partRow.HasWarranty {
				warrantyPeriodDays = partRow.WarrantyDurationDays
			}
			var warrantyStartDate any
			var warrantyEndDate any
			if warrantyPeriodDays > 0 {
				warrantyStartDate = saleDate.Format("2006-01-02")
				warrantyEndDate = saleDate.AddDate(0, 0, int(warrantyPeriodDays)).Format("2006-01-02")
			}

			reservedQty := int64(0)
			movementNote := ""
			if directReserve {
				if partRow.Stock < item.Quantity {
					writeJSON(w, http.StatusUnprocessableEntity, response{
						"message": "The given data was invalid.",
						"errors": response{
							"error": []string{fmt.Sprintf("Stock %s tidak mencukupi. Tersedia: %d, dibutuhkan tambahan: %d", partRow.Name, partRow.Stock, item.Quantity)},
						},
					})
					return
				}
				reservedQty = item.Quantity
				movementNote = fmt.Sprintf("Konfirmasi Penjualan #%s", saleState.SaleNumber)
			} else if status == "waiting_stock" && partRow.Stock >= item.Quantity {
				reservedQty = item.Quantity
				movementNote = fmt.Sprintf("Reservasi Pesanan #%s", saleState.SaleNumber)
			}

			if reservedQty > 0 {
				afterStock := partRow.Stock - reservedQty
				if _, err := tx.Exec(`UPDATE parts SET stock = ?, updated_at = ? WHERE id = ?`, afterStock, now, partRow.ID); err != nil {
					writeJSON(w, http.StatusInternalServerError, response{"message": "failed to update part stock"})
					return
				}

				if _, err := tx.Exec(`
					INSERT INTO part_stock_movements (part_id, type, qty, before_stock, after_stock, unit_price, supplier_id, reference_type, reference_id, notes, created_by, created_at, updated_at)
					VALUES (?, 'out', ?, ?, ?, ?, NULL, 'App\\Models\\PartSale', ?, ?, ?, ?, ?)
				`, partRow.ID, reservedQty, partRow.Stock, afterStock, item.UnitPrice, partSaleIntID, movementNote, nullableInt64Ptr(payload.ActorUserID), now, now); err != nil {
					writeJSON(w, http.StatusInternalServerError, response{"message": "failed to create stock movement"})
					return
				}
			}

			if _, err := tx.Exec(`
				INSERT INTO part_sale_details (
					part_sale_id, part_id, quantity, reserved_quantity,
					unit_price, subtotal, discount_type, discount_value,
					discount_amount, final_amount, source_purchase_detail_id,
					cost_price, selling_price, warranty_period_days,
					warranty_start_date, warranty_end_date,
					warranty_claimed_at, warranty_claim_notes, created_at, updated_at
				) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, ?, ?, ?, ?, NULL, NULL, ?, ?)
			`, partSaleIntID, partRow.ID, item.Quantity, reservedQty, item.UnitPrice, lineSubtotal, lineDiscountType, lineDiscountValue, lineDiscountAmount, lineFinalAmount, partRow.BuyPrice, item.UnitPrice, warrantyPeriodDays, warrantyStartDate, warrantyEndDate, now, now); err != nil {
				writeJSON(w, http.StatusInternalServerError, response{"message": "failed to create part sale detail"})
				return
			}
		}

		discountAmount := calculateDiscountOrTaxAmount(subtotal, discountType, discountValue)
		amountAfterDiscount := subtotal - discountAmount
		if amountAfterDiscount < 0 {
			amountAfterDiscount = 0
		}
		taxAmount := calculateDiscountOrTaxAmount(amountAfterDiscount, taxType, taxValue)
		grandTotal := amountAfterDiscount + taxAmount
		remainingAmount := grandTotal - paidAmount
		if remainingAmount < 0 {
			remainingAmount = 0
		}
		paymentStatus := "unpaid"
		if paidAmount >= grandTotal {
			paymentStatus = "paid"
		} else if paidAmount > 0 {
			paymentStatus = "partial"
		}

		if _, err := tx.Exec(`
			UPDATE part_sales
			SET subtotal = ?, discount_amount = ?, tax_amount = ?, grand_total = ?,
				paid_amount = ?, remaining_amount = ?, payment_status = ?, updated_at = ?
			WHERE id = ?
		`, subtotal, discountAmount, taxAmount, grandTotal, paidAmount, remainingAmount, paymentStatus, now, partSaleIntID); err != nil {
			writeJSON(w, http.StatusInternalServerError, response{"message": "failed to update part sale totals"})
			return
		}

		if err := tx.Commit(); err != nil {
			writeJSON(w, http.StatusInternalServerError, response{"message": "failed to commit transaction"})
			return
		}

		writeJSON(w, http.StatusOK, response{
			"ok":      true,
			"message": "Penjualan berhasil diupdate",
			"sale_id": partSaleIntID,
		})
	}
}

func queryPartSaleUpdateStateForUpdate(tx *sql.Tx, partSaleID int64) (partSaleUpdateState, error) {
	const q = `
		SELECT id, sale_number, status, COALESCE(paid_amount, 0)
		FROM part_sales
		WHERE id = ?
		LIMIT 1
		FOR UPDATE
	`

	var state partSaleUpdateState
	err := tx.QueryRow(q, partSaleID).Scan(&state.ID, &state.SaleNumber, &state.Status, &state.PaidAmount)
	return state, err
}
