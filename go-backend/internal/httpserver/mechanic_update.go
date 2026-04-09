package httpserver

import (
	"database/sql"
	"encoding/json"
	"net/http"
	"strings"
	"time"
)

type mechanicUpdateRequest struct {
	Name                 string `json:"name"`
	Phone                string `json:"phone"`
	EmployeeNumber       string `json:"employee_number"`
	Notes                string `json:"notes"`
	HourlyRate           *int64 `json:"hourly_rate"`
	CommissionPercentage any    `json:"commission_percentage"`
}

func mechanicUpdateHandler(db *sql.DB) http.HandlerFunc {
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

		var payload mechanicUpdateRequest
		if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
			writeJSON(w, http.StatusBadRequest, response{"message": "invalid json payload"})
			return
		}

		name := strings.TrimSpace(payload.Name)
		if name == "" {
			writeJSON(w, http.StatusUnprocessableEntity, response{
				"message": "The given data was invalid.",
				"errors": response{
					"name": []string{"Nama mechanic wajib diisi."},
				},
			})
			return
		}

		commission, err := mechanicStoreParseCommission(payload.CommissionPercentage)
		if err != nil || commission < 0 || commission > 100 {
			writeJSON(w, http.StatusUnprocessableEntity, response{
				"message": "The given data was invalid.",
				"errors": response{
					"commission_percentage": []string{"Komisi harus antara 0 sampai 100."},
				},
			})
			return
		}

		hourlyRate := int64(0)
		if payload.HourlyRate != nil {
			hourlyRate = *payload.HourlyRate
			if hourlyRate < 0 {
				writeJSON(w, http.StatusUnprocessableEntity, response{
					"message": "The given data was invalid.",
					"errors": response{
						"hourly_rate": []string{"Tarif per jam tidak boleh negatif."},
					},
				})
				return
			}
		}

		_, err = db.Exec(`
			UPDATE mechanics
			SET name = ?, phone = ?, employee_number = ?, notes = ?, hourly_rate = ?, commission_percentage = ?, updated_at = ?
			WHERE id = ?
		`,
			name,
			mechanicStoreNullableString(payload.Phone),
			mechanicStoreNullableString(payload.EmployeeNumber),
			mechanicStoreNullableString(payload.Notes),
			hourlyRate,
			commission,
			time.Now(),
			mechanicID,
		)
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, response{"message": "failed to update mechanic"})
			return
		}

		writeJSON(w, http.StatusOK, response{
			"message": "Mechanic updated successfully.",
			"mechanic": response{
				"id":                    mechanicID,
				"name":                  name,
				"phone":                 mechanicStoreNullableString(payload.Phone),
				"employee_number":       mechanicStoreNullableString(payload.EmployeeNumber),
				"notes":                 mechanicStoreNullableString(payload.Notes),
				"hourly_rate":           hourlyRate,
				"commission_percentage": commission,
			},
		})
	}
}
