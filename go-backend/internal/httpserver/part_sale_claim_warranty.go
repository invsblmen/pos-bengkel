package httpserver

import (
	"bytes"
	"database/sql"
	"encoding/json"
	"io"
	"net/http"
	"strings"
	"time"
)

type partSaleClaimWarrantyRequest struct {
	WarrantyClaimNotes *string `json:"warranty_claim_notes"`
	ActorUserID        *int64  `json:"actor_user_id"`
}

func partSaleClaimWarrantyHandler(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if db == nil {
			writeJSON(w, http.StatusServiceUnavailable, response{"message": "database is not configured"})
			return
		}

		partSaleID := strings.TrimSpace(r.PathValue("partSale"))
		detailID := strings.TrimSpace(r.PathValue("detail"))
		if partSaleID == "" || detailID == "" {
			writeJSON(w, http.StatusBadRequest, response{"message": "part sale id and detail id are required"})
			return
		}

		partSaleIntID := parseInt64WithDefault(partSaleID)
		detailIntID := parseInt64WithDefault(detailID)
		if partSaleIntID <= 0 || detailIntID <= 0 {
			writeJSON(w, http.StatusBadRequest, response{"message": "part sale id and detail id are required"})
			return
		}

		var payload partSaleClaimWarrantyRequest
		body, err := io.ReadAll(r.Body)
		if err != nil {
			writeJSON(w, http.StatusBadRequest, response{"message": "invalid json payload"})
			return
		}

		if len(bytes.TrimSpace(body)) > 0 {
			if err := json.Unmarshal(body, &payload); err != nil {
				writeJSON(w, http.StatusBadRequest, response{"message": "invalid json payload"})
				return
			}
		}

		if payload.WarrantyClaimNotes != nil && len(*payload.WarrantyClaimNotes) > 1000 {
			writeJSON(w, http.StatusUnprocessableEntity, response{
				"message": "The given data was invalid.",
				"errors": response{
					"warranty_claim_notes": []string{"The warranty claim notes may not be greater than 1000 characters."},
				},
			})
			return
		}

		tx, err := db.BeginTx(r.Context(), nil)
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, response{"message": "failed to start transaction"})
			return
		}
		defer func() { _ = tx.Rollback() }()

		var detailPartSaleID int64
		var warrantyPeriodDays sql.NullInt64
		var warrantyEndDate sql.NullTime
		var warrantyClaimedAt sql.NullTime
		if err := tx.QueryRow(`
			SELECT part_sale_id, warranty_period_days, warranty_end_date, warranty_claimed_at
			FROM part_sale_details
			WHERE id = ?
			LIMIT 1
		`, detailIntID).Scan(&detailPartSaleID, &warrantyPeriodDays, &warrantyEndDate, &warrantyClaimedAt); err != nil {
			if err == sql.ErrNoRows {
				writeJSON(w, http.StatusNotFound, response{"message": "Detail garansi tidak ditemukan."})
				return
			}

			writeJSON(w, http.StatusInternalServerError, response{"message": "failed to read warranty detail"})
			return
		}

		if detailPartSaleID != partSaleIntID {
			writeJSON(w, http.StatusUnprocessableEntity, response{
				"message": "The given data was invalid.",
				"errors": response{
					"error": []string{"Detail garansi tidak valid untuk transaksi ini."},
				},
			})
			return
		}

		if int64OrZero(warrantyPeriodDays) <= 0 || !warrantyEndDate.Valid {
			writeJSON(w, http.StatusUnprocessableEntity, response{
				"message": "The given data was invalid.",
				"errors": response{
					"error": []string{"Item ini tidak memiliki garansi."},
				},
			})
			return
		}

		if warrantyClaimedAt.Valid {
			writeJSON(w, http.StatusUnprocessableEntity, response{
				"message": "The given data was invalid.",
				"errors": response{
					"error": []string{"Garansi item ini sudah pernah diklaim."},
				},
			})
			return
		}

		today := startOfDay(time.Now())
		endDate := startOfDay(warrantyEndDate.Time)
		if today.After(endDate) {
			writeJSON(w, http.StatusUnprocessableEntity, response{
				"message": "The given data was invalid.",
				"errors": response{
					"error": []string{"Masa garansi item ini sudah berakhir."},
				},
			})
			return
		}

		if _, err := tx.Exec(`
			UPDATE part_sale_details
			SET warranty_claimed_at = NOW(), warranty_claim_notes = ?, updated_at = NOW()
			WHERE id = ?
		`, stringPtrOrNil(payload.WarrantyClaimNotes), detailIntID); err != nil {
			writeJSON(w, http.StatusInternalServerError, response{"message": "failed to update warranty detail"})
			return
		}

		if _, err := tx.Exec(`
			UPDATE warranty_registrations
			SET status = 'claimed', claimed_at = NOW(), claimed_by = ?, claim_notes = ?, updated_at = NOW()
			WHERE source_type = ? AND source_id = ? AND source_detail_id = ?
		`, nullableInt64Ptr(payload.ActorUserID), stringPtrOrNil(payload.WarrantyClaimNotes), "App\\Models\\PartSale", partSaleIntID, detailIntID); err != nil {
			writeJSON(w, http.StatusInternalServerError, response{"message": "failed to update warranty registration"})
			return
		}

		if err := tx.Commit(); err != nil {
			writeJSON(w, http.StatusInternalServerError, response{"message": "failed to commit transaction"})
			return
		}

		writeJSON(w, http.StatusOK, response{
			"ok":      true,
			"message": "Klaim garansi berhasil dicatat",
		})
	}
}

func startOfDay(value time.Time) time.Time {
	return time.Date(value.Year(), value.Month(), value.Day(), 0, 0, 0, 0, value.Location())
}

func stringPtrOrNil(value *string) any {
	if value == nil {
		return nil
	}
	return *value
}

func nullableInt64Ptr(value *int64) any {
	if value == nil {
		return nil
	}
	return *value
}
