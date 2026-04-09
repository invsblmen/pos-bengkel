package httpserver

import (
	"database/sql"
	"net/http"
	"strings"
)

func partSalePrintHandler(db *sql.DB) http.HandlerFunc {
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

		sale, err := queryPartSaleShowSale(db, partSaleIntID)
		if err == sql.ErrNoRows {
			writeJSON(w, http.StatusNotFound, response{"message": "Part sale not found."})
			return
		}
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, response{"message": "failed to read part sale"})
			return
		}

		details, err := queryPartSaleShowDetails(db, partSaleIntID)
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, response{"message": "failed to read part sale details"})
			return
		}
		sale["details"] = details

		businessProfile, err := queryPartSaleShowBusinessProfile(db)
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, response{"message": "failed to read business profile"})
			return
		}

		writeJSON(w, http.StatusOK, response{
			"sale":            sale,
			"businessProfile": businessProfile,
		})
	}
}
