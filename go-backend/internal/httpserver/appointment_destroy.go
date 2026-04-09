package httpserver

import (
	"database/sql"
	"net/http"
	"strings"
)

func appointmentDestroyHandler(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if db == nil {
			writeJSON(w, http.StatusServiceUnavailable, response{"message": "database is not configured"})
			return
		}

		appointmentID := strings.TrimSpace(r.PathValue("id"))
		if appointmentID == "" {
			writeJSON(w, http.StatusBadRequest, response{"message": "appointment id is required"})
			return
		}

		id := parseInt64WithDefault(appointmentID)
		if id == 0 {
			writeJSON(w, http.StatusBadRequest, response{"message": "appointment id is required"})
			return
		}

		if ok, err := recordExists(db, "appointments", id); err != nil {
			writeJSON(w, http.StatusInternalServerError, response{"message": "failed to read appointment"})
			return
		} else if !ok {
			writeJSON(w, http.StatusNotFound, response{"message": "Appointment not found."})
			return
		}

		result, err := db.Exec(`DELETE FROM appointments WHERE id = ?`, id)
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, response{"message": "failed to delete appointment"})
			return
		}

		rowsAffected, _ := result.RowsAffected()
		if rowsAffected == 0 {
			writeJSON(w, http.StatusNotFound, response{"message": "Appointment not found."})
			return
		}

		writeJSON(w, http.StatusOK, response{
			"message":        "Appointment cancelled.",
			"appointment_id": id,
		})
	}
}
