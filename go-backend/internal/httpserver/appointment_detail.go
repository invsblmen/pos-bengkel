package httpserver

import (
	"database/sql"
	"fmt"
	"net/http"
	"strings"
)

func appointmentDetailHandler(db *sql.DB) http.HandlerFunc {
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

		mechanics, err := queryAppointmentIndexMechanics(db)
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, response{"message": "failed to read mechanics"})
			return
		}

		writeJSON(w, http.StatusOK, response{
			"appointment": appointment,
			"mechanics":   mechanics,
		})
	}
}

func queryAppointmentDetail(db *sql.DB, appointmentID string) (response, error) {
	schema, err := detectAppointmentSchema(db)
	if err != nil {
		return nil, err
	}

	q := fmt.Sprintf(`
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
		WHERE a.id = ?
		LIMIT 1
	`, formatDateTimeExpr(db, schema.scheduledExpr), schema.specialtyExpr)

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

	if err := db.QueryRow(q, appointmentID).Scan(
		&id, &status, &mechanicID, &scheduledAt, &notes,
		&customerID, &customerName, &customerPhone,
		&vehicleID, &vehiclePlate, &vehicleBrand, &vehicleModel,
		&mechID, &mechName, &mechSpecialty,
	); err != nil {
		return nil, err
	}

	appointment := response{
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
		appointment["customer"] = response{
			"id":    customerID.Int64,
			"name":  nullString(customerName),
			"phone": nullString(customerPhone),
		}
	}
	if vehicleID.Valid {
		appointment["vehicle"] = response{
			"id":           vehicleID.Int64,
			"plate_number": nullString(vehiclePlate),
			"brand":        nullString(vehicleBrand),
			"model":        nullString(vehicleModel),
		}
	}
	if mechID.Valid {
		appointment["mechanic"] = response{
			"id":        mechID.Int64,
			"name":      nullString(mechName),
			"specialty": nullString(mechSpecialty),
		}
	}

	return appointment, nil
}
