package httpserver

import (
	"database/sql"
	"net/http"
	"strings"
)

func vehicleDestroyHandler(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if db == nil {
			writeJSON(w, http.StatusServiceUnavailable, response{"message": "database is not configured"})
			return
		}

		vehicleID := strings.TrimSpace(r.PathValue("id"))
		if vehicleID == "" {
			writeJSON(w, http.StatusBadRequest, response{"message": "vehicle id is required"})
			return
		}

		id := parseInt64WithDefault(vehicleID)
		if id <= 0 {
			writeJSON(w, http.StatusBadRequest, response{"message": "vehicle id is required"})
			return
		}

		if ok, err := recordExists(db, "vehicles", id); err != nil {
			writeJSON(w, http.StatusInternalServerError, response{"message": "failed to read vehicle"})
			return
		} else if !ok {
			writeJSON(w, http.StatusNotFound, response{"message": "vehicle not found"})
			return
		}

		result, err := db.Exec(`DELETE FROM vehicles WHERE id = ?`, id)
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, response{"message": "failed to delete vehicle"})
			return
		}

		rowsAffected, _ := result.RowsAffected()
		if rowsAffected == 0 {
			writeJSON(w, http.StatusNotFound, response{"message": "vehicle not found"})
			return
		}

		writeJSON(w, http.StatusOK, response{
			"message":    "Kendaraan berhasil dihapus!",
			"vehicle_id": id,
		})
	}
}
