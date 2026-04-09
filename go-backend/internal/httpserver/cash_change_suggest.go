package httpserver

import (
	"database/sql"
	"encoding/json"
	"net/http"
	"sort"
)

type cashSuggestRequest struct {
	TotalDue int64                      `json:"total_due"`
	Received []cashSuggestReceivedEntry `json:"received"`
}

type cashSuggestReceivedEntry struct {
	DenominationID int64 `json:"denomination_id"`
	Quantity       int64 `json:"quantity"`
}

func cashChangeSuggestHandler(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if db == nil {
			writeJSON(w, http.StatusServiceUnavailable, response{"message": "database is not configured"})
			return
		}

		var payload cashSuggestRequest
		if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
			writeJSON(w, http.StatusBadRequest, response{"ok": false, "message": "invalid json payload"})
			return
		}

		if payload.TotalDue < 0 || len(payload.Received) == 0 {
			writeJSON(w, http.StatusUnprocessableEntity, response{"ok": false, "message": "total_due dan received wajib diisi"})
			return
		}

		denominationValues, err := loadDenominationValues(db)
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, response{"ok": false, "message": "failed to read denominations"})
			return
		}

		receivedBreakdown := make([]response, 0)
		receivedTotal := int64(0)
		receivedByValue := make(map[int64]int64)

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
			receivedTotal += lineTotal
			receivedByValue[value] += entry.Quantity

			receivedBreakdown = append(receivedBreakdown, response{
				"denomination_id": entry.DenominationID,
				"value":           value,
				"quantity":        entry.Quantity,
				"line_total":      lineTotal,
			})
		}

		if receivedTotal < payload.TotalDue {
			writeJSON(w, http.StatusUnprocessableEntity, response{
				"ok":             false,
				"message":        "Nominal uang diterima lebih kecil dari total tagihan.",
				"total_due":      payload.TotalDue,
				"received_total": receivedTotal,
			})
			return
		}

		availableByValue, err := loadCashDrawerByValue(db)
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, response{"ok": false, "message": "failed to read cash drawer"})
			return
		}
		for value, qty := range receivedByValue {
			availableByValue[value] += qty
		}

		changeAmount := receivedTotal - payload.TotalDue
		suggestion := suggestCashChange(changeAmount, availableByValue)

		valueToID := make(map[int64]int64)
		for id, value := range denominationValues {
			valueToID[value] = id
		}

		suggestionItems := make([]response, 0)
		for _, item := range suggestion.Items {
			denomID := valueToID[item.Value]
			if denomID <= 0 {
				continue
			}
			suggestionItems = append(suggestionItems, response{
				"denomination_id": denomID,
				"value":           item.Value,
				"quantity":        item.Quantity,
				"line_total":      item.LineTotal,
			})
		}

		writeJSON(w, http.StatusOK, response{
			"ok":             true,
			"total_due":      payload.TotalDue,
			"received_total": receivedTotal,
			"change_amount":  changeAmount,
			"suggestion": response{
				"exact":            suggestion.Exact,
				"allocated_amount": suggestion.AllocatedAmount,
				"remaining":        suggestion.Remaining,
				"pieces":           suggestion.Pieces,
				"items":            suggestionItems,
			},
			"received_breakdown": receivedBreakdown,
		})
	}
}

func loadDenominationValues(db *sql.DB) (map[int64]int64, error) {
	rows, err := db.Query(`SELECT id, value FROM cash_denominations`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	items := make(map[int64]int64)
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

func loadCashDrawerByValue(db *sql.DB) (map[int64]int64, error) {
	q := `
		SELECT cd.value, COALESCE(cdd.quantity, 0) AS quantity
		FROM cash_denominations cd
		LEFT JOIN cash_drawer_denominations cdd ON cdd.denomination_id = cd.id
	`

	rows, err := db.Query(q)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	items := make(map[int64]int64)
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

type changeItem struct {
	Value     int64
	Quantity  int64
	LineTotal int64
}

type changeSuggestion struct {
	Exact           bool
	AllocatedAmount int64
	Remaining       int64
	Pieces          int64
	Items           []changeItem
}

func suggestCashChange(amount int64, availableByValue map[int64]int64) changeSuggestion {
	if amount <= 0 {
		return changeSuggestion{Exact: true, AllocatedAmount: 0, Remaining: 0, Pieces: 0, Items: []changeItem{}}
	}

	values := make([]int64, 0, len(availableByValue))
	for value := range availableByValue {
		if value > 0 {
			values = append(values, value)
		}
	}
	sort.Slice(values, func(i, j int) bool { return values[i] > values[j] })

	remaining := amount
	items := make([]changeItem, 0)
	pieces := int64(0)
	allocated := int64(0)

	for _, value := range values {
		if remaining <= 0 {
			break
		}
		available := availableByValue[value]
		if available <= 0 {
			continue
		}

		needed := remaining / value
		if needed <= 0 {
			continue
		}
		qty := needed
		if qty > available {
			qty = available
		}
		if qty <= 0 {
			continue
		}

		lineTotal := qty * value
		remaining -= lineTotal
		allocated += lineTotal
		pieces += qty

		items = append(items, changeItem{Value: value, Quantity: qty, LineTotal: lineTotal})
	}

	return changeSuggestion{
		Exact:           remaining == 0,
		AllocatedAmount: allocated,
		Remaining:       remaining,
		Pieces:          pieces,
		Items:           items,
	}
}
