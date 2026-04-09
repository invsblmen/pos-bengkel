package httpserver

import (
	"database/sql"
	"net/http"
	"strings"
)

func serviceOrderEditHandler(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if db == nil {
			writeJSON(w, http.StatusServiceUnavailable, response{
				"message": "database is not configured",
			})
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

		selectedTags, err := queryServiceOrderEditSelectedTags(db, order["id"].(int64))
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, response{"message": "failed to read service order tags"})
			return
		}
		order["tags"] = selectedTags

		customers, err := queryServiceOrderCreateCustomers(db)
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, response{"message": "failed to read customers"})
			return
		}

		vehicles, err := queryServiceOrderCreateVehicles(db)
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, response{"message": "failed to read vehicles"})
			return
		}

		mechanics, err := queryServiceOrderCreateMechanics(db)
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, response{"message": "failed to read mechanics"})
			return
		}

		services, err := queryServiceOrderCreateServices(db)
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, response{"message": "failed to read services"})
			return
		}

		parts, err := queryServiceOrderCreateParts(db)
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, response{"message": "failed to read parts"})
			return
		}

		tags, err := queryServiceOrderCreateTags(db)
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, response{"message": "failed to read tags"})
			return
		}

		vouchers, err := queryServiceOrderCreateVouchers(db)
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, response{"message": "failed to read vouchers"})
			return
		}

		writeJSON(w, http.StatusOK, response{
			"order":             order,
			"customers":         customers,
			"vehicles":          vehicles,
			"mechanics":         mechanics,
			"services":          services,
			"parts":             parts,
			"tags":              tags,
			"availableVouchers": vouchers,
		})
	}
}

func queryServiceOrderEditSelectedTags(db *sql.DB, serviceOrderID int64) ([]map[string]any, error) {
	var tags []map[string]any

	query := `
		SELECT t.id, t.name
		FROM tags t
		INNER JOIN service_order_tags sot ON sot.tag_id = t.id
		WHERE sot.service_order_id = ?
		ORDER BY t.name ASC
	`

	rows, err := db.Query(query, serviceOrderID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	for rows.Next() {
		var id int64
		var name string

		if err := rows.Scan(&id, &name); err != nil {
			return nil, err
		}

		tags = append(tags, map[string]any{
			"id":   id,
			"name": name,
		})
	}

	if tags == nil {
		tags = []map[string]any{}
	}

	return tags, rows.Err()
}
