package httpserver

import (
	"database/sql"
	"net/http"
	"strings"
)

func supplierDestroyHandler(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if db == nil {
			writeJSON(w, http.StatusServiceUnavailable, response{"message": "database is not configured"})
			return
		}

		id := strings.TrimSpace(r.PathValue("id"))
		if id == "" {
			writeJSON(w, http.StatusBadRequest, response{"message": "supplier id is required"})
			return
		}

		supplierID := parseInt64WithDefault(id)
		if supplierID <= 0 {
			writeJSON(w, http.StatusBadRequest, response{"message": "supplier id is required"})
			return
		}

		if ok, err := recordExists(db, "suppliers", supplierID); err != nil {
			writeJSON(w, http.StatusInternalServerError, response{"message": "failed to read supplier"})
			return
		} else if !ok {
			writeJSON(w, http.StatusNotFound, response{"message": "supplier not found"})
			return
		}

		result, err := db.Exec(`DELETE FROM suppliers WHERE id = ?`, supplierID)
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, response{"message": "failed to delete supplier"})
			return
		}

		rowsAffected, _ := result.RowsAffected()
		if rowsAffected == 0 {
			writeJSON(w, http.StatusNotFound, response{"message": "supplier not found"})
			return
		}

		writeJSON(w, http.StatusOK, response{
			"message":     "Supplier deleted successfully.",
			"supplier_id": supplierID,
		})
	}
}
