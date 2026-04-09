package httpserver

import (
	"database/sql"
	"net/http"
	"strings"
)

func mechanicDestroyHandler(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if db == nil {
			writeJSON(w, http.StatusServiceUnavailable, response{"message": "database is not configured"})
			return
		}

		id := strings.TrimSpace(r.PathValue("id"))
		if id == "" {
			writeJSON(w, http.StatusBadRequest, response{"message": "mechanic id is required"})
			return
		}

		mechanicID := parseInt64WithDefault(id)
		if mechanicID <= 0 {
			writeJSON(w, http.StatusBadRequest, response{"message": "mechanic id is required"})
			return
		}

		if ok, err := recordExists(db, "mechanics", mechanicID); err != nil {
			writeJSON(w, http.StatusInternalServerError, response{"message": "failed to read mechanic"})
			return
		} else if !ok {
			writeJSON(w, http.StatusNotFound, response{"message": "mechanic not found"})
			return
		}

		result, err := db.Exec(`DELETE FROM mechanics WHERE id = ?`, mechanicID)
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, response{"message": "failed to delete mechanic"})
			return
		}

		rowsAffected, _ := result.RowsAffected()
		if rowsAffected == 0 {
			writeJSON(w, http.StatusNotFound, response{"message": "mechanic not found"})
			return
		}

		writeJSON(w, http.StatusOK, response{
			"message":     "Mechanic deleted successfully.",
			"mechanic_id": mechanicID,
		})
	}
}
