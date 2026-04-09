package httpserver

import (
	"database/sql"
	"net/http"
	"strings"
)

func vehicleRecommendationsHandler(db *sql.DB) http.HandlerFunc {
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

		vehicle, err := queryVehicleSummary(db, vehicleID)
		if err == sql.ErrNoRows {
			writeJSON(w, http.StatusNotFound, response{"message": "vehicle not found"})
			return
		}
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, response{"message": "failed to read vehicle"})
			return
		}

		usedParts, usedServices, recentCount, err := queryRecentUsageCounts(db, vehicleID)
		if err != nil {
			writeJSON(w, http.StatusOK, response{
				"vehicle_id":           vehicle["id"],
				"brand":                vehicle["brand"],
				"model":                vehicle["model"],
				"recommended_parts":    []response{},
				"recommended_services": []response{},
				"recent_history_count": 0,
				"error":                err.Error(),
			})
			return
		}

		parts, err := queryRecommendedParts(db, usedParts)
		if err != nil {
			parts = []response{}
		}

		services, err := queryRecommendedServices(db, usedServices)
		if err != nil {
			services = []response{}
		}

		writeJSON(w, http.StatusOK, response{
			"vehicle_id":           vehicle["id"],
			"brand":                vehicle["brand"],
			"model":                vehicle["model"],
			"recommended_parts":    parts,
			"recommended_services": services,
			"recent_history_count": recentCount,
		})
	}
}

func vehicleMaintenanceScheduleHandler(db *sql.DB) http.HandlerFunc {
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

		exists, err := vehicleExists(db, vehicleID)
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, response{"message": "failed to read vehicle"})
			return
		}
		if !exists {
			writeJSON(w, http.StatusNotFound, response{"message": "vehicle not found"})
			return
		}

		schedule := []response{
			{
				"interval": "5,000 km / 3 months",
				"services": []string{"Oil Change", "Oil Filter"},
				"parts":    []string{"Engine Oil", "Oil Filter"},
				"priority": "high",
			},
			{
				"interval": "10,000 km / 6 months",
				"services": []string{"Fluid Check", "Belt Inspection"},
				"parts":    []string{},
				"priority": "medium",
			},
			{
				"interval": "20,000 km / 12 months",
				"services": []string{"Full Service", "Brake Check"},
				"parts":    []string{"Brake Pads", "Transmission Fluid"},
				"priority": "high",
			},
			{
				"interval": "40,000 km / 24 months",
				"services": []string{"Transmission Service", "Coolant Flush"},
				"parts":    []string{},
				"priority": "medium",
			},
		}

		writeJSON(w, http.StatusOK, response{
			"vehicle_id": parseIntOrString(vehicleID),
			"schedule":   schedule,
		})
	}
}

func queryRecentUsageCounts(db *sql.DB, vehicleID string) (map[int64]int64, map[int64]int64, int64, error) {
	const countQuery = `
		SELECT COUNT(*)
		FROM (
			SELECT id
			FROM service_orders
			WHERE vehicle_id = ?
			ORDER BY created_at DESC
			LIMIT 10
		) recent_orders
	`

	var recentCount int64
	if err := db.QueryRow(countQuery, vehicleID).Scan(&recentCount); err != nil {
		return nil, nil, 0, err
	}

	const usageQuery = `
		SELECT sod.service_id, sod.part_id
		FROM service_order_details sod
		JOIN (
			SELECT id, created_at
			FROM service_orders
			WHERE vehicle_id = ?
			ORDER BY created_at DESC
			LIMIT 10
		) so ON so.id = sod.service_order_id
		ORDER BY so.created_at DESC, sod.id DESC
	`

	rows, err := db.Query(usageQuery, vehicleID)
	if err != nil {
		return nil, nil, 0, err
	}
	defer rows.Close()

	usedParts := map[int64]int64{}
	usedServices := map[int64]int64{}

	for rows.Next() {
		var serviceID sql.NullInt64
		var partID sql.NullInt64
		if err := rows.Scan(&serviceID, &partID); err != nil {
			return nil, nil, 0, err
		}

		if serviceID.Valid {
			usedServices[serviceID.Int64] = usedServices[serviceID.Int64] + 1
		}
		if partID.Valid {
			usedParts[partID.Int64] = usedParts[partID.Int64] + 1
		}
	}

	return usedParts, usedServices, recentCount, rows.Err()
}

func queryRecommendedParts(db *sql.DB, usedParts map[int64]int64) ([]response, error) {
	const q = `
		SELECT p.id, p.name, COALESCE(pc.name, 'Other') AS category_name, COALESCE(p.sell_price, 0)
		FROM parts p
		LEFT JOIN part_categories pc ON pc.id = p.part_category_id
		WHERE p.stock > 0
		ORDER BY p.name ASC
		LIMIT 5
	`

	rows, err := db.Query(q)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	parts := make([]response, 0)
	for rows.Next() {
		var id int64
		var name sql.NullString
		var category sql.NullString
		var price sql.NullInt64
		if err := rows.Scan(&id, &name, &category, &price); err != nil {
			return nil, err
		}

		parts = append(parts, response{
			"id":        id,
			"name":      nullString(name),
			"category":  stringOrDefault(category, "Other"),
			"price":     intOrDefault(price, 0),
			"frequency": usedParts[id],
		})
	}

	return parts, rows.Err()
}

func queryRecommendedServices(db *sql.DB, usedServices map[int64]int64) ([]response, error) {
	const q = `
		SELECT s.id, s.name, COALESCE(sc.name, 'Other') AS category_name, COALESCE(s.price, 0)
		FROM services s
		LEFT JOIN service_categories sc ON sc.id = s.service_category_id
		ORDER BY s.name ASC
		LIMIT 5
	`

	rows, err := db.Query(q)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	services := make([]response, 0)
	for rows.Next() {
		var id int64
		var name sql.NullString
		var category sql.NullString
		var price sql.NullInt64
		if err := rows.Scan(&id, &name, &category, &price); err != nil {
			return nil, err
		}

		services = append(services, response{
			"id":        id,
			"name":      nullString(name),
			"category":  stringOrDefault(category, "Other"),
			"price":     intOrDefault(price, 0),
			"frequency": usedServices[id],
		})
	}

	return services, rows.Err()
}

func parseIntOrString(vehicleID string) any {
	if n := parseInt64(vehicleID); n != nil {
		return *n
	}
	return vehicleID
}

func parseInt64(text string) *int64 {
	var n int64
	for _, ch := range text {
		if ch < '0' || ch > '9' {
			return nil
		}
		n = (n * 10) + int64(ch-'0')
	}
	return &n
}

func stringOrDefault(v sql.NullString, fallback string) string {
	if v.Valid {
		return v.String
	}
	return fallback
}

func intOrDefault(v sql.NullInt64, fallback int64) int64 {
	if v.Valid {
		return v.Int64
	}
	return fallback
}
