package httpserver

import (
	"database/sql"
	"fmt"
	"math"
	"net/http"
	"strings"
)

type lowStockIndexParams struct {
	SortBy        string
	SortDirection string
	PerPage       int
	Page          int
}

func lowStockIndexHandler(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if db == nil {
			writeJSON(w, http.StatusServiceUnavailable, response{"message": "database is not configured"})
			return
		}

		params := parseLowStockIndexParams(r)

		if _, err := db.Exec("UPDATE low_stock_alerts SET is_read = 1 WHERE is_read = 0"); err != nil {
			writeJSON(w, http.StatusInternalServerError, response{"message": "failed to update alert read status"})
			return
		}

		alerts, err := queryLowStockIndexPage(db, r, params)
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, response{"message": "failed to read low stock alerts"})
			return
		}

		writeJSON(w, http.StatusOK, response{
			"alerts": alerts,
			"filters": response{
				"sort_by":        params.SortBy,
				"sort_direction": params.SortDirection,
			},
		})
	}
}

func parseLowStockIndexParams(r *http.Request) lowStockIndexParams {
	q := r.URL.Query()
	sortBy := strings.TrimSpace(q.Get("sort_by"))
	sortDirection := strings.ToLower(strings.TrimSpace(q.Get("sort_direction")))
	if sortDirection != "asc" && sortDirection != "desc" {
		sortDirection = "desc"
	}

	if sortBy == "" {
		sortBy = "created_at"
	}

	return lowStockIndexParams{
		SortBy:        sortBy,
		SortDirection: sortDirection,
		PerPage:       parsePositiveInt(q.Get("per_page"), 10),
		Page:          parsePositiveInt(q.Get("page"), 1),
	}
}

func queryLowStockIndexPage(db *sql.DB, r *http.Request, params lowStockIndexParams) (response, error) {
	if params.PerPage > 100 {
		params.PerPage = 100
	}

	const countQuery = `
		SELECT COUNT(*)
		FROM low_stock_alerts lsa
		LEFT JOIN parts p ON p.id = lsa.part_id
	`

	var total int64
	if err := db.QueryRow(countQuery).Scan(&total); err != nil {
		return nil, err
	}

	lastPage := 1
	if total > 0 {
		lastPage = int(math.Ceil(float64(total) / float64(params.PerPage)))
	}

	currentPage := params.Page
	if currentPage < 1 {
		currentPage = 1
	}
	if currentPage > lastPage {
		currentPage = lastPage
	}

	orderBy := buildLowStockOrderClause(params)
	dataQuery := `
		SELECT lsa.id, lsa.current_stock, lsa.minimal_stock, lsa.is_read,
		       DATE_FORMAT(lsa.created_at, '%Y-%m-%d %H:%i:%s') AS created_at,
		       p.id, p.name, p.part_number, p.rack_location,
		       s.id, s.name
		FROM low_stock_alerts lsa
		LEFT JOIN parts p ON p.id = lsa.part_id
		LEFT JOIN suppliers s ON s.id = p.supplier_id
	` + orderBy + `
		LIMIT ? OFFSET ?
	`

	rows, err := db.Query(dataQuery, params.PerPage, (currentPage-1)*params.PerPage)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	items := make([]response, 0)
	for rows.Next() {
		var alertID int64
		var currentStock sql.NullInt64
		var minimalStock sql.NullInt64
		var isRead sql.NullBool
		var createdAt sql.NullString

		var partID sql.NullInt64
		var partName sql.NullString
		var partNumber sql.NullString
		var rackLocation sql.NullString

		var supplierID sql.NullInt64
		var supplierName sql.NullString

		if err := rows.Scan(
			&alertID, &currentStock, &minimalStock, &isRead, &createdAt,
			&partID, &partName, &partNumber, &rackLocation,
			&supplierID, &supplierName,
		); err != nil {
			return nil, err
		}

		item := response{
			"id":            alertID,
			"current_stock": intOrDefault(currentStock, 0),
			"minimal_stock": intOrDefault(minimalStock, 0),
			"is_read":       boolOrDefault(isRead, false),
			"created_at":    stringOrNil(createdAt),
			"part":          nil,
		}

		if partID.Valid {
			part := response{
				"id":            partID.Int64,
				"name":          nullString(partName),
				"part_number":   nullString(partNumber),
				"rack_location": nullString(rackLocation),
				"supplier":      nil,
			}

			if supplierID.Valid {
				part["supplier"] = response{
					"id":   supplierID.Int64,
					"name": nullString(supplierName),
				}
			}

			item["part"] = part
		}

		items = append(items, item)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}

	from, to := paginationBounds(total, currentPage, params.PerPage)

	return response{
		"current_page": currentPage,
		"data":         items,
		"from":         from,
		"last_page":    lastPage,
		"links":        buildReportIndexLinks("/parts/low-stock", r.URL.Query(), currentPage, lastPage),
		"per_page":     params.PerPage,
		"to":           to,
		"total":        total,
	}, nil
}

func buildLowStockOrderClause(params lowStockIndexParams) string {
	direction := strings.ToUpper(params.SortDirection)
	if direction != "ASC" && direction != "DESC" {
		direction = "DESC"
	}

	switch params.SortBy {
	case "name", "part_number", "rack_location":
		return fmt.Sprintf(" ORDER BY p.%s %s, lsa.id DESC", params.SortBy, direction)
	case "current_stock", "minimal_stock", "created_at":
		return fmt.Sprintf(" ORDER BY lsa.%s %s, lsa.id DESC", params.SortBy, direction)
	default:
		return " ORDER BY lsa.created_at DESC, lsa.id DESC"
	}
}

func boolOrDefault(value sql.NullBool, fallback bool) bool {
	if value.Valid {
		return value.Bool
	}
	return fallback
}
