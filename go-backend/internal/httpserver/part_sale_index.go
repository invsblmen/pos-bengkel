package httpserver

import (
	"database/sql"
	"math"
	"net/http"
)

func partSaleIndexHandler(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if db == nil {
			writeJSON(w, http.StatusServiceUnavailable, response{"message": "database is not configured"})
			return
		}

		perPage := 15
		page := parsePositiveInt(r.URL.Query().Get("page"), 1)

		sales, totalCount, err := queryPartSaleIndexRows(db, page, perPage)
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, response{"message": "failed to read part sales"})
			return
		}

		lastPage := 1
		if totalCount > 0 {
			lastPage = int(math.Ceil(float64(totalCount) / float64(perPage)))
		}
		if page > lastPage {
			page = lastPage
		}
		from, to := paginationBounds(totalCount, page, perPage)

		writeJSON(w, http.StatusOK, response{
			"sales": response{
				"current_page": page,
				"data":         sales,
				"from":         from,
				"last_page":    lastPage,
				"links":        buildReportIndexLinks("/part-sales", r.URL.Query(), page, lastPage),
				"per_page":     perPage,
				"to":           to,
				"total":        totalCount,
			},
			"filters": response{
				"search":         emptyStringToNil(r.URL.Query().Get("search")),
				"status":         emptyStringToNil(r.URL.Query().Get("status")),
				"payment_status": emptyStringToNil(r.URL.Query().Get("payment_status")),
				"customer_id":    emptyStringToNil(r.URL.Query().Get("customer_id")),
			},
		})
	}
}

func queryPartSaleIndexRows(db *sql.DB, page, perPage int) ([]response, int64, error) {
	var total sql.NullInt64
	if err := db.QueryRow(`SELECT COUNT(*) FROM part_sales`).Scan(&total); err != nil {
		return nil, 0, err
	}
	totalCount := int64OrZero(total)

	q := `
		SELECT ps.id,
		       ps.sale_number,
		       DATE_FORMAT(ps.sale_date, '%Y-%m-%d') AS sale_date,
		       COALESCE(ps.grand_total, 0) AS grand_total,
		       COALESCE(ps.payment_status, 'unpaid') AS payment_status,
		       COALESCE(ps.status, 'draft') AS status,
		       c.id AS customer_id,
		       c.name AS customer_name
		FROM part_sales ps
		LEFT JOIN customers c ON c.id = ps.customer_id
		ORDER BY ps.created_at DESC, ps.id DESC
		LIMIT ? OFFSET ?
	`

	rows, err := db.Query(q, perPage, (page-1)*perPage)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()

	items := make([]response, 0)
	for rows.Next() {
		var id sql.NullInt64
		var saleNumber sql.NullString
		var saleDate sql.NullString
		var grandTotal sql.NullInt64
		var paymentStatus sql.NullString
		var status sql.NullString
		var customerID sql.NullInt64
		var customerName sql.NullString

		if err := rows.Scan(&id, &saleNumber, &saleDate, &grandTotal, &paymentStatus, &status, &customerID, &customerName); err != nil {
			return nil, 0, err
		}

		item := response{
			"id":             int64OrZero(id),
			"sale_number":    overallNullStringValue(saleNumber),
			"sale_date":      overallNullStringValue(saleDate),
			"grand_total":    int64OrZero(grandTotal),
			"payment_status": overallNullStringValue(paymentStatus),
			"status":         overallNullStringValue(status),
			"customer":       nil,
		}

		if customerID.Valid {
			item["customer"] = response{
				"id":   customerID.Int64,
				"name": overallNullStringValue(customerName),
			}
		}

		items = append(items, item)
	}

	return items, totalCount, rows.Err()
}
