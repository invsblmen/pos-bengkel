package httpserver

import (
	"database/sql"
	"encoding/json"
	"net/http"
	"strconv"
	"strings"
	"time"
)

type mechanicStoreRequest struct {
	Name                 string `json:"name"`
	Phone                string `json:"phone"`
	EmployeeNumber       string `json:"employee_number"`
	Notes                string `json:"notes"`
	HourlyRate           *int64 `json:"hourly_rate"`
	CommissionPercentage any    `json:"commission_percentage"`
}

func mechanicStoreHandler(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if db == nil {
			writeJSON(w, http.StatusServiceUnavailable, response{"message": "database is not configured"})
			return
		}

		var payload mechanicStoreRequest
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

		now := time.Now()
		res, err := db.Exec(`
			INSERT INTO mechanics (name, phone, employee_number, notes, hourly_rate, commission_percentage, created_at, updated_at)
			VALUES (?, ?, ?, ?, ?, ?, ?, ?)
		`,
			name,
			mechanicStoreNullableString(payload.Phone),
			mechanicStoreNullableString(payload.EmployeeNumber),
			mechanicStoreNullableString(payload.Notes),
			hourlyRate,
			commission,
			now,
			now,
		)
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, response{"message": "failed to create mechanic"})
			return
		}

		id, err := res.LastInsertId()
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, response{"message": "failed to read created mechanic id"})
			return
		}

		writeJSON(w, http.StatusOK, response{
			"message": "Mechanic created successfully.",
			"mechanic": response{
				"id":                    id,
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

func mechanicStoreParseCommission(value any) (float64, error) {
	if value == nil {
		return 0, nil
	}

	switch v := value.(type) {
	case float64:
		return v, nil
	case string:
		trimmed := strings.TrimSpace(v)
		if trimmed == "" {
			return 0, nil
		}
		return strconv.ParseFloat(trimmed, 64)
	default:
		return 0, nil
	}
}

func mechanicStoreNullableString(value string) any {
	trimmed := strings.TrimSpace(value)
	if trimmed == "" {
		return nil
	}
	return trimmed
}
