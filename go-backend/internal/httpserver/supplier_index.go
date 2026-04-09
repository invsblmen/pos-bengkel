package httpserver

import (
	"database/sql"
	"math"
	"net/http"
	"net/url"
	"strconv"
	"strings"
)

func supplierIndexHandler(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if db == nil {
			writeJSON(w, http.StatusServiceUnavailable, response{"message": "database is not configured"})
			return
		}

		q := strings.TrimSpace(r.URL.Query().Get("q"))
		page := supplierIndexParsePositiveInt(r.URL.Query().Get("page"), 1)
		perPage := 15

		total, err := supplierIndexCount(db, q)
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, response{"message": "failed to read suppliers"})
			return
		}

		lastPage := 1
		if total > 0 {
			lastPage = int(math.Ceil(float64(total) / float64(perPage)))
		}

		items, err := supplierIndexQueryItems(db, q, page, perPage)
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, response{"message": "failed to read suppliers"})
			return
		}

		from, to := paginationBounds(total, page, perPage)

		writeJSON(w, http.StatusOK, response{
			"suppliers": response{
				"current_page": page,
				"data":         items,
				"from":         from,
				"last_page":    lastPage,
				"links":        supplierIndexBuildLinks("/suppliers", r.URL.Query(), page, lastPage),
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

func supplierIndexCount(db *sql.DB, q string) (int64, error) {
	const baseQuery = `SELECT COUNT(*) FROM suppliers`
	if q == "" {
		var total int64
		err := db.QueryRow(baseQuery).Scan(&total)
		return total, err
	}

	like := "%" + q + "%"
	var total int64
	err := db.QueryRow(baseQuery+` WHERE name LIKE ? OR phone LIKE ? OR email LIKE ? OR contact_person LIKE ?`, like, like, like, like).Scan(&total)
	return total, err
}

func supplierIndexQueryItems(db *sql.DB, q string, page, perPage int) ([]response, error) {
	offset := (page - 1) * perPage
	const selectColumns = `
		SELECT id, name, phone, email, address, contact_person, created_at, updated_at
		FROM suppliers
	`

	var (
		rows *sql.Rows
		err  error
	)

	if q == "" {
		rows, err = db.Query(selectColumns+` ORDER BY name ASC LIMIT ? OFFSET ?`, perPage, offset)
	} else {
		like := "%" + q + "%"
		rows, err = db.Query(selectColumns+` WHERE name LIKE ? OR phone LIKE ? OR email LIKE ? OR contact_person LIKE ? ORDER BY name ASC LIMIT ? OFFSET ?`, like, like, like, like, perPage, offset)
	}
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	items := make([]response, 0)
	for rows.Next() {
		var (
			id            int64
			name          sql.NullString
			phone         sql.NullString
			email         sql.NullString
			address       sql.NullString
			contactPerson sql.NullString
			createdAt     sql.NullTime
			updatedAt     sql.NullTime
		)

		if err := rows.Scan(&id, &name, &phone, &email, &address, &contactPerson, &createdAt, &updatedAt); err != nil {
			return nil, err
		}

		items = append(items, response{
			"id":             id,
			"name":           nullString(name),
			"phone":          nullString(phone),
			"email":          nullString(email),
			"address":        nullString(address),
			"contact_person": nullString(contactPerson),
			"created_at":     timeToISO(createdAt),
			"updated_at":     timeToISO(updatedAt),
		})
	}

	if err := rows.Err(); err != nil {
		return nil, err
	}

	return items, nil
}

func supplierIndexParsePositiveInt(raw string, fallback int) int {
	parsed, err := strconv.Atoi(strings.TrimSpace(raw))
	if err != nil || parsed <= 0 {
		return fallback
	}
	return parsed
}

func supplierIndexBuildLinks(basePath string, query url.Values, page, lastPage int) []response {
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
