package httpserver

import (
	"database/sql"
	"errors"
	"net/http"
	"strings"
)

func serviceOrderDestroyHandler(db *sql.DB) http.HandlerFunc {
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

		tx, err := db.BeginTx(r.Context(), nil)
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, response{"message": "failed to start transaction"})
			return
		}
		defer func() { _ = tx.Rollback() }()

		var existingID int64
		if err := tx.QueryRow(`SELECT id FROM service_orders WHERE id = ? LIMIT 1`, orderID).Scan(&existingID); err != nil {
			if errors.Is(err, sql.ErrNoRows) {
				writeJSON(w, http.StatusNotFound, response{"message": "Service order not found."})
				return
			}

			writeJSON(w, http.StatusInternalServerError, response{"message": "failed to read service order"})
			return
		}

		if _, err := tx.Exec(`DELETE FROM voucher_usages WHERE source_type = 'App\\Models\\ServiceOrder' AND source_id = ?`, orderID); err != nil {
			writeJSON(w, http.StatusInternalServerError, response{"message": "failed to clear voucher usage"})
			return
		}

		result, err := tx.Exec(`DELETE FROM service_orders WHERE id = ?`, orderID)
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, response{"message": "failed to delete service order"})
			return
		}

		rowsAffected, _ := result.RowsAffected()
		if rowsAffected == 0 {
			writeJSON(w, http.StatusNotFound, response{"message": "Service order not found."})
			return
		}

		if err := tx.Commit(); err != nil {
			writeJSON(w, http.StatusInternalServerError, response{"message": "failed to commit transaction"})
			return
		}

		writeJSON(w, http.StatusOK, response{
			"message":  "Service order deleted.",
			"order_id": orderID,
		})
	}
}
