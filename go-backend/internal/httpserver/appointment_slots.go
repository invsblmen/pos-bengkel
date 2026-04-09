package httpserver

import (
	"database/sql"
	"net/http"
	"strconv"
	"strings"
	"time"
)

func appointmentSlotsHandler(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if db == nil {
			writeJSON(w, http.StatusServiceUnavailable, response{"message": "database is not configured"})
			return
		}

		mechanicID := strings.TrimSpace(r.URL.Query().Get("mechanic_id"))
		dateRaw := strings.TrimSpace(r.URL.Query().Get("date"))
		if mechanicID == "" || dateRaw == "" {
			writeJSON(w, http.StatusBadRequest, response{"message": "mechanic_id and date are required"})
			return
		}

		dateValue, err := time.Parse("2006-01-02", dateRaw)
		if err != nil {
			writeJSON(w, http.StatusBadRequest, response{"message": "invalid date"})
			return
		}

		mechanicName, err := queryMechanicName(db, mechanicID)
		if err == sql.ErrNoRows {
			writeJSON(w, http.StatusNotFound, response{"message": "mechanic not found"})
			return
		}
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, response{"message": "failed to read mechanic"})
			return
		}

		existingAppointments, err := queryAppointmentsForMechanicDate(db, mechanicID, dateValue)
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, response{"message": "failed to read appointments"})
			return
		}

		availableSlots := buildAvailableSlots(dateValue, existingAppointments)

		writeJSON(w, http.StatusOK, response{
			"available_slots": availableSlots,
			"mechanic_name":   mechanicName,
		})
	}
}

func queryMechanicName(db *sql.DB, mechanicID string) (string, error) {
	var name sql.NullString
	if err := db.QueryRow(`SELECT name FROM mechanics WHERE id = ? LIMIT 1`, mechanicID).Scan(&name); err != nil {
		return "", err
	}
	return stringFromNull(name), nil
}

func queryAppointmentsForMechanicDate(db *sql.DB, mechanicID string, dateValue time.Time) ([]time.Time, error) {
	const q = `
		SELECT scheduled_at
		FROM appointments
		WHERE mechanic_id = ?
		  AND DATE(scheduled_at) = ?
	`

	rows, err := db.Query(q, mechanicID, dateValue.Format("2006-01-02"))
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	result := make([]time.Time, 0)
	for rows.Next() {
		var scheduledAt time.Time
		if err := rows.Scan(&scheduledAt); err != nil {
			return nil, err
		}
		result = append(result, scheduledAt)
	}

	return result, rows.Err()
}

func buildAvailableSlots(dateValue time.Time, existingAppointments []time.Time) []response {
	const (
		workStart    = 9
		workEnd      = 17
		slotDuration = 2
	)

	slots := make([]response, 0)
	for hour := workStart; hour < workEnd; hour += slotDuration {
		slotStart := time.Date(dateValue.Year(), dateValue.Month(), dateValue.Day(), hour, 0, 0, 0, dateValue.Location())
		slotEnd := slotStart.Add(time.Duration(slotDuration) * time.Hour)

		booked := false
		for _, appointmentStart := range existingAppointments {
			appointmentEnd := appointmentStart.Add(2 * time.Hour)
			if !(slotEnd.Before(appointmentStart) || slotStart.After(appointmentEnd) || slotEnd.Equal(appointmentStart) || slotStart.Equal(appointmentEnd)) {
				booked = true
				break
			}
		}

		if booked {
			continue
		}

		slots = append(slots, response{
			"time":      slotStart.Format("15:04"),
			"display":   slotStart.Format("15:04") + " - " + slotEnd.Format("15:04"),
			"timestamp": slotStart.Format("2006-01-02 15:04:05"),
		})
	}

	return slots
}

func stringFromNull(v sql.NullString) string {
	if v.Valid {
		return v.String
	}
	return ""
}

func parseInt64WithFallback(raw string, fallback int64) int64 {
	parsed, err := strconv.ParseInt(strings.TrimSpace(raw), 10, 64)
	if err != nil {
		return fallback
	}
	return parsed
}
