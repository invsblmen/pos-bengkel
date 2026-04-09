package httpserver

import (
	"database/sql"
	"encoding/json"
	"net/http"
	"strings"
	"time"
)

type customerStoreAjaxRequest struct {
	Name    string `json:"name"`
	Phone   string `json:"phone"`
	NoTelp  string `json:"no_telp"`
	Email   string `json:"email"`
	Address string `json:"address"`
}

func customerStoreAjaxHandler(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if db == nil {
			writeJSON(w, http.StatusServiceUnavailable, response{"message": "database is not configured"})
			return
		}

		var payload customerStoreAjaxRequest
		if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
			writeJSON(w, http.StatusBadRequest, response{"message": "invalid json payload"})
			return
		}

		name := strings.TrimSpace(payload.Name)
		phone := strings.TrimSpace(payload.Phone)
		if phone == "" {
			phone = strings.TrimSpace(payload.NoTelp)
		}

		if name == "" {
			writeJSON(w, http.StatusUnprocessableEntity, response{
				"success": false,
				"message": "Data tidak valid",
				"errors": response{
					"name": []string{"Nama wajib diisi"},
				},
			})
			return
		}

		if phone == "" {
			writeJSON(w, http.StatusUnprocessableEntity, response{
				"success": false,
				"message": "Telepon wajib diisi",
				"errors": response{
					"phone": []string{"Telepon wajib diisi"},
				},
			})
			return
		}

		exists, err := customerPhoneExists(db, phone)
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, response{
				"success": false,
				"message": "Gagal menambahkan pelanggan: failed to check existing phone",
				"errors":  response{},
			})
			return
		}

		if exists {
			writeJSON(w, http.StatusUnprocessableEntity, response{
				"success": false,
				"message": "Nomor telepon sudah terdaftar",
				"errors": response{
					"phone": []string{"Nomor telepon sudah terdaftar"},
				},
			})
			return
		}

		res, err := db.Exec(`
			INSERT INTO customers (name, phone, email, address, created_at, updated_at)
			VALUES (?, ?, ?, ?, ?, ?)
		`, name, phone, nullableTrimmedString(payload.Email), nullableTrimmedString(payload.Address), time.Now(), time.Now())
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, response{
				"success": false,
				"message": "Gagal menambahkan pelanggan: failed to create customer",
				"errors":  response{},
			})
			return
		}

		id, err := res.LastInsertId()
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, response{
				"success": false,
				"message": "Gagal menambahkan pelanggan: failed to read created customer id",
				"errors":  response{},
			})
			return
		}

		writeJSON(w, http.StatusOK, response{
			"success": true,
			"message": "Pelanggan berhasil ditambahkan",
			"customer": response{
				"id":      id,
				"name":    name,
				"phone":   phone,
				"email":   nullableTrimmedString(payload.Email),
				"address": nullableTrimmedString(payload.Address),
			},
		})
	}
}

func customerPhoneExists(db *sql.DB, phone string) (bool, error) {
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

func nullableTrimmedString(value string) any {
	trimmed := strings.TrimSpace(value)
	if trimmed == "" {
		return nil
	}
	return trimmed
}
