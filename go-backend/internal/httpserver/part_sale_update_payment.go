package httpserver

import (
	"database/sql"
	"encoding/json"
	"net/http"
	"strings"
	"time"
)

type partSaleUpdatePaymentRequest struct {
	PaymentAmount         int64                      `json:"payment_amount"`
	ReceivedDenominations []cashSuggestReceivedEntry `json:"received_denominations"`
	ActorUserID           sql.NullInt64              `json:"-"`
}

func partSaleUpdatePaymentHandler(db *sql.DB) http.HandlerFunc {
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

		var raw map[string]json.RawMessage
		if err := json.NewDecoder(r.Body).Decode(&raw); err != nil {
			writeJSON(w, http.StatusBadRequest, response{"message": "invalid json payload"})
			return
		}

		payload := partSaleUpdatePaymentRequest{}
		if value, ok := raw["payment_amount"]; ok {
			if err := json.Unmarshal(value, &payload.PaymentAmount); err != nil {
				writeJSON(w, http.StatusUnprocessableEntity, response{"message": "invalid payment amount"})
				return
			}
		}
		if value, ok := raw["received_denominations"]; ok {
			if err := json.Unmarshal(value, &payload.ReceivedDenominations); err != nil {
				writeJSON(w, http.StatusUnprocessableEntity, response{"message": "invalid received denominations"})
				return
			}
		}
		if value, ok := raw["actor_user_id"]; ok {
			var actorID int64
			if err := json.Unmarshal(value, &actorID); err == nil && actorID > 0 {
				payload.ActorUserID = sql.NullInt64{Int64: actorID, Valid: true}
			}
		}

		if payload.PaymentAmount < 1 {
			writeJSON(w, http.StatusUnprocessableEntity, response{
				"message": "The payment amount field is required.",
				"errors": response{
					"payment_amount": []string{"The payment amount field is required."},
				},
			})
			return
		}

		partSale, err := queryPartSalePaymentState(db, partSaleIntID)
		if err == sql.ErrNoRows {
			writeJSON(w, http.StatusNotFound, response{"message": "Part sale not found."})
			return
		}
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, response{"message": "failed to read part sale"})
			return
		}

		remainingBeforePayment := maxInt64(0, partSale.GrandTotal-partSale.PaidAmount)
		changeFromPayment := maxInt64(0, payload.PaymentAmount-remainingBeforePayment)

		receivedRows := normalizeReceivedRows(payload.ReceivedDenominations)
		if len(receivedRows) > 0 {
			receivedTotal, err := calculateReceivedTotal(db, receivedRows)
			if err != nil {
				writeJSON(w, http.StatusInternalServerError, response{"message": "failed to read denominations"})
				return
			}
			if receivedTotal != payload.PaymentAmount {
				writeJSON(w, http.StatusUnprocessableEntity, response{
					"message": "The given data was invalid.",
					"errors": response{
						"payment_amount": []string{"Total pecahan uang diterima harus sama dengan jumlah pembayaran."},
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

		if len(receivedRows) > 0 {
			if err := recordPartSaleCashPaymentTx(tx, partSale, payload.PaymentAmount, changeFromPayment, receivedRows, payload.ActorUserID, now); err != nil {
				if validationErr, ok := err.(*partSalePaymentValidationError); ok {
					writeJSON(w, http.StatusUnprocessableEntity, response{
						"message": "The given data was invalid.",
						"errors": response{
							"payment_amount": []string{validationErr.Message},
						},
					})
					return
				}
				writeJSON(w, http.StatusInternalServerError, response{"message": "failed to record cash payment"})
				return
			}
		}

		newPaidAmount := partSale.PaidAmount + payload.PaymentAmount
		remainingAmount := maxInt64(0, partSale.GrandTotal-newPaidAmount)
		paymentStatus := "unpaid"
		if newPaidAmount >= partSale.GrandTotal {
			paymentStatus = "paid"
		} else if newPaidAmount > 0 {
			paymentStatus = "partial"
		}

		if _, err := tx.Exec(`
			UPDATE part_sales
			SET paid_amount = ?, remaining_amount = ?, payment_status = ?, updated_at = ?
			WHERE id = ?
		`, newPaidAmount, remainingAmount, paymentStatus, now, partSale.ID); err != nil {
			writeJSON(w, http.StatusInternalServerError, response{"message": "failed to update part sale payment"})
			return
		}

		if err := tx.Commit(); err != nil {
			writeJSON(w, http.StatusInternalServerError, response{"message": "failed to commit transaction"})
			return
		}

		writeJSON(w, http.StatusOK, response{
			"ok":      true,
			"message": "Pembayaran berhasil dicatat",
		})
	}
}

type partSalePaymentState struct {
	ID         int64
	SaleNumber string
	GrandTotal int64
	PaidAmount int64
}

func queryPartSalePaymentState(db *sql.DB, partSaleID int64) (partSalePaymentState, error) {
	const q = `
		SELECT id, sale_number, COALESCE(grand_total, 0), COALESCE(paid_amount, 0)
		FROM part_sales
		WHERE id = ?
		LIMIT 1
	`

	var state partSalePaymentState
	err := db.QueryRow(q, partSaleID).Scan(&state.ID, &state.SaleNumber, &state.GrandTotal, &state.PaidAmount)
	return state, err
}

func normalizeReceivedRows(rows []cashSuggestReceivedEntry) []cashSuggestReceivedEntry {
	filtered := make([]cashSuggestReceivedEntry, 0)
	for _, row := range rows {
		if row.Quantity > 0 {
			filtered = append(filtered, row)
		}
	}
	return filtered
}

func calculateReceivedTotal(db *sql.DB, rows []cashSuggestReceivedEntry) (int64, error) {
	denominationValues, err := loadDenominationValues(db)
	if err != nil {
		return 0, err
	}

	total := int64(0)
	for _, row := range rows {
		value := denominationValues[row.DenominationID]
		total += value * row.Quantity
	}
	return total, nil
}

type partSalePaymentValidationError struct {
	Message string
}

func (e *partSalePaymentValidationError) Error() string {
	return e.Message
}

func recordPartSaleCashPaymentTx(tx *sql.Tx, partSale partSalePaymentState, paymentAmount, changeAmount int64, receivedRows []cashSuggestReceivedEntry, actorUserID sql.NullInt64, now time.Time) error {
	denominationIDs := make([]int64, 0, len(receivedRows))
	for _, row := range receivedRows {
		denominationIDs = append(denominationIDs, row.DenominationID)
	}

	denominationValues, err := loadDenominationValuesTx(tx, denominationIDs)
	if err != nil {
		return err
	}

	availableByValue, err := loadCashDrawerByValueTx(tx)
	if err != nil {
		return err
	}
	for _, row := range receivedRows {
		value := denominationValues[row.DenominationID]
		if value <= 0 {
			continue
		}
		availableByValue[value] += row.Quantity
	}

	suggestion := suggestCashChange(changeAmount, availableByValue)
	if changeAmount > 0 && !suggestion.Exact {
		return &partSalePaymentValidationError{Message: "Stok kas tidak cukup untuk memberikan kembalian pas."}
	}

	valueToID, err := loadDenominationIDByValueTx(tx)
	if err != nil {
		return err
	}

	receivedMeta, _ := json.Marshal(response{
		"part_sale_id": partSale.ID,
		"sale_number":  partSale.SaleNumber,
	})
	receivedTxnID, err := insertCashTransaction(tx, response{
		"transaction_type": "income",
		"amount":           paymentAmount,
		"source":           "part-sale-payment",
		"description":      "Pembayaran cash penjualan " + partSale.SaleNumber,
		"meta":             string(receivedMeta),
		"happened_at":      now,
		"created_by":       nullIntToAny(actorUserID),
	})
	if err != nil {
		return err
	}

	for _, row := range receivedRows {
		value := denominationValues[row.DenominationID]
		if row.Quantity <= 0 || value <= 0 {
			continue
		}
		if err := insertCashTransactionItem(tx, receivedTxnID, row.DenominationID, "in", row.Quantity, value*row.Quantity, now); err != nil {
			return err
		}
		if err := ensureDrawerRow(tx, row.DenominationID); err != nil {
			return err
		}
		if err := adjustDrawerQuantity(tx, row.DenominationID, row.Quantity); err != nil {
			return err
		}
	}

	if changeAmount <= 0 {
		return nil
	}

	changeMeta, _ := json.Marshal(response{
		"part_sale_id": partSale.ID,
		"sale_number":  partSale.SaleNumber,
	})
	changeTxnID, err := insertCashTransaction(tx, response{
		"transaction_type": "change_given",
		"amount":           changeAmount,
		"source":           "part-sale-change",
		"description":      "Kembalian cash penjualan " + partSale.SaleNumber,
		"meta":             string(changeMeta),
		"happened_at":      now,
		"created_by":       nullIntToAny(actorUserID),
	})
	if err != nil {
		return err
	}

	for _, item := range suggestion.Items {
		if item.Quantity <= 0 {
			continue
		}
		denominationID := valueToID[item.Value]
		if denominationID <= 0 {
			continue
		}
		if err := ensureDrawerRow(tx, denominationID); err != nil {
			return err
		}

		currentQty, err := getDrawerQuantityForUpdate(tx, denominationID)
		if err != nil {
			return err
		}
		if currentQty < item.Quantity {
			return &partSalePaymentValidationError{Message: "Stok kas pecahan tidak mencukupi untuk kembalian."}
		}

		if err := insertCashTransactionItem(tx, changeTxnID, denominationID, "out", item.Quantity, item.LineTotal, now); err != nil {
			return err
		}
		if _, err := tx.Exec(`UPDATE cash_drawer_denominations SET quantity = ?, updated_at = ? WHERE denomination_id = ?`, currentQty-item.Quantity, now, denominationID); err != nil {
			return err
		}
	}

	return nil
}

func loadDenominationValuesTx(tx *sql.Tx, denominationIDs []int64) (map[int64]int64, error) {
	if len(denominationIDs) == 0 {
		return map[int64]int64{}, nil
	}

	rows, err := tx.Query(`SELECT id, value FROM cash_denominations WHERE id IN (`+placeholders(len(denominationIDs))+`)`, int64SliceToAny(denominationIDs)...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	items := map[int64]int64{}
	for rows.Next() {
		var id sql.NullInt64
		var value sql.NullInt64
		if err := rows.Scan(&id, &value); err != nil {
			return nil, err
		}
		items[int64OrZero(id)] = int64OrZero(value)
	}

	return items, rows.Err()
}

func loadCashDrawerByValueTx(tx *sql.Tx) (map[int64]int64, error) {
	rows, err := tx.Query(`
		SELECT cd.value, COALESCE(cdd.quantity, 0)
		FROM cash_denominations cd
		LEFT JOIN cash_drawer_denominations cdd ON cdd.denomination_id = cd.id
	`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	items := map[int64]int64{}
	for rows.Next() {
		var value sql.NullInt64
		var quantity sql.NullInt64
		if err := rows.Scan(&value, &quantity); err != nil {
			return nil, err
		}
		items[int64OrZero(value)] = int64OrZero(quantity)
	}
	return items, rows.Err()
}

func loadDenominationIDByValueTx(tx *sql.Tx) (map[int64]int64, error) {
	rows, err := tx.Query(`SELECT id, value FROM cash_denominations`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	items := map[int64]int64{}
	for rows.Next() {
		var id sql.NullInt64
		var value sql.NullInt64
		if err := rows.Scan(&id, &value); err != nil {
			return nil, err
		}
		items[int64OrZero(value)] = int64OrZero(id)
	}
	return items, rows.Err()
}

func placeholders(size int) string {
	if size <= 0 {
		return ""
	}
	parts := make([]string, 0, size)
	for i := 0; i < size; i++ {
		parts = append(parts, "?")
	}
	return strings.Join(parts, ",")
}

func int64SliceToAny(values []int64) []any {
	result := make([]any, 0, len(values))
	for _, value := range values {
		result = append(result, value)
	}
	return result
}

func maxInt64(a, b int64) int64 {
	if a > b {
		return a
	}
	return b
}
