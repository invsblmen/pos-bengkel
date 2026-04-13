package httpserver

import (
	"database/sql"
	"encoding/json"
	"net/http"
	"time"
)

type cashSaleSettleRequest struct {
	TotalDue    int64                      `json:"total_due"`
	Description string                     `json:"description"`
	Received    []cashSuggestReceivedEntry `json:"received"`
	ActorUserID sql.NullInt64              `json:"-"`
	MetaRaw     map[string]json.RawMessage `json:"-"`
}

func cashSaleSettleHandler(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if db == nil {
			writeJSON(w, http.StatusServiceUnavailable, response{"message": "database is not configured"})
			return
		}

		var raw map[string]json.RawMessage
		if err := json.NewDecoder(r.Body).Decode(&raw); err != nil {
			writeJSON(w, http.StatusBadRequest, response{"ok": false, "message": "invalid json payload"})
			return
		}

		payload := cashSaleSettleRequest{MetaRaw: raw}
		if err := decodeCashSaleSettlePayload(raw, &payload); err != nil {
			writeJSON(w, http.StatusUnprocessableEntity, response{"ok": false, "message": err.Error()})
			return
		}

		denominationValues, err := loadDenominationValues(db)
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, response{"ok": false, "message": "failed to read denominations"})
			return
		}

		receivedRows := make([]response, 0)
		receivedByValue := make(map[int64]int64)
		receivedTotal := int64(0)

		for _, entry := range payload.Received {
			value, ok := denominationValues[entry.DenominationID]
			if !ok {
				writeJSON(w, http.StatusUnprocessableEntity, response{"ok": false, "message": "denomination id tidak valid"})
				return
			}

			if entry.Quantity < 0 {
				writeJSON(w, http.StatusUnprocessableEntity, response{"ok": false, "message": "quantity tidak boleh negatif"})
				return
			}
			if entry.Quantity == 0 {
				continue
			}

			lineTotal := value * entry.Quantity
			receivedRows = append(receivedRows, response{
				"denomination_id": entry.DenominationID,
				"value":           value,
				"quantity":        entry.Quantity,
				"line_total":      lineTotal,
			})
			receivedByValue[value] += entry.Quantity
			receivedTotal += lineTotal
		}

		if receivedTotal < payload.TotalDue {
			writeJSON(w, http.StatusUnprocessableEntity, response{
				"ok":      false,
				"message": "Nominal uang diterima lebih kecil dari total tagihan.",
			})
			return
		}

		changeAmount := receivedTotal - payload.TotalDue

		availableByValue, err := loadCashDrawerByValue(db)
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, response{"ok": false, "message": "failed to read cash drawer"})
			return
		}
		for value, qty := range receivedByValue {
			availableByValue[value] += qty
		}

		suggestion := suggestCashChange(changeAmount, availableByValue)
		if !suggestion.Exact {
			writeJSON(w, http.StatusUnprocessableEntity, response{
				"ok":      false,
				"message": "Stok kas tidak cukup untuk memberikan kembalian pas.",
			})
			return
		}

		valueToID := make(map[int64]int64)
		for id, value := range denominationValues {
			valueToID[value] = id
		}

		now := time.Now()
		tx, err := db.BeginTx(r.Context(), nil)
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, response{"ok": false, "message": "failed to start transaction"})
			return
		}
		defer func() { _ = tx.Rollback() }()

		receivedMeta, _ := json.Marshal(response{
			"total_due":      payload.TotalDue,
			"received_total": receivedTotal,
		})
		receivedTxnID, err := insertCashTransaction(tx, response{
			"transaction_type": "income",
			"amount":           receivedTotal,
			"source":           "cash-sale-received",
			"description":      descriptionOrDefault(payload.Description, "Pembayaran cash pelanggan"),
			"meta":             string(receivedMeta),
			"happened_at":      now,
			"created_by":       nullIntToAny(payload.ActorUserID),
		})
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, response{"ok": false, "message": "failed to record cash transaction"})
			return
		}

		for _, row := range receivedRows {
			if err := insertCashTransactionItem(tx, receivedTxnID, row["denomination_id"].(int64), "in", row["quantity"].(int64), row["line_total"].(int64), now); err != nil {
				writeJSON(w, http.StatusInternalServerError, response{"ok": false, "message": "failed to record cash transaction item"})
				return
			}

			if err := ensureDrawerRow(tx, row["denomination_id"].(int64)); err != nil {
				writeJSON(w, http.StatusInternalServerError, response{"ok": false, "message": "failed to update cash drawer"})
				return
			}
			if err := adjustDrawerQuantity(tx, row["denomination_id"].(int64), row["quantity"].(int64)); err != nil {
				writeJSON(w, http.StatusInternalServerError, response{"ok": false, "message": "failed to update cash drawer"})
				return
			}
		}

		if changeAmount > 0 {
			changeMeta, _ := json.Marshal(response{
				"total_due":      payload.TotalDue,
				"received_total": receivedTotal,
			})
			changeTxnID, err := insertCashTransaction(tx, response{
				"transaction_type": "change_given",
				"amount":           changeAmount,
				"source":           "cash-sale-change",
				"description":      "Kembalian transaksi cash pelanggan",
				"meta":             string(changeMeta),
				"happened_at":      now,
				"created_by":       nullIntToAny(payload.ActorUserID),
			})
			if err != nil {
				writeJSON(w, http.StatusInternalServerError, response{"ok": false, "message": "failed to record cash change transaction"})
				return
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
					writeJSON(w, http.StatusInternalServerError, response{"ok": false, "message": "failed to update cash drawer"})
					return
				}

				currentQty, err := getDrawerQuantityForUpdate(tx, denominationID)
				if err != nil {
					writeJSON(w, http.StatusInternalServerError, response{"ok": false, "message": "failed to update cash drawer"})
					return
				}
				if currentQty < item.Quantity {
					writeJSON(w, http.StatusUnprocessableEntity, response{"ok": false, "message": "Stok kas tidak mencukupi untuk pecahan kembalian."})
					return
				}

				if err := insertCashTransactionItem(tx, changeTxnID, denominationID, "out", item.Quantity, item.LineTotal, now); err != nil {
					writeJSON(w, http.StatusInternalServerError, response{"ok": false, "message": "failed to record cash transaction item"})
					return
				}
				if _, err := tx.Exec(`UPDATE cash_drawer_denominations SET quantity = ?, updated_at = ? WHERE denomination_id = ?`, currentQty-item.Quantity, now, denominationID); err != nil {
					writeJSON(w, http.StatusInternalServerError, response{"ok": false, "message": "failed to update cash drawer"})
					return
				}
			}
		}

		if err := tx.Commit(); err != nil {
			writeJSON(w, http.StatusInternalServerError, response{"ok": false, "message": "failed to commit transaction"})
			return
		}

		writeJSON(w, http.StatusOK, response{
			"ok":             true,
			"message":        "Pembayaran cash dan kembalian berhasil dicatat.",
			"net_cash_in":    payload.TotalDue,
			"received_total": receivedTotal,
			"change_amount":  changeAmount,
		})
	}
}

func decodeCashSaleSettlePayload(raw map[string]json.RawMessage, payload *cashSaleSettleRequest) error {
	if value, ok := raw["total_due"]; ok {
		if err := json.Unmarshal(value, &payload.TotalDue); err != nil {
			return err
		}
	}
	if value, ok := raw["description"]; ok {
		_ = json.Unmarshal(value, &payload.Description)
	}
	if value, ok := raw["received"]; ok {
		if err := json.Unmarshal(value, &payload.Received); err != nil {
			return err
		}
	}
	if value, ok := raw["actor_user_id"]; ok {
		var actorID int64
		if err := json.Unmarshal(value, &actorID); err == nil && actorID > 0 {
			payload.ActorUserID = sql.NullInt64{Int64: actorID, Valid: true}
		}
	}

	if payload.TotalDue < 0 || len(payload.Received) == 0 {
		return &badRequestError{message: "total_due dan received wajib diisi"}
	}

	return nil
}

type badRequestError struct {
	message string
}

func (e *badRequestError) Error() string {
	return e.message
}

func insertCashTransaction(tx *sql.Tx, values response) (int64, error) {
	result, err := tx.Exec(`
		INSERT INTO cash_transactions (
			transaction_type, amount, source, description, meta, happened_at, created_by, created_at, updated_at
		) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
	`, values["transaction_type"], values["amount"], values["source"], values["description"], values["meta"], values["happened_at"], values["created_by"], values["happened_at"], values["happened_at"])
	if err != nil {
		return 0, err
	}
	return result.LastInsertId()
}

func insertCashTransactionItem(tx *sql.Tx, cashTransactionID, denominationID int64, direction string, quantity, lineTotal int64, now time.Time) error {
	_, err := tx.Exec(`
		INSERT INTO cash_transaction_items (
			cash_transaction_id, denomination_id, direction, quantity, line_total, created_at, updated_at
		) VALUES (?, ?, ?, ?, ?, ?, ?)
	`, cashTransactionID, denominationID, direction, quantity, lineTotal, now, now)
	return err
}

func ensureDrawerRow(tx *sql.Tx, denominationID int64) error {
	var existingID int64
	err := tx.QueryRow(`SELECT denomination_id FROM cash_drawer_denominations WHERE denomination_id = ? LIMIT 1`, denominationID).Scan(&existingID)
	if err == nil {
		return nil
	}
	if err != sql.ErrNoRows {
		return err
	}

	now := time.Now()
	_, err = tx.Exec(`
		INSERT INTO cash_drawer_denominations (denomination_id, quantity, created_at, updated_at)
		VALUES (?, 0, ?, ?)
	`, denominationID, now, now)
	return err
}

func adjustDrawerQuantity(tx *sql.Tx, denominationID, qtyDelta int64) error {
	now := time.Now()
	_, err := tx.Exec(`
		UPDATE cash_drawer_denominations
		SET quantity = quantity + ?, updated_at = ?
		WHERE denomination_id = ?
	`, qtyDelta, now, denominationID)
	return err
}

func getDrawerQuantityForUpdate(tx *sql.Tx, denominationID int64) (int64, error) {
	var qty sql.NullInt64
	query := `SELECT quantity FROM cash_drawer_denominations WHERE denomination_id = ?`
	if !isSQLiteTx(tx) {
		query += ` FOR UPDATE`
	}

	err := tx.QueryRow(query, denominationID).Scan(&qty)
	if err != nil {
		return 0, err
	}
	return int64OrZero(qty), nil
}

func descriptionOrDefault(value, fallback string) string {
	if value == "" {
		return fallback
	}
	return value
}

func nullIntToAny(value sql.NullInt64) any {
	if value.Valid {
		return value.Int64
	}
	return nil
}
