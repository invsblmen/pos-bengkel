package httpserver

import (
	"bytes"
	"database/sql"
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"strings"
	"time"
)

type serviceOrderClaimWarrantyRequest struct {
	ClaimNotes *string `json:"claim_notes"`
}

func serviceOrderClaimWarrantyHandler(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if db == nil {
			writeJSON(w, http.StatusServiceUnavailable, response{"message": "database is not configured"})
			return
		}

		orderIDRaw := strings.TrimSpace(r.PathValue("id"))
		detailIDRaw := strings.TrimSpace(r.PathValue("detailId"))
		if orderIDRaw == "" || detailIDRaw == "" {
			writeJSON(w, http.StatusBadRequest, response{"message": "service order id and detail id are required"})
			return
		}

		orderID := parseInt64WithDefault(orderIDRaw)
		detailID := parseInt64WithDefault(detailIDRaw)
		if orderID <= 0 || detailID <= 0 {
			writeJSON(w, http.StatusBadRequest, response{"message": "service order id and detail id are required"})
			return
		}

		var payload serviceOrderClaimWarrantyRequest
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

		if payload.ClaimNotes != nil && len(*payload.ClaimNotes) > 1000 {
			writeJSON(w, http.StatusUnprocessableEntity, response{
				"message": "The given data was invalid.",
				"errors": response{
					"claim_notes": []string{"The claim notes may not be greater than 1000 characters."},
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

		var detailOrderID int64
		if err := tx.QueryRow(`SELECT service_order_id FROM service_order_details WHERE id = ? LIMIT 1`, detailID).Scan(&detailOrderID); err != nil {
			if errors.Is(err, sql.ErrNoRows) {
				writeJSON(w, http.StatusNotFound, response{"message": "Detail garansi tidak ditemukan."})
				return
			}
			writeJSON(w, http.StatusInternalServerError, response{"message": "failed to read warranty detail"})
			return
		}

		if detailOrderID != orderID {
			writeJSON(w, http.StatusUnprocessableEntity, response{
				"message": "The given data was invalid.",
				"errors": response{
					"error": []string{"Detail garansi tidak valid untuk service order ini."},
				},
			})
			return
		}

		var (
			registrationID int64
			status         string
			claimedAt      sql.NullTime
			warrantyEnd    sql.NullTime
		)

		if err := tx.QueryRow(`
			SELECT id, status, claimed_at, warranty_end_date
			FROM warranty_registrations
			WHERE source_type = ? AND source_id = ? AND source_detail_id = ?
			LIMIT 1
		`, "App\\Models\\ServiceOrder", orderID, detailID).Scan(&registrationID, &status, &claimedAt, &warrantyEnd); err != nil {
			if errors.Is(err, sql.ErrNoRows) {
				writeJSON(w, http.StatusUnprocessableEntity, response{
					"message": "The given data was invalid.",
					"errors": response{
						"error": []string{"Item ini tidak memiliki registri garansi."},
					},
				})
				return
			}
			writeJSON(w, http.StatusInternalServerError, response{"message": "failed to read warranty registration"})
			return
		}

		if claimedAt.Valid || strings.EqualFold(status, "claimed") {
			writeJSON(w, http.StatusUnprocessableEntity, response{
				"message": "The given data was invalid.",
				"errors": response{
					"error": []string{"Garansi item ini sudah pernah diklaim."},
				},
			})
			return
		}

		if !warrantyEnd.Valid || startOfDay(time.Now()).After(startOfDay(warrantyEnd.Time)) {
			writeJSON(w, http.StatusUnprocessableEntity, response{
				"message": "The given data was invalid.",
				"errors": response{
					"error": []string{"Masa garansi item ini sudah berakhir."},
				},
			})
			return
		}

		if _, err := tx.Exec(`
			UPDATE warranty_registrations
			SET status = 'claimed', claimed_at = NOW(), claimed_by = NULL, claim_notes = ?, updated_at = NOW()
			WHERE id = ?
		`, serviceOrderClaimWarrantyStringPtrOrNil(payload.ClaimNotes), registrationID); err != nil {
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

func serviceOrderClaimWarrantyStringPtrOrNil(value *string) any {
	if value == nil {
		return nil
	}
	return *value
}