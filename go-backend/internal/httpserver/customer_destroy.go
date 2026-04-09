package httpserver

import (
	"database/sql"
	"net/http"
	"strings"
)

func customerDestroyHandler(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if db == nil {
			writeJSON(w, http.StatusServiceUnavailable, response{"message": "database is not configured"})
			return
		}

		customerID := strings.TrimSpace(r.PathValue("id"))
		if customerID == "" {
			writeJSON(w, http.StatusBadRequest, response{"message": "customer id is required"})
			return
		}

		id := parseInt64WithDefault(customerID)
		if id <= 0 {
			writeJSON(w, http.StatusBadRequest, response{"message": "customer id is required"})
			return
		}

		if ok, err := recordExists(db, "customers", id); err != nil {
			writeJSON(w, http.StatusInternalServerError, response{"message": "failed to read customer"})
			return
		} else if !ok {
			writeJSON(w, http.StatusNotFound, response{"message": "customer not found"})
			return
		}

		result, err := db.Exec(`DELETE FROM customers WHERE id = ?`, id)
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, response{"message": "failed to delete customer"})
			return
		}

		rowsAffected, _ := result.RowsAffected()
		if rowsAffected == 0 {
			writeJSON(w, http.StatusNotFound, response{"message": "customer not found"})
			return
		}

		writeJSON(w, http.StatusOK, response{
			"message":     "Pelanggan berhasil dihapus",
			"customer_id": id,
		})
	}
}
