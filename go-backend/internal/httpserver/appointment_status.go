package httpserver

import (
	"database/sql"
	"encoding/json"
	"net/http"
	"strconv"
	"strings"
)

var allowedAppointmentStatuses = map[string]bool{
	"scheduled": true,
	"confirmed": true,
	"cancelled": true,
	"completed": true,
}

type appointmentStatusUpdateRequest struct {
	Status string `json:"status"`
}

func appointmentStatusHandler(db *sql.DB) http.HandlerFunc {
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

		var payload appointmentStatusUpdateRequest
		if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
			writeJSON(w, http.StatusBadRequest, response{"message": "invalid json payload"})
			return
		}

		payload.Status = strings.TrimSpace(payload.Status)
		if !allowedAppointmentStatuses[payload.Status] {
			writeJSON(w, http.StatusUnprocessableEntity, response{
				"message": "status is invalid",
				"errors": response{
					"status": []string{"The selected status is invalid."},
				},
			})
			return
		}

		if ok, err := recordExists(db, "appointments", parseInt64WithDefault(appointmentID)); err != nil {
			writeJSON(w, http.StatusInternalServerError, response{"message": "failed to read appointment"})
			return
		} else if !ok {
			writeJSON(w, http.StatusNotFound, response{"message": "Appointment not found."})
			return
		}

		result, err := db.Exec(`UPDATE appointments SET status = ?, updated_at = NOW() WHERE id = ?`, payload.Status, appointmentID)
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, response{"message": "failed to update appointment"})
			return
		}

		rowsAffected, _ := result.RowsAffected()
		if rowsAffected == 0 {
			writeJSON(w, http.StatusNotFound, response{"message": "Appointment not found."})
			return
		}

		writeJSON(w, http.StatusOK, response{
			"message": "Appointment updated.",
			"appointment": response{
				"id":     parseInt64WithDefault(appointmentID),
				"status": payload.Status,
			},
		})
	}
}

func parseInt64WithDefault(raw string) int64 {
	parsed, err := strconv.ParseInt(strings.TrimSpace(raw), 10, 64)
	if err != nil {
		return 0
	}
	return parsed
}
