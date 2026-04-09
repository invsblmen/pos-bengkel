package httpserver

import (
	"database/sql"
	"encoding/json"
	"net/http"
	"net/mail"
	"strings"
	"time"
)

type supplierStoreRequest struct {
	Name          string `json:"name"`
	Phone         string `json:"phone"`
	Email         string `json:"email"`
	Address       string `json:"address"`
	ContactPerson string `json:"contact_person"`
}

func supplierStoreHandler(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if db == nil {
			writeJSON(w, http.StatusServiceUnavailable, response{"message": "database is not configured"})
			return
		}

		var payload supplierStoreRequest
		if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
			writeJSON(w, http.StatusBadRequest, response{"message": "invalid json payload"})
			return
		}

		name := strings.TrimSpace(payload.Name)
		phone := strings.TrimSpace(payload.Phone)
		email := strings.TrimSpace(payload.Email)
		address := strings.TrimSpace(payload.Address)
		contactPerson := strings.TrimSpace(payload.ContactPerson)

		if name == "" {
			writeJSON(w, http.StatusUnprocessableEntity, response{
				"message": "The given data was invalid.",
				"errors": response{
					"name": []string{"Nama supplier wajib diisi."},
				},
			})
			return
		}

		if email != "" {
			if _, err := mail.ParseAddress(email); err != nil {
				writeJSON(w, http.StatusUnprocessableEntity, response{
					"message": "The given data was invalid.",
					"errors": response{
						"email": []string{"Format email tidak valid."},
					},
				})
				return
			}
		}

		now := time.Now()
		res, err := db.Exec(`
			INSERT INTO suppliers (name, phone, email, address, contact_person, created_at, updated_at)
			VALUES (?, ?, ?, ?, ?, ?, ?)
		`, name, supplierStoreNullableString(phone), supplierStoreNullableString(email), supplierStoreNullableString(address), supplierStoreNullableString(contactPerson), now, now)
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, response{"message": "failed to create supplier"})
			return
		}

		id, err := res.LastInsertId()
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, response{"message": "failed to read created supplier id"})
			return
		}

		writeJSON(w, http.StatusOK, response{
			"message": "Supplier created successfully.",
			"supplier": response{
				"id":             id,
				"name":           name,
				"phone":          supplierStoreNullableString(phone),
				"email":          supplierStoreNullableString(email),
				"address":        supplierStoreNullableString(address),
				"contact_person": supplierStoreNullableString(contactPerson),
			},
		})
	}
}

func supplierStoreNullableString(value string) any {
	trimmed := strings.TrimSpace(value)
	if trimmed == "" {
		return nil
	}
	return trimmed
}
