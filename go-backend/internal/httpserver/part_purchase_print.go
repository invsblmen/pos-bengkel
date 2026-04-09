package httpserver

import (
	"database/sql"
	"net/http"
	"strings"
)

func partPurchasePrintHandler(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if db == nil {
			writeJSON(w, http.StatusServiceUnavailable, response{"message": "database is not configured"})
			return
		}

		purchaseID := strings.TrimSpace(r.PathValue("id"))
		if purchaseID == "" {
			writeJSON(w, http.StatusBadRequest, response{"message": "part purchase id is required"})
			return
		}

		purchaseIntID := parseInt64WithDefault(purchaseID)
		if purchaseIntID <= 0 {
			writeJSON(w, http.StatusBadRequest, response{"message": "part purchase id is required"})
			return
		}

		purchase, err := queryPartPurchaseShowPurchase(db, purchaseIntID)
		if err == sql.ErrNoRows {
			writeJSON(w, http.StatusNotFound, response{"message": "Part purchase not found."})
			return
		}
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, response{"message": "failed to read part purchase"})
			return
		}

		details, err := queryPartPurchaseShowDetails(db, purchaseIntID)
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, response{"message": "failed to read part purchase details"})
			return
		}
		purchase["details"] = details

		businessProfile, err := queryPartSaleShowBusinessProfile(db)
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, response{"message": "failed to read business profile"})
			return
		}

		writeJSON(w, http.StatusOK, response{
			"purchase":        purchase,
			"businessProfile": businessProfile,
		})
	}
}