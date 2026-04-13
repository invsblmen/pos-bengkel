package httpserver

import (
	"database/sql"
	"fmt"
	"math"
	"net/http"
	"net/url"
	"strings"
	"time"
)

type appointmentIndexParams struct {
	Status     string
	MechanicID string
	DateFrom   string
	DateTo     string
	Search     string
	PerPage    int
	Page       int
}

func appointmentIndexHandler(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if db == nil {
			writeJSON(w, http.StatusServiceUnavailable, response{"message": "database is not configured"})
			return
		}

		params := parseAppointmentIndexParams(r)
		appointments, err := queryAppointmentIndexPage(db, r.URL.Query(), params)
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, response{"message": "failed to read appointments"})
			return
		}

		stats, err := queryAppointmentIndexStats(db)
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, response{"message": "failed to read appointment stats"})
			return
		}

		mechanics, err := queryAppointmentIndexMechanics(db)
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, response{"message": "failed to read mechanics"})
			return
		}

		writeJSON(w, http.StatusOK, response{
			"appointments": appointments,
			"stats":        stats,
			"mechanics":    mechanics,
			"filters": response{
				"search":      emptyStringToNil(params.Search),
				"status":      emptyStringToNil(params.Status),
				"date_from":   emptyStringToNil(params.DateFrom),
				"date_to":     emptyStringToNil(params.DateTo),
				"mechanic_id": emptyStringToNil(params.MechanicID),
			},
		})
	}
}

func parseAppointmentIndexParams(r *http.Request) appointmentIndexParams {
	q := r.URL.Query()
	return appointmentIndexParams{
		Status:     strings.TrimSpace(q.Get("status")),
		MechanicID: strings.TrimSpace(q.Get("mechanic_id")),
		DateFrom:   strings.TrimSpace(q.Get("date_from")),
		DateTo:     strings.TrimSpace(q.Get("date_to")),
		Search:     strings.TrimSpace(q.Get("search")),
		PerPage:    parsePositiveInt(q.Get("per_page"), 20),
		Page:       parsePositiveInt(q.Get("page"), 1),
	}
}

func queryAppointmentIndexPage(db *sql.DB, query url.Values, params appointmentIndexParams) (response, error) {
	schema, err := detectAppointmentSchema(db)
	if err != nil {
		return nil, err
	}

	if params.PerPage > 100 {
		params.PerPage = 100
	}

	whereClause, args := buildAppointmentIndexWhereClauseWithColumn(params, schema.scheduledDate)
	countQuery := `
		SELECT COUNT(*)
		FROM appointments a
		LEFT JOIN customers c ON c.id = a.customer_id
		LEFT JOIN vehicles v ON v.id = a.vehicle_id
	` + whereClause

	var total int64
	if err := db.QueryRow(countQuery, args...).Scan(&total); err != nil {
		return nil, err
	}

	lastPage := 1
	if total > 0 {
		lastPage = int(math.Ceil(float64(total) / float64(params.PerPage)))
	}

	currentPage := params.Page
	if currentPage < 1 {
		currentPage = 1
	}
	if currentPage > lastPage {
		currentPage = lastPage
	}

	dataQuery := fmt.Sprintf(`
		SELECT a.id, a.status, a.mechanic_id,
		       %s AS scheduled_at,
		       a.notes,
		       c.id, c.name, c.phone,
		       v.id, v.plate_number, v.brand, v.model,
		       m.id, m.name, %s
		FROM appointments a
		LEFT JOIN customers c ON c.id = a.customer_id
		LEFT JOIN vehicles v ON v.id = a.vehicle_id
		LEFT JOIN mechanics m ON m.id = a.mechanic_id
	`, formatDateTimeExpr(db, schema.scheduledExpr), schema.specialtyExpr) + whereClause + `
		ORDER BY ` + schema.scheduledExpr + ` ASC, a.id ASC
		LIMIT ? OFFSET ?
	`

	queryArgs := append([]any{}, args...)
	queryArgs = append(queryArgs, params.PerPage, (currentPage-1)*params.PerPage)

	rows, err := db.Query(dataQuery, queryArgs...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	items := make([]response, 0)
	for rows.Next() {
		var id int64
		var status sql.NullString
		var mechanicID sql.NullInt64
		var scheduledAt sql.NullString
		var notes sql.NullString

		var customerID sql.NullInt64
		var customerName sql.NullString
		var customerPhone sql.NullString

		var vehicleID sql.NullInt64
		var vehiclePlate sql.NullString
		var vehicleBrand sql.NullString
		var vehicleModel sql.NullString

		var mechID sql.NullInt64
		var mechName sql.NullString
		var mechSpecialty sql.NullString

		if err := rows.Scan(
			&id, &status, &mechanicID, &scheduledAt, &notes,
			&customerID, &customerName, &customerPhone,
			&vehicleID, &vehiclePlate, &vehicleBrand, &vehicleModel,
			&mechID, &mechName, &mechSpecialty,
		); err != nil {
			return nil, err
		}

		item := response{
			"id":           id,
			"status":       nullString(status),
			"mechanic_id":  nullInt(mechanicID),
			"scheduled_at": stringOrNil(scheduledAt),
			"notes":        nullString(notes),
			"customer":     nil,
			"vehicle":      nil,
			"mechanic":     nil,
		}

		if customerID.Valid {
			item["customer"] = response{
				"id":    customerID.Int64,
				"name":  nullString(customerName),
				"phone": nullString(customerPhone),
			}
		}
		if vehicleID.Valid {
			item["vehicle"] = response{
				"id":           vehicleID.Int64,
				"plate_number": nullString(vehiclePlate),
				"brand":        nullString(vehicleBrand),
				"model":        nullString(vehicleModel),
			}
		}
		if mechID.Valid {
			item["mechanic"] = response{
				"id":        mechID.Int64,
				"name":      nullString(mechName),
				"specialty": nullString(mechSpecialty),
			}
		}

		items = append(items, item)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}

	from, to := paginationBounds(total, currentPage, params.PerPage)

	return response{
		"current_page": currentPage,
		"data":         items,
		"from":         from,
		"last_page":    lastPage,
		"links":        buildVehicleIndexLinks("/appointments", query, currentPage, lastPage),
		"per_page":     params.PerPage,
		"to":           to,
		"total":        total,
	}, nil
}

func buildAppointmentIndexWhereClause(params appointmentIndexParams) (string, []any) {
	return buildAppointmentIndexWhereClauseWithColumn(params, "DATE(a.scheduled_at)")
}

func buildAppointmentIndexWhereClauseWithColumn(params appointmentIndexParams, scheduledDateExpr string) (string, []any) {
	clauses := make([]string, 0)
	args := make([]any, 0)

	if params.Status != "" && params.Status != "all" {
		clauses = append(clauses, "a.status = ?")
		args = append(args, params.Status)
	}
	if params.MechanicID != "" && params.MechanicID != "all" {
		clauses = append(clauses, "a.mechanic_id = ?")
		args = append(args, params.MechanicID)
	}
	if params.DateFrom != "" {
		clauses = append(clauses, scheduledDateExpr+" >= ?")
		args = append(args, params.DateFrom)
	}
	if params.DateTo != "" {
		clauses = append(clauses, scheduledDateExpr+" <= ?")
		args = append(args, params.DateTo)
	}
	if params.Search != "" {
		clauses = append(clauses, "(COALESCE(c.name, '') LIKE ? OR COALESCE(c.phone, '') LIKE ? OR COALESCE(v.plate_number, '') LIKE ?)")
		search := "%" + params.Search + "%"
		args = append(args, search, search, search)
	}

	if len(clauses) == 0 {
		return "", args
	}

	return " WHERE " + strings.Join(clauses, " AND "), args
}

func queryAppointmentIndexStats(db *sql.DB) (response, error) {
	schema, err := detectAppointmentSchema(db)
	if err != nil {
		return nil, err
	}

	todayDate := time.Now().Format("2006-01-02")
	q := fmt.Sprintf(`
		SELECT
			SUM(CASE WHEN status = 'scheduled' THEN 1 ELSE 0 END) AS scheduled,
			SUM(CASE WHEN status = 'confirmed' THEN 1 ELSE 0 END) AS confirmed,
			SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) AS completed,
			SUM(CASE WHEN status = 'cancelled' THEN 1 ELSE 0 END) AS cancelled,
			SUM(CASE WHEN %s = ? THEN 1 ELSE 0 END) AS today
		FROM appointments
	`, schema.scheduledDate)

	var scheduled sql.NullInt64
	var confirmed sql.NullInt64
	var completed sql.NullInt64
	var cancelled sql.NullInt64
	var today sql.NullInt64
	if err := db.QueryRow(q, todayDate).Scan(&scheduled, &confirmed, &completed, &cancelled, &today); err != nil {
		return nil, err
	}

	return response{
		"scheduled": intOrDefault(scheduled, 0),
		"confirmed": intOrDefault(confirmed, 0),
		"completed": intOrDefault(completed, 0),
		"cancelled": intOrDefault(cancelled, 0),
		"today":     intOrDefault(today, 0),
	}, nil
}

func queryAppointmentIndexMechanics(db *sql.DB) ([]response, error) {
	specialtyColumn := "specialty"
	if hasSpecialty, err := tableColumnExists(db, "mechanics", "specialty"); err == nil && !hasSpecialty {
		if hasSpecialization, innerErr := tableColumnExists(db, "mechanics", "specialization"); innerErr == nil && hasSpecialization {
			specialtyColumn = "specialization"
		}
	}

	rows, err := db.Query("SELECT id, name, " + specialtyColumn + " FROM mechanics ORDER BY name ASC")
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	items := make([]response, 0)
	for rows.Next() {
		var id int64
		var name sql.NullString
		var specialty sql.NullString
		if err := rows.Scan(&id, &name, &specialty); err != nil {
			return nil, err
		}
		items = append(items, response{
			"id":        id,
			"name":      nullString(name),
			"specialty": nullString(specialty),
		})
	}

	return items, rows.Err()
}

func emptyStringToNil(v string) any {
	if strings.TrimSpace(v) == "" {
		return nil
	}
	return v
}
