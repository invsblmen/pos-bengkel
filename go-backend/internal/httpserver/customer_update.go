package httpserver

import (
	"database/sql"
	"encoding/json"
	"net/http"
	"net/mail"
	"strings"
	"time"
)

type customerUpdateRequest struct {
	Name    string `json:"name"`
	Phone   string `json:"phone"`
	Email   string `json:"email"`
	Address string `json:"address"`
}

func customerUpdateHandler(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if db == nil {
			writeJSON(w, http.StatusServiceUnavailable, response{"message": "database is not configured"})
			return
		}

		id := strings.TrimSpace(r.PathValue("id"))
		if id == "" {
			writeJSON(w, http.StatusBadRequest, response{"message": "customer id is required"})
			return
		}

		customerID := parseInt64WithDefault(id)
		if customerID <= 0 {
			writeJSON(w, http.StatusBadRequest, response{"message": "customer id is required"})
			return
		}

		var payload customerUpdateRequest
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

		exists, err := customerUpdateExistsByID(db, customerID)
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, response{"message": "failed to read customer"})
			return
		}
		if !exists {
			writeJSON(w, http.StatusNotFound, response{"message": "customer not found"})
			return
		}

		phoneTaken, err := customerUpdatePhoneTakenByOther(db, customerID, phone)
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, response{"message": "failed to validate phone"})
			return
		}
		if phoneTaken {
			writeJSON(w, http.StatusUnprocessableEntity, response{
				"message": "Data tidak valid",
				"errors": response{
					"phone": []string{"Nomor telepon sudah terdaftar"},
				},
			})
			return
		}

		_, err = db.Exec(`
			UPDATE customers
			SET name = ?, phone = ?, email = ?, address = ?, updated_at = ?
			WHERE id = ?
		`, name, phone, customerUpdateNullableString(email), customerUpdateNullableString(address), time.Now(), customerID)
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, response{"message": "failed to update customer"})
			return
		}

		writeJSON(w, http.StatusOK, response{
			"message": "Pelanggan berhasil diperbarui",
			"customer": response{
				"id":      customerID,
				"name":    name,
				"phone":   phone,
				"email":   customerUpdateNullableString(email),
				"address": customerUpdateNullableString(address),
			},
		})
	}
}

func customerUpdateExistsByID(db *sql.DB, customerID int64) (bool, error) {
	var id int64
	err := db.QueryRow(`SELECT id FROM customers WHERE id = ? LIMIT 1`, customerID).Scan(&id)
	if err == sql.ErrNoRows {
		return false, nil
	}
	if err != nil {
		return false, err
	}
	return true, nil
}

func customerUpdatePhoneTakenByOther(db *sql.DB, customerID int64, phone string) (bool, error) {
	var id int64
	err := db.QueryRow(`SELECT id FROM customers WHERE phone = ? AND id <> ? LIMIT 1`, phone, customerID).Scan(&id)
	if err == sql.ErrNoRows {
		return false, nil
	}
	if err != nil {
		return false, err
	}
	return true, nil
}

func customerUpdateNullableString(value string) any {
	trimmed := strings.TrimSpace(value)
	if trimmed == "" {
		return nil
	}
	return trimmed
}
