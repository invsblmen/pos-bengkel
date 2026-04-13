package httpserver

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
	"time"

	"posbengkel/go-backend/internal/events"
)

type appointmentUpdateRequest struct {
	CustomerID  *int64  `json:"customer_id"`
	VehicleID   *int64  `json:"vehicle_id"`
	MechanicID  *int64  `json:"mechanic_id"`
	ScheduledAt string  `json:"scheduled_at"`
	Notes       *string `json:"notes"`
}

func appointmentUpdateHandler(db *sql.DB) http.HandlerFunc {
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

		var payload appointmentUpdateRequest
		if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
			writeJSON(w, http.StatusBadRequest, response{"message": "invalid json payload"})
			return
		}

		if payload.MechanicID == nil || payload.ScheduledAt == "" {
			writeJSON(w, http.StatusUnprocessableEntity, response{
				"message": "mechanic_id and scheduled_at are required",
				"errors": response{
					"mechanic_id":  []string{"mechanic_id is required"},
					"scheduled_at": []string{"scheduled_at is required"},
				},
			})
			return
		}

		scheduledAt, err := parseAppointmentScheduledAt(payload.ScheduledAt)
		if err != nil {
			writeJSON(w, http.StatusUnprocessableEntity, response{
				"message": "invalid scheduled_at",
				"errors": response{
					"scheduled_at": []string{"invalid scheduled_at"},
				},
			})
			return
		}

		if payload.CustomerID != nil {
			if ok, err := recordExists(db, "customers", *payload.CustomerID); err != nil {
				writeJSON(w, http.StatusInternalServerError, response{"message": "failed to read customer"})
				return
			} else if !ok {
				writeJSON(w, http.StatusUnprocessableEntity, response{
					"message": "customer not found",
					"errors": response{
						"customer_id": []string{"customer id is invalid"},
					},
				})
				return
			}
		}

		if payload.VehicleID != nil {
			if ok, err := recordExists(db, "vehicles", *payload.VehicleID); err != nil {
				writeJSON(w, http.StatusInternalServerError, response{"message": "failed to read vehicle"})
				return
			} else if !ok {
				writeJSON(w, http.StatusUnprocessableEntity, response{
					"message": "vehicle not found",
					"errors": response{
						"vehicle_id": []string{"vehicle id is invalid"},
					},
				})
				return
			}
		}

		var existingCustomerID sql.NullInt64
		var existingVehicleID sql.NullInt64
		var existingMechanicID int64
		var existingScheduledAtRaw string
		var existingStatus string
		var existingNotes sql.NullString
		schema, err := detectAppointmentSchema(db)
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, response{"message": "failed to inspect appointment schema"})
			return
		}

		loadQuery := fmt.Sprintf(`
			SELECT customer_id, vehicle_id, mechanic_id,
			       %s, status, notes
			FROM appointments
			WHERE id = ?
			LIMIT 1
		`, schema.scheduledExpr)
		if err := db.QueryRow(loadQuery, id).Scan(&existingCustomerID, &existingVehicleID, &existingMechanicID, &existingScheduledAtRaw, &existingStatus, &existingNotes); err != nil {
			if err == sql.ErrNoRows {
				writeJSON(w, http.StatusNotFound, response{"message": "Appointment not found."})
				return
			}

			writeJSON(w, http.StatusInternalServerError, response{"message": "failed to read appointment"})
			return
		}

		existingScheduledAt, err := parseAppointmentScheduledAt(existingScheduledAtRaw)
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, response{"message": "failed to read appointment"})
			return
		}

		if existingMechanicID != *payload.MechanicID || !existingScheduledAt.Equal(scheduledAt) {
			var conflictingID int64
			conflictQuery := fmt.Sprintf(`
				SELECT id
				FROM appointments
				WHERE mechanic_id = ?
				  AND %s = ?
				  AND id != ?
				LIMIT 1
			`, schema.scheduledColumn)
			err := db.QueryRow(conflictQuery, *payload.MechanicID, scheduledAt, id).Scan(&conflictingID)
			if err == nil {
				writeJSON(w, http.StatusConflict, response{
					"message": "Slot ini sudah dibooking mekanik lain.",
					"errors": response{
						"scheduled_at": []string{"Slot ini sudah dibooking mekanik lain."},
					},
				})
				return
			}
			if err != sql.ErrNoRows {
				writeJSON(w, http.StatusInternalServerError, response{"message": "failed to check appointment slot"})
				return
			}
		}

		updateAssignments := []string{
			"customer_id = ?",
			"vehicle_id = ?",
			"mechanic_id = ?",
			fmt.Sprintf("%s = ?", schema.scheduledColumn),
			"notes = ?",
			"updated_at = ?",
		}
		updateArgs := []any{
			nullableInt64(payload.CustomerID),
			nullableInt64(payload.VehicleID),
			*payload.MechanicID,
			scheduledAt,
			nullableString(payload.Notes),
			time.Now(),
		}
		if schema.hasScheduledEnd {
			updateAssignments = append(updateAssignments, "scheduled_end_at = ?")
			updateArgs = append(updateArgs, scheduledAt.Add(2*time.Hour))
		}
		if schema.hasStartAt && schema.scheduledColumn != "scheduled_start_at" {
			updateAssignments = append(updateAssignments, "scheduled_start_at = ?")
			updateArgs = append(updateArgs, scheduledAt)
		}
		if schema.hasServiceType {
			updateAssignments = append(updateAssignments, "service_type = COALESCE(service_type, ?)")
			updateArgs = append(updateArgs, "general_service")
		}
		if schema.scheduledColumn != "scheduled_at" && schema.hasScheduledAt {
			updateAssignments = append(updateAssignments, "scheduled_at = ?")
			updateArgs = append(updateArgs, scheduledAt)
		}
		updateArgs = append(updateArgs, id)

		updateQuery := fmt.Sprintf(`
			UPDATE appointments
			SET %s
			WHERE id = ?
		`, strings.Join(updateAssignments, ", "))
		result, err := db.Exec(updateQuery, updateArgs...)
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, response{"message": "failed to update appointment"})
			return
		}

		rowsAffected, _ := result.RowsAffected()
		if rowsAffected == 0 {
			writeJSON(w, http.StatusNotFound, response{"message": "Appointment not found."})
			return
		}

		mechanicName, err := queryMechanicName(db, int64ToString(*payload.MechanicID))
		if err == sql.ErrNoRows {
			writeJSON(w, http.StatusUnprocessableEntity, response{
				"message": "mechanic not found",
				"errors": response{
					"mechanic_id": []string{"mechanic id is invalid"},
				},
			})
			return
		}
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, response{"message": "failed to read mechanic"})
			return
		}

		writeJSON(w, http.StatusOK, response{
			"message": "Appointment berhasil diperbarui.",
			"appointment": response{
				"id":           id,
				"customer_id":  nullableInt64(payload.CustomerID),
				"vehicle_id":   nullableInt64(payload.VehicleID),
				"mechanic_id":  *payload.MechanicID,
				"scheduled_at": scheduledAt.Format("2006-01-02 15:04:05"),
				"status":       existingStatus,
				"notes":        nullableString(payload.Notes),
				"mechanic": response{
					"id":   *payload.MechanicID,
					"name": mechanicName,
				},
			},
		})

		EmitEvent(events.NewEvent(events.EventAppointmentUpdated, events.DomainAppointment).
			WithID(appointmentID).
			WithAction("updated").
			WithData(response{
				"status":       existingStatus,
				"scheduled_at": scheduledAt.Format("2006-01-02 15:04:05"),
			}))
	}
}
