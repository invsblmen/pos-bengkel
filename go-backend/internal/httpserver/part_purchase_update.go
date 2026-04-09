package httpserver

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
	"time"
)

type partPurchaseUpdateItemRequest struct {
	PartID             int64    `json:"part_id"`
	Quantity           int64    `json:"quantity"`
	UnitPrice          int64    `json:"unit_price"`
	DiscountType       *string  `json:"discount_type"`
	DiscountValue      *float64 `json:"discount_value"`
	MarginType         *string  `json:"margin_type"`
	MarginValue        *float64 `json:"margin_value"`
	PromoDiscountType  *string  `json:"promo_discount_type"`
	PromoDiscountValue *float64 `json:"promo_discount_value"`
}

type partPurchaseUpdateRequest struct {
	SupplierID           int64                           `json:"supplier_id"`
	PurchaseDate         string                          `json:"purchase_date"`
	ExpectedDeliveryDate *string                         `json:"expected_delivery_date"`
	Notes                *string                         `json:"notes"`
	Items                []partPurchaseUpdateItemRequest `json:"items"`
	DiscountType         *string                         `json:"discount_type"`
	DiscountValue        *float64                        `json:"discount_value"`
	TaxType              *string                         `json:"tax_type"`
	TaxValue             *float64                        `json:"tax_value"`
	ActorUserID          *int64                          `json:"actor_user_id"`
}

func partPurchaseUpdateHandler(db *sql.DB) http.HandlerFunc {
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

		var payload partPurchaseUpdateRequest
		if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
			writeJSON(w, http.StatusBadRequest, response{"message": "invalid json payload"})
			return
		}

		purchaseDate, err := time.ParseInLocation("2006-01-02", strings.TrimSpace(payload.PurchaseDate), time.Local)
		if err != nil {
			writeJSON(w, http.StatusUnprocessableEntity, response{
				"message": "The given data was invalid.",
				"errors": response{
					"purchase_date": []string{"The purchase date is not a valid date."},
				},
			})
			return
		}

		if payload.SupplierID <= 0 {
			writeJSON(w, http.StatusUnprocessableEntity, response{
				"message": "The given data was invalid.",
				"errors": response{
					"supplier_id": []string{"The supplier id field is required."},
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

			marginType := strings.TrimSpace(psStoreStringOrDefault(item.MarginType, ""))
			if marginType != "percent" && marginType != "fixed" {
				writeJSON(w, http.StatusUnprocessableEntity, response{
					"message": "The given data was invalid.",
					"errors": response{
						fmt.Sprintf("items.%d.margin_type", i): []string{"The selected margin type is invalid."},
					},
				})
				return
			}
			if psStoreFloatOrDefault(item.MarginValue, -1) < 0 {
				writeJSON(w, http.StatusUnprocessableEntity, response{
					"message": "The given data was invalid.",
					"errors": response{
						fmt.Sprintf("items.%d.margin_value", i): []string{"The margin value field must be at least 0."},
					},
				})
				return
			}

			itemPromoDiscountType := strings.TrimSpace(psStoreStringOrDefault(item.PromoDiscountType, "none"))
			if !isAllowedDiscountType(itemPromoDiscountType) {
				writeJSON(w, http.StatusUnprocessableEntity, response{
					"message": "The given data was invalid.",
					"errors": response{
						fmt.Sprintf("items.%d.promo_discount_type", i): []string{"The selected promo discount type is invalid."},
					},
				})
				return
			}
			if psStoreFloatOrDefault(item.PromoDiscountValue, 0) < 0 {
				writeJSON(w, http.StatusUnprocessableEntity, response{
					"message": "The given data was invalid.",
					"errors": response{
						fmt.Sprintf("items.%d.promo_discount_value", i): []string{"The promo discount value field must be at least 0."},
					},
				})
				return
			}
		}

		var expectedDeliveryDate any
		if payload.ExpectedDeliveryDate != nil {
			raw := strings.TrimSpace(*payload.ExpectedDeliveryDate)
			if raw != "" {
				parsed, err := time.ParseInLocation("2006-01-02", raw, time.Local)
				if err != nil {
					writeJSON(w, http.StatusUnprocessableEntity, response{
						"message": "The given data was invalid.",
						"errors": response{
							"expected_delivery_date": []string{"The expected delivery date is not a valid date."},
						},
					})
					return
				}
				expectedDeliveryDate = parsed.Format("2006-01-02")
			}
		}

		tx, err := db.BeginTx(r.Context(), nil)
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, response{"message": "failed to start transaction"})
			return
		}
		defer func() { _ = tx.Rollback() }()

		purchaseStatus, purchaseNumber, err := queryPartPurchaseUpdateStateForUpdate(tx, purchaseIntID)
		if err == sql.ErrNoRows {
			writeJSON(w, http.StatusNotFound, response{"message": "Part purchase not found."})
			return
		}
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, response{"message": "failed to read part purchase"})
			return
		}

		if purchaseStatus != "pending" && purchaseStatus != "ordered" {
			writeJSON(w, http.StatusUnprocessableEntity, response{
				"message": "The given data was invalid.",
				"errors": response{
					"error": []string{fmt.Sprintf("Cannot update purchase with status: %s", purchaseStatus)},
				},
			})
			return
		}

		if ok, err := recordExistsTx(tx, "suppliers", payload.SupplierID); err != nil {
			writeJSON(w, http.StatusInternalServerError, response{"message": "failed to read supplier"})
			return
		} else if !ok {
			writeJSON(w, http.StatusUnprocessableEntity, response{
				"message": "The given data was invalid.",
				"errors": response{
					"supplier_id": []string{"Selected supplier id is invalid."},
				},
			})
			return
		}

		purchaseNotes := psStoreNullableStringPtr(payload.Notes)
		updatedBy := nullableInt64Ptr(payload.ActorUserID)
		if _, err := tx.Exec(`
			UPDATE part_purchases
			SET supplier_id = ?, purchase_date = ?, expected_delivery_date = ?, notes = ?, discount_type = ?, discount_value = ?, tax_type = ?, tax_value = ?, updated_by = ?, updated_at = NOW()
			WHERE id = ?
		`, payload.SupplierID, purchaseDate.Format("2006-01-02"), expectedDeliveryDate, purchaseNotes, discountType, discountValue, taxType, taxValue, updatedBy, purchaseIntID); err != nil {
			writeJSON(w, http.StatusInternalServerError, response{"message": "failed to update purchase"})
			return
		}

		if _, err := tx.Exec(`DELETE FROM part_purchase_details WHERE part_purchase_id = ?`, purchaseIntID); err != nil {
			writeJSON(w, http.StatusInternalServerError, response{"message": "failed to delete previous purchase details"})
			return
		}

		subtotal := int64(0)
		for _, item := range payload.Items {
			if ok, err := recordExistsTx(tx, "parts", item.PartID); err != nil {
				writeJSON(w, http.StatusInternalServerError, response{"message": "failed to read part"})
				return
			} else if !ok {
				writeJSON(w, http.StatusUnprocessableEntity, response{
					"message": "The given data was invalid.",
					"errors": response{
						"items": []string{"Selected part id is invalid."},
					},
				})
				return
			}

			lineSubtotal := item.Quantity * item.UnitPrice
			lineDiscountType := strings.TrimSpace(psStoreStringOrDefault(item.DiscountType, "none"))
			lineDiscountValue := psStoreFloatOrDefault(item.DiscountValue, 0)
			lineDiscountAmount := calculatePurchaseAdjustmentAmount(lineSubtotal, lineDiscountType, lineDiscountValue)
			lineFinalAmount := lineSubtotal - lineDiscountAmount

			lineUnitAfterDiscount := item.UnitPrice - calculatePurchaseAdjustmentAmount(item.UnitPrice, lineDiscountType, lineDiscountValue)
			marginType := strings.TrimSpace(psStoreStringOrDefault(item.MarginType, "percent"))
			marginValue := psStoreFloatOrDefault(item.MarginValue, 0)
			lineMarginAmount := calculatePurchaseAdjustmentAmount(lineUnitAfterDiscount, marginType, marginValue)
			lineNormalUnitPrice := lineUnitAfterDiscount + lineMarginAmount
			linePromoDiscountType := strings.TrimSpace(psStoreStringOrDefault(item.PromoDiscountType, "none"))
			linePromoDiscountValue := psStoreFloatOrDefault(item.PromoDiscountValue, 0)
			linePromoDiscountAmount := calculatePurchaseAdjustmentAmount(lineNormalUnitPrice, linePromoDiscountType, linePromoDiscountValue)
			lineSellingPrice := lineNormalUnitPrice - linePromoDiscountAmount

			subtotal += lineFinalAmount

			if _, err := tx.Exec(`
				INSERT INTO part_purchase_details (
					part_purchase_id, part_id, quantity, unit_price, subtotal,
					discount_type, discount_value, discount_amount, final_amount,
					margin_type, margin_value, margin_amount, normal_unit_price,
					promo_discount_type, promo_discount_value, promo_discount_amount, selling_price,
					created_by, created_at, updated_at
				) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
			`, purchaseIntID, item.PartID, item.Quantity, item.UnitPrice, lineSubtotal, lineDiscountType, lineDiscountValue, lineDiscountAmount, lineFinalAmount, marginType, marginValue, lineMarginAmount, lineNormalUnitPrice, linePromoDiscountType, linePromoDiscountValue, linePromoDiscountAmount, lineSellingPrice, updatedBy); err != nil {
				writeJSON(w, http.StatusInternalServerError, response{"message": "failed to create purchase detail"})
				return
			}
		}

		discountAmount := calculatePurchaseAdjustmentAmount(subtotal, discountType, discountValue)
		amountAfterDiscount := subtotal - discountAmount
		taxAmount := calculatePurchaseAdjustmentAmount(amountAfterDiscount, taxType, taxValue)
		grandTotal := amountAfterDiscount + taxAmount

		if _, err := tx.Exec(`
			UPDATE part_purchases
			SET total_amount = ?, discount_amount = ?, tax_amount = ?, grand_total = ?, updated_at = NOW()
			WHERE id = ?
		`, subtotal, discountAmount, taxAmount, grandTotal, purchaseIntID); err != nil {
			writeJSON(w, http.StatusInternalServerError, response{"message": "failed to update purchase totals"})
			return
		}

		if err := tx.Commit(); err != nil {
			writeJSON(w, http.StatusInternalServerError, response{"message": "failed to commit transaction"})
			return
		}

		writeJSON(w, http.StatusOK, response{
			"ok":              true,
			"message":         "Purchase updated successfully",
			"purchase_id":     purchaseIntID,
			"purchase_number": purchaseNumber,
		})
	}
}

func queryPartPurchaseUpdateStateForUpdate(tx *sql.Tx, purchaseID int64) (string, string, error) {
	var status string
	var purchaseNumber string
	err := tx.QueryRow(`
		SELECT COALESCE(status, 'pending'), COALESCE(purchase_number, '')
		FROM part_purchases
		WHERE id = ?
		LIMIT 1
	`, purchaseID).Scan(&status, &purchaseNumber)
	if err != nil {
		return "", "", err
	}

	return status, purchaseNumber, nil
}

func calculatePurchaseAdjustmentAmount(amount int64, kind string, value float64) int64 {
	if kind == "none" || value <= 0 {
		return 0
	}

	if kind == "percent" {
		return int64(float64(amount)*(value/100.0) + 0.5)
	}

	if kind == "fixed" {
		return int64(value*100.0 + 0.5)
	}

	return 0
}
