package httpserver

import (
	"database/sql"
	"encoding/json"
	"net/http"
	"net/mail"
	"strings"
	"time"
)

type supplierUpdateRequest struct {
	Name          string `json:"name"`
	Phone         string `json:"phone"`
	Email         string `json:"email"`
	Address       string `json:"address"`
	ContactPerson string `json:"contact_person"`
}

func supplierUpdateHandler(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if db == nil {
			writeJSON(w, http.StatusServiceUnavailable, response{"message": "database is not configured"})
			return
		}

		id := strings.TrimSpace(r.PathValue("id"))
		if id == "" {
			writeJSON(w, http.StatusBadRequest, response{"message": "supplier id is required"})
			return
		}

		supplierID := parseInt64WithDefault(id)
		if supplierID <= 0 {
			writeJSON(w, http.StatusBadRequest, response{"message": "supplier id is required"})
			return
		}

		if ok, err := recordExists(db, "suppliers", supplierID); err != nil {
			writeJSON(w, http.StatusInternalServerError, response{"message": "failed to read supplier"})
			return
		} else if !ok {
			writeJSON(w, http.StatusNotFound, response{"message": "supplier not found"})
			return
		}

		var payload supplierUpdateRequest
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

		_, err := db.Exec(`
			UPDATE suppliers
			SET name = ?, phone = ?, email = ?, address = ?, contact_person = ?, updated_at = ?
			WHERE id = ?
		`, name, supplierUpdateNullableString(phone), supplierUpdateNullableString(email), supplierUpdateNullableString(address), supplierUpdateNullableString(contactPerson), time.Now(), supplierID)
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, response{"message": "failed to update supplier"})
			return
		}

		writeJSON(w, http.StatusOK, response{
			"message": "Supplier updated successfully.",
			"supplier": response{
				"id":             supplierID,
				"name":           name,
				"phone":          supplierUpdateNullableString(phone),
				"email":          supplierUpdateNullableString(email),
				"address":        supplierUpdateNullableString(address),
				"contact_person": supplierUpdateNullableString(contactPerson),
			},
		})
	}
}

func supplierUpdateNullableString(value string) any {
	trimmed := strings.TrimSpace(value)
	if trimmed == "" {
		return nil
	}
	return trimmed
}
