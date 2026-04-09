package httpserver

import (
	"database/sql"
	"net/http"
	"strings"
)

func customerSearchHandler(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if db == nil {
			writeJSON(w, http.StatusServiceUnavailable, response{"message": "database is not configured"})
			return
		}

		q := strings.TrimSpace(r.URL.Query().Get("q"))
		limit := parsePositiveInt(r.URL.Query().Get("limit"), 20)
		if limit > 100 {
			limit = 100
		}

		items, err := queryCustomerSearch(db, q, limit)
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, response{"message": "failed to read customers"})
			return
		}

		writeJSON(w, http.StatusOK, response{"data": items})
	}
}

func queryCustomerSearch(db *sql.DB, q string, limit int) ([]response, error) {
	args := make([]any, 0)
	query := `
		SELECT id, name, phone
		FROM customers
	`

	if q != "" {
		query += " WHERE (name LIKE ? OR COALESCE(phone, '') LIKE ?)"
		like := "%" + q + "%"
		args = append(args, like, like)
	}

	query += " ORDER BY name ASC LIMIT ?"
	args = append(args, limit)

	rows, err := db.Query(query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	items := make([]response, 0)
	for rows.Next() {
		var id int64
		var name, phone sql.NullString
		if err := rows.Scan(&id, &name, &phone); err != nil {
			return nil, err
		}

		items = append(items, response{
			"id":    id,
			"name":  nullString(name),
			"phone": nullString(phone),
		})
	}

	return items, rows.Err()
}
