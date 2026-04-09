package httpserver

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
	"time"
)

type partSaleStoreItemRequest struct {
	PartID             int64    `json:"part_id"`
	Quantity           int64    `json:"quantity"`
	UnitPrice          int64    `json:"unit_price"`
	DiscountType       *string  `json:"discount_type"`
	DiscountValue      *float64 `json:"discount_value"`
	WarrantyPeriodDays *int64   `json:"warranty_period_days"`
}

type partSaleStoreRequest struct {
	CustomerID       int64                      `json:"customer_id"`
	SaleDate         string                     `json:"sale_date"`
	Items            []partSaleStoreItemRequest `json:"items"`
	DiscountType     *string                    `json:"discount_type"`
	DiscountValue    *float64                   `json:"discount_value"`
	TaxType          *string                    `json:"tax_type"`
	TaxValue         *float64                   `json:"tax_value"`
	PaidAmount       *int64                     `json:"paid_amount"`
	Status           *string                    `json:"status"`
	Notes            *string                    `json:"notes"`
	PartSalesOrderID *int64                     `json:"part_sales_order_id"`
	VoucherCode      *string                    `json:"voucher_code"`
	ActorUserID      *int64                     `json:"actor_user_id"`
}

type partSnapshot struct {
	ID                   int64
	Name                 string
	Stock                int64
	BuyPrice             int64
	HasWarranty          bool
	WarrantyDurationDays int64
}

func partSaleStoreHandler(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if db == nil {
			writeJSON(w, http.StatusServiceUnavailable, response{"message": "database is not configured"})
			return
		}

		var payload partSaleStoreRequest
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

		status := strings.TrimSpace(psStoreStringOrDefault(payload.Status, "confirmed"))
		if !allowedPartSaleStatuses[status] {
			writeJSON(w, http.StatusUnprocessableEntity, response{
				"message": "The given data was invalid.",
				"errors": response{
					"status": []string{"The selected status is invalid."},
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
		paidAmount := psStoreInt64OrDefault(payload.PaidAmount, 0)
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
		if paidAmount < 0 {
			writeJSON(w, http.StatusUnprocessableEntity, response{
				"message": "The given data was invalid.",
				"errors": response{
					"paid_amount": []string{"The paid amount field must be at least 0."},
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

		tx, err := db.BeginTx(r.Context(), nil)
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, response{"message": "failed to start transaction"})
			return
		}
		defer func() { _ = tx.Rollback() }()

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

		partSalesOrderID := psStoreInt64OrDefault(payload.PartSalesOrderID, 0)
		if partSalesOrderID > 0 {
			exists, err := recordExistsTx(tx, "part_sales_orders", partSalesOrderID)
			if err != nil {
				writeJSON(w, http.StatusInternalServerError, response{"message": "failed to read part sales order"})
				return
			}
			if !exists {
				writeJSON(w, http.StatusUnprocessableEntity, response{
					"message": "The given data was invalid.",
					"errors": response{
						"part_sales_order_id": []string{"Selected part sales order id is invalid."},
					},
				})
				return
			}
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
							"error": []string{fmt.Sprintf("Stock %s tidak mencukupi. Tersedia: %d, diminta: %d", partRow.Name, partRow.Stock, item.Quantity)},
						},
					})
					return
				}
			}
		}

		now := time.Now()
		saleNumber, err := generatePartSaleNumberTx(tx, now)
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, response{"message": "failed to generate sale number"})
			return
		}

		res, err := tx.Exec(`
			INSERT INTO part_sales (
				sale_number, customer_id, sale_date, part_sales_order_id,
				subtotal, discount_type, discount_value, discount_amount,
				voucher_id, voucher_code, voucher_discount_amount,
				tax_type, tax_value, tax_amount,
				grand_total, paid_amount, remaining_amount, payment_status,
				status, notes, created_by, created_at, updated_at
			) VALUES (?, ?, ?, ?, 0, ?, ?, 0, NULL, ?, 0, ?, ?, 0, 0, ?, 0, 'unpaid', ?, ?, ?, ?, ?)
		`, saleNumber, payload.CustomerID, saleDate.Format("2006-01-02"), psStoreNullableInt64(partSalesOrderID), discountType, discountValue, psStoreNullableStringPtr(payload.VoucherCode), taxType, taxValue, paidAmount, status, psStoreNullableStringPtr(payload.Notes), nullableInt64Ptr(payload.ActorUserID), now, now)
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, response{"message": "failed to create part sale"})
			return
		}

		saleID, err := res.LastInsertId()
		if err != nil || saleID <= 0 {
			writeJSON(w, http.StatusInternalServerError, response{"message": "failed to create part sale"})
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
							"error": []string{fmt.Sprintf("Stock %s tidak mencukupi. Tersedia: %d, diminta: %d", partRow.Name, partRow.Stock, item.Quantity)},
						},
					})
					return
				}
				reservedQty = item.Quantity
				movementNote = fmt.Sprintf("Penjualan #%s", saleNumber)
			} else if status == "waiting_stock" && partRow.Stock >= item.Quantity {
				reservedQty = item.Quantity
				movementNote = fmt.Sprintf("Reservasi Pesanan #%s", saleNumber)
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
				`, partRow.ID, reservedQty, partRow.Stock, afterStock, item.UnitPrice, saleID, movementNote, nullableInt64Ptr(payload.ActorUserID), now, now); err != nil {
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
			`, saleID, partRow.ID, item.Quantity, reservedQty, item.UnitPrice, lineSubtotal, lineDiscountType, lineDiscountValue, lineDiscountAmount, lineFinalAmount, partRow.BuyPrice, item.UnitPrice, warrantyPeriodDays, warrantyStartDate, warrantyEndDate, now, now); err != nil {
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
		`, subtotal, discountAmount, taxAmount, grandTotal, paidAmount, remainingAmount, paymentStatus, now, saleID); err != nil {
			writeJSON(w, http.StatusInternalServerError, response{"message": "failed to update part sale totals"})
			return
		}

		if partSalesOrderID > 0 {
			if _, err := tx.Exec(`UPDATE part_sales_orders SET status = 'fulfilled', updated_at = ? WHERE id = ?`, now, partSalesOrderID); err != nil {
				writeJSON(w, http.StatusInternalServerError, response{"message": "failed to update part sales order"})
				return
			}
		}

		if err := tx.Commit(); err != nil {
			writeJSON(w, http.StatusInternalServerError, response{"message": "failed to commit transaction"})
			return
		}

		writeJSON(w, http.StatusOK, response{
			"ok":          true,
			"message":     "Penjualan berhasil dibuat",
			"sale_id":     saleID,
			"sale_number": saleNumber,
		})
	}
}

func generatePartSaleNumberTx(tx *sql.Tx, now time.Time) (string, error) {
	datePart := now.Format("20060102")
	likePrefix := "SAL" + datePart + "%"

	var latest sql.NullString
	if err := tx.QueryRow(`SELECT sale_number FROM part_sales WHERE sale_number LIKE ? ORDER BY id DESC LIMIT 1`, likePrefix).Scan(&latest); err != nil && err != sql.ErrNoRows {
		return "", err
	}

	nextNumber := 1
	if latest.Valid {
		raw := strings.TrimSpace(latest.String)
		if len(raw) >= 4 {
			tail := raw[len(raw)-4:]
			parsed := parseInt64WithDefault(tail)
			if parsed > 0 {
				nextNumber = int(parsed) + 1
			}
		}
	}

	return fmt.Sprintf("SAL%s%04d", datePart, nextNumber), nil
}

func queryPartSnapshotForUpdate(tx *sql.Tx, partID int64) (partSnapshot, error) {
	var row partSnapshot
	var hasWarranty sql.NullBool
	var warrantyDuration sql.NullInt64
	var buyPrice sql.NullInt64
	var stock sql.NullInt64

	err := tx.QueryRow(`
		SELECT id, name, stock, buy_price, has_warranty, warranty_duration_days
		FROM parts
		WHERE id = ?
		LIMIT 1
		FOR UPDATE
	`, partID).Scan(&row.ID, &row.Name, &stock, &buyPrice, &hasWarranty, &warrantyDuration)
	if err != nil {
		return partSnapshot{}, err
	}

	row.Stock = int64OrZero(stock)
	row.BuyPrice = int64OrZero(buyPrice)
	row.HasWarranty = hasWarranty.Valid && hasWarranty.Bool
	row.WarrantyDurationDays = int64OrZero(warrantyDuration)

	return row, nil
}

func recordExistsTx(tx *sql.Tx, table string, id int64) (bool, error) {
	query := fmt.Sprintf("SELECT 1 FROM %s WHERE id = ? LIMIT 1", table)
	var marker int
	err := tx.QueryRow(query, id).Scan(&marker)
	if err == sql.ErrNoRows {
		return false, nil
	}
	if err != nil {
		return false, err
	}
	return true, nil
}

func isAllowedDiscountType(value string) bool {
	return value == "none" || value == "percent" || value == "fixed"
}

func calculateDiscountOrTaxAmount(amount int64, kind string, value float64) int64 {
	if amount <= 0 || value <= 0 || kind == "none" {
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

func psStoreInt64OrDefault(value *int64, fallback int64) int64 {
	if value == nil {
		return fallback
	}
	return *value
}

func psStoreFloatOrDefault(value *float64, fallback float64) float64 {
	if value == nil {
		return fallback
	}
	return *value
}

func psStoreStringOrDefault(value *string, fallback string) string {
	if value == nil {
		return fallback
	}
	return strings.TrimSpace(*value)
}

func psStoreNullableInt64(value int64) any {
	if value <= 0 {
		return nil
	}
	return value
}

func psStoreNullableStringPtr(value *string) any {
	if value == nil {
		return nil
	}
	trimmed := strings.TrimSpace(*value)
	if trimmed == "" {
		return nil
	}
	return trimmed
}
