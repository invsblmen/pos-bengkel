package httpserver

import (
	"database/sql"
	"encoding/json"
	"errors"
	"net/http"
	"strconv"
	"strings"
	"time"
)

type appointmentStoreRequest struct {
	CustomerID  *int64  `json:"customer_id"`
	VehicleID   *int64  `json:"vehicle_id"`
	MechanicID  *int64  `json:"mechanic_id"`
	ScheduledAt string  `json:"scheduled_at"`
	Notes       *string `json:"notes"`
}

func appointmentStoreHandler(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if db == nil {
			writeJSON(w, http.StatusServiceUnavailable, response{"message": "database is not configured"})
			return
		}

		var payload appointmentStoreRequest
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

		mechanicID := strings.TrimSpace(int64ToString(*payload.MechanicID))
		mechanicName, err := queryMechanicName(db, mechanicID)
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

		existing, err := appointmentExistsAtSlot(db, *payload.MechanicID, scheduledAt)
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, response{"message": "failed to check appointment slot"})
			return
		}
		if existing {
			writeJSON(w, http.StatusConflict, response{
				"message": "Slot ini sudah dibooking.",
				"errors": response{
					"scheduled_at": []string{"Slot ini sudah dibooking."},
				},
			})
			return
		}

		result, err := db.Exec(`
			INSERT INTO appointments (customer_id, vehicle_id, mechanic_id, scheduled_at, status, notes, created_at, updated_at)
			VALUES (?, ?, ?, ?, 'scheduled', ?, ?, ?)
		`, nullableInt64(payload.CustomerID), nullableInt64(payload.VehicleID), *payload.MechanicID, scheduledAt, nullableString(payload.Notes), time.Now(), time.Now())
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, response{"message": "failed to create appointment"})
			return
		}

		id, err := result.LastInsertId()
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, response{"message": "failed to read created appointment id"})
			return
		}

		appointment := response{
			"id":           id,
			"customer_id":  nullableInt64(payload.CustomerID),
			"vehicle_id":   nullableInt64(payload.VehicleID),
			"mechanic_id":  *payload.MechanicID,
			"scheduled_at": scheduledAt.Format("2006-01-02 15:04:05"),
			"status":       "scheduled",
			"notes":        nullableString(payload.Notes),
			"mechanic": response{
				"id":   *payload.MechanicID,
				"name": mechanicName,
			},
		}

		writeJSON(w, http.StatusCreated, response{
			"message":     "Appointment berhasil dijadwalkan.",
			"appointment": appointment,
		})
	}
}

func parseAppointmentScheduledAt(raw string) (time.Time, error) {
	layouts := []string{
		"2006-01-02 15:04:05",
		time.RFC3339,
		"2006-01-02T15:04:05",
	}

	for _, layout := range layouts {
		if parsed, err := time.ParseInLocation(layout, raw, time.Local); err == nil {
			return parsed, nil
		}
	}

	return time.Time{}, errors.New("invalid scheduled_at")
}

func appointmentExistsAtSlot(db *sql.DB, mechanicID int64, scheduledAt time.Time) (bool, error) {
	var id int64
	err := db.QueryRow(`SELECT id FROM appointments WHERE mechanic_id = ? AND scheduled_at = ? LIMIT 1`, mechanicID, scheduledAt).Scan(&id)
	if err == sql.ErrNoRows {
		return false, nil
	}
	if err != nil {
		return false, err
	}
	return true, nil
}

func recordExists(db *sql.DB, table string, id int64) (bool, error) {
	var found int64
	err := db.QueryRow("SELECT id FROM "+table+" WHERE id = ? LIMIT 1", id).Scan(&found)
	if err == sql.ErrNoRows {
		return false, nil
	}
	if err != nil {
		return false, err
	}
	return true, nil
}

func nullableInt64(value *int64) any {
	if value == nil {
		return nil
	}
	return *value
}

func nullableString(value *string) any {
	if value == nil {
		return nil
	}
	return *value
}

func int64ToString(value int64) string {
	return strconv.FormatInt(value, 10)
}
