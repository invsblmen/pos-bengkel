package httpserver

import (
	"database/sql"
	"math"
	"net/http"
	"net/url"
	"strconv"
	"strings"
)

func mechanicIndexHandler(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if db == nil {
			writeJSON(w, http.StatusServiceUnavailable, response{"message": "database is not configured"})
			return
		}

		q := strings.TrimSpace(r.URL.Query().Get("q"))
		page := mechanicIndexParsePositiveInt(r.URL.Query().Get("page"), 1)
		perPage := 15

		total, err := mechanicIndexCount(db, q)
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, response{"message": "failed to read mechanics"})
			return
		}

		lastPage := 1
		if total > 0 {
			lastPage = int(math.Ceil(float64(total) / float64(perPage)))
		}

		items, err := mechanicIndexQueryItems(db, q, page, perPage)
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, response{"message": "failed to read mechanics"})
			return
		}

		from, to := paginationBounds(total, page, perPage)

		writeJSON(w, http.StatusOK, response{
			"mechanics": response{
				"current_page": page,
				"data":         items,
				"from":         from,
				"last_page":    lastPage,
				"links":        mechanicIndexBuildLinks("/mechanics", r.URL.Query(), page, lastPage),
				"per_page":     perPage,
				"to":           to,
				"total":        total,
			},
			"filters": response{
				"q": q,
			},
		})
	}
}

func mechanicIndexCount(db *sql.DB, q string) (int64, error) {
	const baseQuery = `SELECT COUNT(*) FROM mechanics`
	if q == "" {
		var total int64
		err := db.QueryRow(baseQuery).Scan(&total)
		return total, err
	}

	like := "%" + q + "%"
	var total int64
	err := db.QueryRow(baseQuery+` WHERE name LIKE ? OR phone LIKE ? OR employee_number LIKE ?`, like, like, like).Scan(&total)
	return total, err
}

func mechanicIndexQueryItems(db *sql.DB, q string, page, perPage int) ([]response, error) {
	offset := (page - 1) * perPage
	const selectColumns = `
		SELECT id, name, phone, employee_number, notes, hourly_rate, commission_percentage, created_at, updated_at
		FROM mechanics
	`

	var (
		rows *sql.Rows
		err  error
	)

	if q == "" {
		rows, err = db.Query(selectColumns+` ORDER BY name ASC LIMIT ? OFFSET ?`, perPage, offset)
	} else {
		like := "%" + q + "%"
		rows, err = db.Query(selectColumns+` WHERE name LIKE ? OR phone LIKE ? OR employee_number LIKE ? ORDER BY name ASC LIMIT ? OFFSET ?`, like, like, like, perPage, offset)
	}
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	items := make([]response, 0)
	for rows.Next() {
		var (
			id                   int64
			name                 sql.NullString
			phone                sql.NullString
			employeeNumber       sql.NullString
			notes                sql.NullString
			hourlyRate           sql.NullInt64
			commissionPercentage sql.NullFloat64
			createdAt            sql.NullTime
			updatedAt            sql.NullTime
		)

		if err := rows.Scan(&id, &name, &phone, &employeeNumber, &notes, &hourlyRate, &commissionPercentage, &createdAt, &updatedAt); err != nil {
			return nil, err
		}

		items = append(items, response{
			"id":                    id,
			"name":                  nullString(name),
			"phone":                 nullString(phone),
			"employee_number":       nullString(employeeNumber),
			"notes":                 nullString(notes),
			"hourly_rate":           mechanicIndexNullInt64(hourlyRate),
			"commission_percentage": mechanicIndexNullFloat64(commissionPercentage),
			"created_at":            timeToISO(createdAt),
			"updated_at":            timeToISO(updatedAt),
		})
	}

	if err := rows.Err(); err != nil {
		return nil, err
	}

	return items, nil
}

func mechanicIndexParsePositiveInt(raw string, fallback int) int {
	parsed, err := strconv.Atoi(strings.TrimSpace(raw))
	if err != nil || parsed <= 0 {
		return fallback
	}
	return parsed
}

func mechanicIndexBuildLinks(basePath string, query url.Values, page, lastPage int) []response {
	buildURL := func(targetPage int) any {
		if targetPage < 1 || targetPage > lastPage {
			return nil
		}

		q := url.Values{}
		for key, values := range query {
			copied := make([]string, len(values))
			copy(copied, values)
			q[key] = copied
		}
		q.Set("page", strconv.Itoa(targetPage))
		encoded := q.Encode()
		if encoded == "" {
			return basePath
		}

		return basePath + "?" + encoded
	}

	links := make([]response, 0, lastPage+2)
	links = append(links, response{
		"url":    buildURL(page - 1),
		"label":  "&laquo; Previous",
		"active": false,
	})

	for p := 1; p <= lastPage; p++ {
		links = append(links, response{
			"url":    buildURL(p),
			"label":  strconv.Itoa(p),
			"active": p == page,
		})
	}

	links = append(links, response{
		"url":    buildURL(page + 1),
		"label":  "Next &raquo;",
		"active": false,
	})

	return links
}

func mechanicIndexNullInt64(value sql.NullInt64) any {
	if !value.Valid {
		return nil
	}
	return value.Int64
}

func mechanicIndexNullFloat64(value sql.NullFloat64) any {
	if !value.Valid {
		return nil
	}
	return value.Float64
}