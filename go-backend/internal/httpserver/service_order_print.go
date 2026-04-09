package httpserver

import (
	"database/sql"
	"net/http"
	"strings"
)

func serviceOrderPrintHandler(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if db == nil {
			writeJSON(w, http.StatusServiceUnavailable, response{"message": "database is not configured"})
			return
		}

		id := strings.TrimSpace(r.PathValue("id"))
		if id == "" {
			writeJSON(w, http.StatusBadRequest, response{"message": "service order id is required"})
			return
		}

		order, err := queryServiceOrderShowOrder(db, id)
		if err == sql.ErrNoRows {
			writeJSON(w, http.StatusNotFound, response{"message": "service order not found"})
			return
		}
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, response{"message": "failed to read service order"})
			return
		}

		businessProfile, err := queryPartSaleShowBusinessProfile(db)
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, response{"message": "failed to read business profile"})
			return
		}

		writeJSON(w, http.StatusOK, response{
			"order":           order,
			"businessProfile": businessProfile,
		})
	}
}
