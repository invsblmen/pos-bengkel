package httpserver

import (
	"database/sql"
	"fmt"
	"math"
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"time"
)

type vehicleIndexParams struct {
	Search        string
	Brand         string
	Year          *int64
	Transmission  string
	ServiceStatus string
	SortBy        string
	SortDirection string
	PerPage       int
	Page          int
}

func vehicleIndexHandler(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if db == nil {
			writeJSON(w, http.StatusServiceUnavailable, response{"message": "database is not configured"})
			return
		}

		params := parseVehicleIndexParams(r)
		vehicles, err := queryVehicleIndexPage(db, r.URL.Query(), params)
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, response{"message": "failed to read vehicles"})
			return
		}

		stats, err := queryVehicleIndexStats(db)
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, response{"message": "failed to read vehicle stats"})
			return
		}

		writeJSON(w, http.StatusOK, response{
			"vehicles": vehicles,
			"stats":    stats,
			"filters": response{
				"search":         params.Search,
				"brand":          params.Brand,
				"year":           yearOrNil(params.Year),
				"transmission":   params.Transmission,
				"service_status": params.ServiceStatus,
				"sort_by":        params.SortBy,
				"sort_direction": params.SortDirection,
				"per_page":       params.PerPage,
			},
		})
	}
}

func parseVehicleIndexParams(r *http.Request) vehicleIndexParams {
	query := r.URL.Query()

	page := parsePositiveInt(query.Get("page"), 1)
	perPage := parsePositiveInt(query.Get("per_page"), 8)
	if perPage > 100 {
		perPage = 100
	}

	sortBy := strings.TrimSpace(query.Get("sort_by"))
	sortDirection := strings.ToLower(strings.TrimSpace(query.Get("sort_direction")))
	if sortDirection != "asc" && sortDirection != "desc" {
		sortDirection = "desc"
	}

	allowedSorts := map[string]bool{
		"created_at":   true,
		"plate_number": true,
		"brand":        true,
		"model":        true,
		"year":         true,
	}
	if !allowedSorts[sortBy] {
		sortBy = "created_at"
	}

	var yearPtr *int64
	if rawYear := strings.TrimSpace(query.Get("year")); rawYear != "" {
		if parsedYear, err := strconv.ParseInt(rawYear, 10, 64); err == nil {
			yearPtr = &parsedYear
		}
	}

	return vehicleIndexParams{
		Search:        strings.TrimSpace(query.Get("search")),
		Brand:         strings.TrimSpace(query.Get("brand")),
		Year:          yearPtr,
		Transmission:  strings.TrimSpace(query.Get("transmission")),
		ServiceStatus: strings.TrimSpace(query.Get("service_status")),
		SortBy:        sortBy,
		SortDirection: sortDirection,
		PerPage:       perPage,
		Page:          page,
	}
}

func queryVehicleIndexPage(db *sql.DB, query url.Values, params vehicleIndexParams) (response, error) {
	whereClause, args := buildVehicleIndexWhereClause(params)
	countQuery := `
		SELECT COUNT(*)
		FROM vehicles v
		LEFT JOIN customers c ON c.id = v.customer_id
	` + whereClause

	var total int64
	if err := db.QueryRow(countQuery, args...).Scan(&total); err != nil {
		return nil, err
	}

	lastPage := 1
	if total > 0 {
		lastPage = int(math.Ceil(float64(total) / float64(params.PerPage)))
	}

	queryPage := params.Page
	if queryPage < 1 {
		queryPage = 1
	}

	dataQuery := `
		SELECT v.id, v.customer_id, v.plate_number, v.brand, v.model, v.year, v.km,
		       v.engine_type, v.transmission_type, v.color, v.cylinder_volume, v.notes,
		       c.id, c.name, c.phone,
		       (
		           SELECT DATE(COALESCE(so.actual_finish_at, so.created_at))
		           FROM service_orders so
		           WHERE so.vehicle_id = v.id
		             AND so.status IN ('completed', 'paid')
		             AND so.odometer_km IS NOT NULL
		           ORDER BY so.created_at DESC, so.id DESC
		           LIMIT 1
		       ) AS last_service_date,
		       COALESCE(
		           (
		               SELECT DATE(so.next_service_date)
		               FROM service_orders so
		               WHERE so.vehicle_id = v.id
		                 AND so.status IN ('pending', 'in_progress')
		                 AND so.next_service_date IS NOT NULL
		               ORDER BY so.next_service_date ASC, so.id ASC
		               LIMIT 1
		           ),
		           (
		               SELECT DATE(so.next_service_date)
		               FROM service_orders so
		               WHERE so.vehicle_id = v.id
		                 AND so.status IN ('completed', 'paid')
		                 AND so.odometer_km IS NOT NULL
		                 AND so.next_service_date IS NOT NULL
		               ORDER BY so.created_at DESC, so.id DESC
		               LIMIT 1
		           )
		       ) AS next_service_date
		FROM vehicles v
		LEFT JOIN customers c ON c.id = v.customer_id
	` + whereClause + buildVehicleIndexOrderClause(params) + `
		LIMIT ? OFFSET ?
	`

	queryArgs := append([]any{}, args...)
	queryArgs = append(queryArgs, params.PerPage, (queryPage-1)*params.PerPage)

	rows, err := db.Query(dataQuery, queryArgs...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	items := make([]response, 0)
	for rows.Next() {
		var id int64
		var customerID sql.NullInt64
		var plate sql.NullString
		var brand sql.NullString
		var model sql.NullString
		var year sql.NullInt64
		var km sql.NullInt64
		var engineType sql.NullString
		var transmissionType sql.NullString
		var color sql.NullString
		var cylinderVolume sql.NullString
		var notes sql.NullString
		var relatedCustomerID sql.NullInt64
		var customerName sql.NullString
		var customerPhone sql.NullString
		var lastServiceDate sql.NullString
		var nextServiceDate sql.NullString

		if err := rows.Scan(&id, &customerID, &plate, &brand, &model, &year, &km, &engineType, &transmissionType, &color, &cylinderVolume, &notes, &relatedCustomerID, &customerName, &customerPhone, &lastServiceDate, &nextServiceDate); err != nil {
			return nil, err
		}

		item := response{
			"id":                id,
			"customer_id":       nullInt(customerID),
			"plate_number":      nullString(plate),
			"brand":             nullString(brand),
			"model":             nullString(model),
			"year":              nullInt(year),
			"km":                nullInt(km),
			"engine_type":       nullString(engineType),
			"transmission_type": nullString(transmissionType),
			"color":             nullString(color),
			"cylinder_volume":   nullString(cylinderVolume),
			"notes":             nullString(notes),
			"last_service_date": stringOrNil(lastServiceDate),
			"next_service_date": stringOrNil(nextServiceDate),
			"customer":          nil,
		}

		if relatedCustomerID.Valid {
			item["customer"] = response{
				"id":    relatedCustomerID.Int64,
				"name":  nullString(customerName),
				"phone": nullString(customerPhone),
			}
		}

		items = append(items, item)
	}

	if err := rows.Err(); err != nil {
		return nil, err
	}

	from, to := paginationBounds(total, queryPage, params.PerPage)

	return response{
		"current_page": queryPage,
		"data":         items,
		"from":         from,
		"last_page":    lastPage,
		"links":        buildVehicleIndexLinks("/vehicles", query, queryPage, lastPage),
		"per_page":     params.PerPage,
		"to":           to,
		"total":        total,
	}, nil
}

func queryVehicleIndexStats(db *sql.DB) (response, error) {
	const q = `
		SELECT
			(SELECT COUNT(*) FROM vehicles) AS total,
			(SELECT COUNT(*)
			 FROM vehicles v
			 WHERE EXISTS (
				SELECT 1
				FROM service_orders so
				WHERE so.vehicle_id = v.id
				  AND so.status IN ('completed', 'paid')
			 )) AS serviced,
			(SELECT COUNT(*)
			 FROM vehicles v
			 WHERE NOT EXISTS (
				SELECT 1
				FROM service_orders so
				WHERE so.vehicle_id = v.id
				  AND so.status IN ('completed', 'paid')
			 )) AS never_serviced,
			(SELECT COUNT(*)
			 FROM vehicles v
			 WHERE EXISTS (
				SELECT 1
				FROM service_orders so
				WHERE so.vehicle_id = v.id
				  AND so.status IN ('completed', 'paid')
				  AND YEAR(so.created_at) = ?
				  AND MONTH(so.created_at) = ?
			 )) AS this_month
	`

	now := time.Now()
	var total int64
	var serviced int64
	var neverServiced int64
	var thisMonth int64
	if err := db.QueryRow(q, now.Year(), int(now.Month())).Scan(&total, &serviced, &neverServiced, &thisMonth); err != nil {
		return nil, err
	}

	return response{
		"total":          total,
		"serviced":       serviced,
		"never_serviced": neverServiced,
		"this_month":     thisMonth,
	}, nil
}

func buildVehicleIndexWhereClause(params vehicleIndexParams) (string, []any) {
	clauses := make([]string, 0)
	args := make([]any, 0)

	if params.Search != "" {
		clauses = append(clauses, "(v.plate_number LIKE ? OR COALESCE(v.brand, '') LIKE ? OR COALESCE(v.model, '') LIKE ? OR COALESCE(c.name, '') LIKE ?)")
		search := "%" + params.Search + "%"
		args = append(args, search, search, search, search)
	}
	if params.Brand != "" {
		clauses = append(clauses, "v.brand = ?")
		args = append(args, params.Brand)
	}
	if params.Year != nil {
		clauses = append(clauses, "v.year = ?")
		args = append(args, *params.Year)
	}
	if params.Transmission != "" {
		clauses = append(clauses, "v.transmission_type = ?")
		args = append(args, params.Transmission)
	}
	switch params.ServiceStatus {
	case "serviced":
		clauses = append(clauses, "EXISTS (SELECT 1 FROM service_orders so WHERE so.vehicle_id = v.id AND so.status IN ('completed', 'paid'))")
	case "never":
		clauses = append(clauses, "NOT EXISTS (SELECT 1 FROM service_orders so WHERE so.vehicle_id = v.id AND so.status IN ('completed', 'paid'))")
	}

	if len(clauses) == 0 {
		return "", args
	}

	return " WHERE " + strings.Join(clauses, " AND "), args
}

func buildVehicleIndexOrderClause(params vehicleIndexParams) string {
	column := "v.created_at"
	switch params.SortBy {
	case "plate_number":
		column = "v.plate_number"
	case "brand":
		column = "v.brand"
	case "model":
		column = "v.model"
	case "year":
		column = "v.year"
	}

	return fmt.Sprintf(" ORDER BY %s %s, v.id DESC", column, strings.ToUpper(params.SortDirection))
}

func buildVehicleIndexLinks(basePath string, query url.Values, currentPage, lastPage int) []response {
	if currentPage < 1 {
		currentPage = 1
	}
	if lastPage < 1 {
		lastPage = 1
	}

	activePage := currentPage
	if activePage > lastPage {
		activePage = lastPage
	}

	links := make([]response, 0)
	prevLink := response{
		"url":    nil,
		"label":  "&laquo; Previous",
		"active": false,
	}
	if currentPage > 1 {
		prevLink["url"] = buildVehicleIndexURL(basePath, query, currentPage-1)
	}
	links = append(links, prevLink)

	addPageLink := func(page int) {
		links = append(links, response{
			"url":    buildVehicleIndexURL(basePath, query, page),
			"label":  strconv.Itoa(page),
			"active": page == activePage,
		})
	}

	addEllipsis := func() {
		links = append(links, response{
			"url":    nil,
			"label":  "...",
			"active": false,
		})
	}

	if lastPage <= 7 {
		for page := 1; page <= lastPage; page++ {
			addPageLink(page)
		}
	} else {
		addPageLink(1)

		start := activePage - 1
		if start < 2 {
			start = 2
		}
		end := activePage + 1
		if end > lastPage-1 {
			end = lastPage - 1
		}

		if start > 2 {
			addEllipsis()
		}

		for page := start; page <= end; page++ {
			if page > 1 && page < lastPage {
				addPageLink(page)
			}
		}

		if end < lastPage-1 {
			addEllipsis()
		}

		addPageLink(lastPage)
	}

	nextLink := response{
		"url":    nil,
		"label":  "Next &raquo;",
		"active": false,
	}
	if currentPage < lastPage {
		nextLink["url"] = buildVehicleIndexURL(basePath, query, currentPage+1)
	}
	links = append(links, nextLink)

	return links
}

func buildVehicleIndexURL(basePath string, query url.Values, page int) string {
	values := url.Values{}
	for key, items := range query {
		if key == "page" {
			continue
		}
		for _, item := range items {
			if strings.TrimSpace(item) == "" {
				continue
			}
			values.Add(key, item)
		}
	}

	if page > 1 {
		values.Set("page", strconv.Itoa(page))
	}

	encoded := values.Encode()
	if encoded == "" {
		return basePath
	}

	return basePath + "?" + encoded
}

func paginationBounds(total int64, currentPage, perPage int) (any, any) {
	if total <= 0 {
		return nil, nil
	}
	if currentPage < 1 {
		currentPage = 1
	}
	start := int64((currentPage-1)*perPage + 1)
	if start > total {
		return nil, nil
	}
	end := int64(currentPage * perPage)
	if end > total {
		end = total
	}
	return start, end
}

func parsePositiveInt(raw string, fallback int) int {
	parsed, err := strconv.Atoi(strings.TrimSpace(raw))
	if err != nil || parsed <= 0 {
		return fallback
	}
	return parsed
}

func yearOrNil(year *int64) any {
	if year == nil {
		return nil
	}
	return *year
}
