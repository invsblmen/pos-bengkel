package httpserver

import (
	"database/sql"
	"net/http"
	"strings"
	"time"
)

func partSaleDestroyHandler(db *sql.DB) http.HandlerFunc {
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

		tx, err := db.BeginTx(r.Context(), nil)
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, response{"message": "failed to start transaction"})
			return
		}
		defer func() { _ = tx.Rollback() }()

		var status string
		if err := tx.QueryRow(`
			SELECT status
			FROM part_sales
			WHERE id = ?
			LIMIT 1
		`, partSaleIntID).Scan(&status); err != nil {
			if err == sql.ErrNoRows {
				writeJSON(w, http.StatusNotFound, response{"message": "Part sale not found."})
				return
			}

			writeJSON(w, http.StatusInternalServerError, response{"message": "failed to read part sale"})
			return
		}

		if status != "draft" {
			writeJSON(w, http.StatusUnprocessableEntity, response{
				"message": "The given data was invalid.",
				"errors": response{
					"error": []string{"Hanya penjualan draft yang bisa dihapus"},
				},
			})
			return
		}

		now := time.Now()
		if _, err := tx.Exec(`
			UPDATE warranty_registrations
			SET deleted_at = ?, updated_at = ?
			WHERE source_type = 'App\\Models\\PartSale' AND source_id = ? AND deleted_at IS NULL
		`, now, now, partSaleIntID); err != nil {
			writeJSON(w, http.StatusInternalServerError, response{"message": "failed to clear warranty registrations"})
			return
		}

		if _, err := tx.Exec(`DELETE FROM voucher_usages WHERE source_type = 'App\\Models\\PartSale' AND source_id = ?`, partSaleIntID); err != nil {
			writeJSON(w, http.StatusInternalServerError, response{"message": "failed to clear voucher usage"})
			return
		}

		if _, err := tx.Exec(`DELETE FROM part_sale_details WHERE part_sale_id = ?`, partSaleIntID); err != nil {
			writeJSON(w, http.StatusInternalServerError, response{"message": "failed to delete sale details"})
			return
		}

		result, err := tx.Exec(`DELETE FROM part_sales WHERE id = ?`, partSaleIntID)
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, response{"message": "failed to delete part sale"})
			return
		}

		rowsAffected, _ := result.RowsAffected()
		if rowsAffected == 0 {
			writeJSON(w, http.StatusNotFound, response{"message": "Part sale not found."})
			return
		}

		if err := tx.Commit(); err != nil {
			writeJSON(w, http.StatusInternalServerError, response{"message": "failed to commit transaction"})
			return
		}

		writeJSON(w, http.StatusOK, response{
			"ok":       true,
			"message":  "Penjualan berhasil dihapus",
			"sale_id":  partSaleIntID,
			"redirect": "/dashboard/part-sales",
		})
	}
}
