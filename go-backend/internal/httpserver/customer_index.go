package httpserver

import (
	"database/sql"
	"net/http"
	"net/url"
	"strings"
)

func customerIndexHandler(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if db == nil {
			writeJSON(w, http.StatusServiceUnavailable, response{"message": "database is not configured"})
			return
		}

		customers, err := queryCustomerIndexPage(db, r.URL.Query())
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, response{"message": "failed to read customers"})
			return
		}

		writeJSON(w, http.StatusOK, response{
			"customers": customers,
		})
	}
}

func queryCustomerIndexPage(db *sql.DB, query url.Values) (response, error) {
	search := strings.TrimSpace(query.Get("search"))
	page := parsePositiveInt(query.Get("page"), 1)
	perPage := parsePositiveInt(query.Get("per_page"), 8)
	if perPage > 100 {
		perPage = 100
	}

	whereClause := ""
	args := make([]any, 0)
	if search != "" {
		whereClause = " WHERE (c.name LIKE ? OR COALESCE(c.phone, '') LIKE ? OR COALESCE(c.email, '') LIKE ?)"
		searchLike := "%" + search + "%"
		args = append(args, searchLike, searchLike, searchLike)
	}

	countQuery := "SELECT COUNT(*) FROM customers c" + whereClause
	var total int64
	if err := db.QueryRow(countQuery, args...).Scan(&total); err != nil {
		return nil, err
	}

	lastPage := 1
	if total > 0 {
		lastPage = int((total + int64(perPage) - 1) / int64(perPage))
	}
	if page > lastPage {
		page = lastPage
	}
	if page < 1 {
		page = 1
	}

	dataQuery := `
		SELECT c.id, c.name, c.phone, c.email, c.address
		FROM customers c
	` + whereClause + `
		ORDER BY c.created_at DESC, c.id DESC
		LIMIT ? OFFSET ?
	`

	queryArgs := append([]any{}, args...)
	queryArgs = append(queryArgs, perPage, (page-1)*perPage)

	rows, err := db.Query(dataQuery, queryArgs...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	customers := make([]response, 0)
	customerIDs := make([]int64, 0)
	indexByID := make(map[int64]int)

	for rows.Next() {
		var id int64
		var name, phone, email, address sql.NullString
		if err := rows.Scan(&id, &name, &phone, &email, &address); err != nil {
			return nil, err
		}

		customers = append(customers, response{
			"id":       id,
			"name":     nullString(name),
			"phone":    nullString(phone),
			"email":    nullString(email),
			"address":  nullString(address),
			"vehicles": []response{},
		})
		customerIDs = append(customerIDs, id)
		indexByID[id] = len(customers) - 1
	}

	if err := rows.Err(); err != nil {
		return nil, err
	}

	if len(customerIDs) > 0 {
		if err := queryCustomerIndexAttachVehicles(db, customerIDs, customers, indexByID); err != nil {
			return nil, err
		}
	}

	from, to := paginationBounds(total, page, perPage)

	return response{
		"current_page": page,
		"data":         customers,
		"from":         from,
		"last_page":    lastPage,
		"links":        buildVehicleIndexLinks("/customers", query, page, lastPage),
		"per_page":     perPage,
		"to":           to,
		"total":        total,
	}, nil
}

func queryCustomerIndexAttachVehicles(db *sql.DB, customerIDs []int64, customers []response, indexByID map[int64]int) error {
	placeholders := make([]string, 0, len(customerIDs))
	args := make([]any, 0, len(customerIDs))
	for _, id := range customerIDs {
		placeholders = append(placeholders, "?")
		args = append(args, id)
	}

	query := `
		SELECT v.id, v.customer_id, v.plate_number, v.brand, v.model, v.year, v.km
		FROM vehicles v
		WHERE v.customer_id IN (` + strings.Join(placeholders, ",") + `)
		ORDER BY v.created_at DESC, v.id DESC
	`

	rows, err := db.Query(query, args...)
	if err != nil {
		return err
	}
	defer rows.Close()

	for rows.Next() {
		var vehicleID, customerID int64
		var plate, brand, model sql.NullString
		var year, km sql.NullInt64

		if err := rows.Scan(&vehicleID, &customerID, &plate, &brand, &model, &year, &km); err != nil {
			return err
		}

		idx, ok := indexByID[customerID]
		if !ok {
			continue
		}

		vehicle := response{
			"id":           vehicleID,
			"customer_id":  customerID,
			"plate_number": nullString(plate),
			"brand":        nullString(brand),
			"model":        nullString(model),
			"year":         nullInt(year),
			"km":           nullInt(km),
		}

		customer := customers[idx]
		vehicles, _ := customer["vehicles"].([]response)
		vehicles = append(vehicles, vehicle)
		customer["vehicles"] = vehicles
		customers[idx] = customer
	}

	return rows.Err()
}
