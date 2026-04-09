package httpserver

import (
	"database/sql"
	"fmt"
	"net/http"
	"strings"
	"time"
)

func appointmentExportHandler(db *sql.DB) http.HandlerFunc {
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

		appointment, err := queryAppointmentDetail(db, appointmentID)
		if err == sql.ErrNoRows {
			writeJSON(w, http.StatusNotFound, response{"message": "Appointment not found."})
			return
		}
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, response{"message": "failed to read appointment"})
			return
		}

		ics := buildAppointmentICS(appointment)
		id := fmt.Sprint(appointment["id"])
		if id == "" {
			id = appointmentID
		}

		w.Header().Set("Content-Type", "text/calendar")
		w.Header().Set("Content-Disposition", fmt.Sprintf("attachment; filename=\"appointment_%s.ics\"", id))
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte(ics))
	}
}

func buildAppointmentICS(appointment response) string {
	appointmentID := fmt.Sprint(appointment["id"])
	scheduledAt := strings.TrimSpace(fmt.Sprint(appointment["scheduled_at"]))
	parsedAt, _ := time.Parse("2006-01-02 15:04:05", scheduledAt)
	if parsedAt.IsZero() {
		parsedAt = time.Now()
	}

	endAt := parsedAt.Add(2 * time.Hour)
	customerName := "No Customer"
	if customer, ok := appointment["customer"].(response); ok {
		if name, exists := customer["name"]; exists && strings.TrimSpace(fmt.Sprint(name)) != "" {
			customerName = fmt.Sprint(name)
		}
	}

	vehiclePlate := ""
	if vehicle, ok := appointment["vehicle"].(response); ok {
		vehiclePlate = strings.TrimSpace(fmt.Sprint(vehicle["plate_number"]))
	}

	mechanicName := ""
	if mechanic, ok := appointment["mechanic"].(response); ok {
		mechanicName = strings.TrimSpace(fmt.Sprint(mechanic["name"]))
	}

	notes := strings.ReplaceAll(fmt.Sprint(appointment["notes"]), "\n", " ")

	var b strings.Builder
	b.WriteString("BEGIN:VCALENDAR\r\n")
	b.WriteString("VERSION:2.0\r\n")
	b.WriteString("PRODID:-//POS Bengkel//Calendar//EN\r\n")
	b.WriteString("CALSCALE:GREGORIAN\r\n")
	b.WriteString("BEGIN:VEVENT\r\n")
	b.WriteString(fmt.Sprintf("UID:%s@pos-bengkel.local\r\n", appointmentID))
	b.WriteString(fmt.Sprintf("DTSTAMP:%s\r\n", time.Now().UTC().Format("20060102T150405Z")))
	b.WriteString(fmt.Sprintf("DTSTART:%s\r\n", parsedAt.Format("20060102T150405")))
	b.WriteString(fmt.Sprintf("DTEND:%s\r\n", endAt.Format("20060102T150405")))
	b.WriteString(fmt.Sprintf("SUMMARY:Service Appointment - %s\r\n", customerName))
	b.WriteString(fmt.Sprintf("DESCRIPTION:%s\r\n", notes))
	b.WriteString(fmt.Sprintf("LOCATION:%s\r\n", vehiclePlate))
	b.WriteString(fmt.Sprintf("ORGANIZER;CN=%s:mailto:info@pos-bengkel.local\r\n", mechanicName))
	b.WriteString("STATUS:CONFIRMED\r\n")
	b.WriteString("END:VEVENT\r\n")
	b.WriteString("END:VCALENDAR\r\n")

	return b.String()
}
