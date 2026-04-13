package httpserver

import (
	"database/sql"
	"fmt"
	"net/http"
	"strconv"
	"strings"
	"time"
)

func appointmentCalendarHandler(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if db == nil {
			writeJSON(w, http.StatusServiceUnavailable, response{"message": "database is not configured"})
			return
		}

		year, month := parseCalendarMonthYear(r)
		startDate := time.Date(year, time.Month(month), 1, 0, 0, 0, 0, time.Local)
		endDate := startDate.AddDate(0, 1, 0).Add(-time.Second)

		appointmentsByDate, err := queryCalendarAppointmentsByDate(db, startDate, endDate)
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, response{"message": "failed to read calendar appointments"})
			return
		}

		mechanics, err := queryAppointmentIndexMechanics(db)
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, response{"message": "failed to read mechanics"})
			return
		}

		calendarDays := buildCalendarDays(startDate, appointmentsByDate)

		writeJSON(w, http.StatusOK, response{
			"calendar_days": calendarDays,
			"current_date":  time.Now().Format(time.RFC3339),
			"year":          year,
			"month":         month,
			"mechanics":     mechanics,
		})
	}
}

func parseCalendarMonthYear(r *http.Request) (int, int) {
	now := time.Now()
	year := parseIntWithFallback(strings.TrimSpace(r.URL.Query().Get("year")), now.Year())
	month := parseIntWithFallback(strings.TrimSpace(r.URL.Query().Get("month")), int(now.Month()))

	if year < 1970 || year > 9999 {
		year = now.Year()
	}
	if month < 1 || month > 12 {
		month = int(now.Month())
	}

	return year, month
}

func parseIntWithFallback(raw string, fallback int) int {
	if raw == "" {
		return fallback
	}
	parsed, err := strconv.Atoi(raw)
	if err != nil {
		return fallback
	}
	return parsed
}

func queryCalendarAppointmentsByDate(db *sql.DB, startDate, endDate time.Time) (map[string][]response, error) {
	schema, err := detectAppointmentSchema(db)
	if err != nil {
		return nil, err
	}

	q := fmt.Sprintf(`
		SELECT a.id, a.status, a.mechanic_id,
		       %s AS scheduled_at,
		       %s AS scheduled_date,
		       c.name,
		       m.id, m.name
		FROM appointments a
		LEFT JOIN customers c ON c.id = a.customer_id
		LEFT JOIN mechanics m ON m.id = a.mechanic_id
		WHERE %s BETWEEN ? AND ?
		ORDER BY %s ASC, a.id ASC
	`, formatDateTimeExpr(db, schema.scheduledExpr), schema.scheduledDate, schema.scheduledExpr, schema.scheduledExpr)

	rows, err := db.Query(q, startDate.Format("2006-01-02 15:04:05"), endDate.Format("2006-01-02 15:04:05"))
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	items := map[string][]response{}
	for rows.Next() {
		var id int64
		var status sql.NullString
		var mechanicID sql.NullInt64
		var scheduledAt sql.NullString
		var scheduledDate sql.NullString
		var customerName sql.NullString
		var mechanicRefID sql.NullInt64
		var mechanicName sql.NullString

		if err := rows.Scan(&id, &status, &mechanicID, &scheduledAt, &scheduledDate, &customerName, &mechanicRefID, &mechanicName); err != nil {
			return nil, err
		}

		apt := response{
			"id":           id,
			"status":       nullString(status),
			"customer":     nil,
			"mechanic":     nil,
			"mechanic_id":  nullInt(mechanicID),
			"scheduled_at": stringOrNil(scheduledAt),
		}

		if customerName.Valid {
			apt["customer"] = response{"name": customerName.String}
		}
		if mechanicRefID.Valid {
			apt["mechanic"] = response{
				"id":   mechanicRefID.Int64,
				"name": nullString(mechanicName),
			}
		}

		key := ""
		if scheduledDate.Valid {
			key = scheduledDate.String
		}
		items[key] = append(items[key], apt)
	}

	if err := rows.Err(); err != nil {
		return nil, err
	}

	return items, nil
}

func buildCalendarDays(startDate time.Time, appointmentsByDate map[string][]response) []any {
	day := startDate
	endDate := startDate.AddDate(0, 1, 0).Add(-24 * time.Hour)

	result := make([]any, 0)
	for i := 0; i < int(day.Weekday()); i++ {
		result = append(result, nil)
	}

	for !day.After(endDate) {
		dateStr := day.Format("2006-01-02")
		result = append(result, response{
			"date":         dateStr,
			"day_num":      day.Day(),
			"appointments": appointmentsByDate[dateStr],
		})
		day = day.AddDate(0, 0, 1)
	}

	return result
}
