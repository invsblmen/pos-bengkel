package httpserver

import (
	"database/sql"
	"encoding/json"
	"net/http"
	"net/mail"
	"strings"
	"time"
)

type supplierStoreAjaxRequest struct {
	Name          string `json:"name"`
	Phone         string `json:"phone"`
	Email         string `json:"email"`
	Address       string `json:"address"`
	ContactPerson string `json:"contact_person"`
}

func supplierStoreAjaxHandler(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if db == nil {
			writeJSON(w, http.StatusServiceUnavailable, response{"message": "database is not configured"})
			return
		}

		var payload supplierStoreAjaxRequest
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
				"success": false,
				"message": "Data tidak valid",
				"errors": response{
					"name": []string{"Nama supplier wajib diisi."},
				},
			})
			return
		}

		if email != "" {
			if _, err := mail.ParseAddress(email); err != nil {
				writeJSON(w, http.StatusUnprocessableEntity, response{
					"success": false,
					"message": "Data tidak valid",
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
		`, name, supplierStoreAjaxNullableString(phone), supplierStoreAjaxNullableString(email), supplierStoreAjaxNullableString(address), supplierStoreAjaxNullableString(contactPerson), now, now)
		if err != nil {
			writeJSON(w, http.StatusUnprocessableEntity, response{
				"success": false,
				"message": "Gagal menambahkan supplier",
				"errors": response{
					"name": []string{"Terjadi kesalahan saat menyimpan supplier"},
				},
			})
			return
		}

		id, err := res.LastInsertId()
		if err != nil {
			writeJSON(w, http.StatusUnprocessableEntity, response{
				"success": false,
				"message": "Gagal menambahkan supplier",
				"errors": response{
					"name": []string{"Terjadi kesalahan saat menyimpan supplier"},
				},
			})
			return
		}

		writeJSON(w, http.StatusOK, response{
			"success": true,
			"message": "Supplier berhasil ditambahkan",
			"supplier": response{
				"id":             id,
				"name":           name,
				"contact_person": supplierStoreAjaxNullableString(contactPerson),
				"phone":          supplierStoreAjaxNullableString(phone),
				"email":          supplierStoreAjaxNullableString(email),
				"address":        supplierStoreAjaxNullableString(address),
			},
		})
	}
}

func supplierStoreAjaxNullableString(value string) any {
	trimmed := strings.TrimSpace(value)
	if trimmed == "" {
		return nil
	}
	return trimmed
}
