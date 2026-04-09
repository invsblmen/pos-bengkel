package httpserver

import (
	"database/sql"
	"net/http"
)

func serviceOrderCreateQuickIntakeHandler(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if db == nil {
			writeJSON(w, http.StatusServiceUnavailable, response{"message": "database is not configured"})
			return
		}

		rows, err := db.Query(`SELECT id, name FROM mechanics ORDER BY name ASC`)
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, response{"message": "failed to read mechanics"})
			return
		}
		defer rows.Close()

		mechanics := make([]response, 0)
		for rows.Next() {
			var id int64
			var name sql.NullString
			if err := rows.Scan(&id, &name); err != nil {
				writeJSON(w, http.StatusInternalServerError, response{"message": "failed to read mechanics"})
				return
			}

			mechanics = append(mechanics, response{
				"id":   id,
				"name": nullString(name),
			})
		}

		if err := rows.Err(); err != nil {
			writeJSON(w, http.StatusInternalServerError, response{"message": "failed to read mechanics"})
			return
		}

		writeJSON(w, http.StatusOK, response{
			"mechanics": mechanics,
		})
	}
}
