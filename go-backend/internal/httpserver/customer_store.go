package httpserver

import (
	"database/sql"
	"encoding/json"
	"net/http"
	"net/mail"
	"strings"
	"time"
)

type customerStoreRequest struct {
	Name    string `json:"name"`
	Phone   string `json:"phone"`
	Email   string `json:"email"`
	Address string `json:"address"`
}

func customerStoreHandler(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if db == nil {
			writeJSON(w, http.StatusServiceUnavailable, response{"message": "database is not configured"})
			return
		}

		var payload customerStoreRequest
		if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
			writeJSON(w, http.StatusBadRequest, response{"message": "invalid json payload"})
			return
		}

		name := strings.TrimSpace(payload.Name)
		phone := strings.TrimSpace(payload.Phone)
		email := strings.TrimSpace(payload.Email)
		address := strings.TrimSpace(payload.Address)

		if name == "" {
			writeJSON(w, http.StatusUnprocessableEntity, response{
				"message": "Data tidak valid",
				"errors": response{
					"name": []string{"Nama wajib diisi"},
				},
			})
			return
		}

		if phone == "" {
			writeJSON(w, http.StatusUnprocessableEntity, response{
				"message": "Data tidak valid",
				"errors": response{
					"phone": []string{"Telepon wajib diisi"},
				},
			})
			return
		}

		if email != "" {
			if _, err := mail.ParseAddress(email); err != nil {
				writeJSON(w, http.StatusUnprocessableEntity, response{
					"message": "Data tidak valid",
					"errors": response{
						"email": []string{"Format email tidak valid"},
					},
				})
				return
			}
		}

		exists, err := customerStorePhoneExists(db, phone)
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, response{"message": "failed to validate phone"})
			return
		}
		if exists {
			writeJSON(w, http.StatusUnprocessableEntity, response{
				"message": "Data tidak valid",
				"errors": response{
					"phone": []string{"Nomor telepon sudah terdaftar"},
				},
			})
			return
		}

		res, err := db.Exec(`
			INSERT INTO customers (name, phone, email, address, created_at, updated_at)
			VALUES (?, ?, ?, ?, ?, ?)
		`, name, phone, customerStoreNullableString(email), customerStoreNullableString(address), time.Now(), time.Now())
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, response{"message": "failed to create customer"})
			return
		}

		id, err := res.LastInsertId()
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, response{"message": "failed to read created customer id"})
			return
		}

		writeJSON(w, http.StatusOK, response{
			"message": "Pelanggan berhasil ditambahkan",
			"customer": response{
				"id":      id,
				"name":    name,
				"phone":   phone,
				"email":   customerStoreNullableString(email),
				"address": customerStoreNullableString(address),
			},
		})
	}
}

func customerStorePhoneExists(db *sql.DB, phone string) (bool, error) {
	var id int64
	err := db.QueryRow(`SELECT id FROM customers WHERE phone = ? LIMIT 1`, phone).Scan(&id)
	if err == sql.ErrNoRows {
		return false, nil
	}
	if err != nil {
		return false, err
	}
	return true, nil
}

func customerStoreNullableString(value string) any {
	trimmed := strings.TrimSpace(value)
	if trimmed == "" {
		return nil
	}
	return trimmed
}
