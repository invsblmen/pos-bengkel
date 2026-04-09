package httpserver

import (
	"database/sql"
	"encoding/json"
	"net/http"
	"strings"
	"time"
)

type partSaleUpdateStatusRequest struct {
	Status string `json:"status"`
}

var allowedPartSaleStatuses = map[string]bool{
	"draft":           true,
	"confirmed":       true,
	"waiting_stock":   true,
	"ready_to_notify": true,
	"waiting_pickup":  true,
	"completed":       true,
	"cancelled":       true,
}

func partSaleUpdateStatusHandler(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if db == nil {
			writeJSON(w, http.StatusServiceUnavailable, response{"message": "database is not configured"})
			return
		}

		partSaleID := strings.TrimSpace(r.PathValue("id"))
		if partSaleID == "" {
			writeJSON(w, http.StatusBadRequest, response{"message": "part sale id is required"})
			return
		}

		partSaleIntID := parseInt64WithDefault(partSaleID)
		if partSaleIntID <= 0 {
			writeJSON(w, http.StatusBadRequest, response{"message": "part sale id is required"})
			return
		}

		var payload partSaleUpdateStatusRequest
		if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
			writeJSON(w, http.StatusBadRequest, response{"message": "invalid json payload"})
			return
		}

		payload.Status = strings.TrimSpace(payload.Status)
		if !allowedPartSaleStatuses[payload.Status] {
			writeJSON(w, http.StatusUnprocessableEntity, response{
				"message": "The given data was invalid.",
				"errors": response{
					"status": []string{"The selected status is invalid."},
				},
			})
			return
		}

		currentStatus, err := queryPartSaleCurrentStatus(db, partSaleIntID)
		if err == sql.ErrNoRows {
			writeJSON(w, http.StatusNotFound, response{"message": "Part sale not found."})
			return
		}
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, response{"message": "failed to read part sale"})
			return
		}

		if payload.Status == currentStatus {
			writeJSON(w, http.StatusOK, response{
				"ok":      true,
				"message": "Status tidak berubah",
			})
			return
		}

		if currentStatus == "completed" || currentStatus == "cancelled" {
			writeJSON(w, http.StatusUnprocessableEntity, response{
				"message": "Status sudah final dan tidak bisa diubah",
				"errors": response{
					"status": []string{"Status sudah final dan tidak bisa diubah"},
				},
			})
			return
		}

		if _, err := db.Exec(`UPDATE part_sales SET status = ?, updated_at = ? WHERE id = ?`, payload.Status, time.Now(), partSaleIntID); err != nil {
			writeJSON(w, http.StatusInternalServerError, response{"message": "failed to update part sale status"})
			return
		}

		writeJSON(w, http.StatusOK, response{
			"ok":      true,
			"message": "Status penjualan berhasil diperbarui",
		})
	}
}

func queryPartSaleCurrentStatus(db *sql.DB, partSaleID int64) (string, error) {
	var status sql.NullString
	err := db.QueryRow(`SELECT status FROM part_sales WHERE id = ? LIMIT 1`, partSaleID).Scan(&status)
	if err != nil {
		return "", err
	}
	if !status.Valid {
		return "", sql.ErrNoRows
	}
	return status.String, nil
}
