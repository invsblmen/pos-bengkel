package httpserver

import (
	"database/sql"
	"math"
	"net/http"
)

func outstandingPaymentsReportHandler(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if db == nil {
			writeJSON(w, http.StatusServiceUnavailable, response{"message": "database is not configured"})
			return
		}

		perPage := 20
		page := parsePositiveInt(r.URL.Query().Get("page"), 1)

		orders, totalCount, err := queryOutstandingPaymentOrders(db, r, page, perPage)
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, response{"message": "failed to read outstanding payments"})
			return
		}

		totalOutstanding, err := queryOutstandingPaymentSummary(db)
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, response{"message": "failed to read outstanding summary"})
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
			"orders": response{
				"current_page": page,
				"data":         orders,
				"from":         from,
				"last_page":    lastPage,
				"links":        buildReportIndexLinks("/reports/outstanding-payments", r.URL.Query(), page, lastPage),
				"per_page":     perPage,
				"to":           to,
				"total":        totalCount,
			},
			"summary": response{
				"total_outstanding": totalOutstanding,
				"count_outstanding": totalCount,
			},
		})
	}
}

func queryOutstandingPaymentOrders(db *sql.DB, r *http.Request, page, perPage int) ([]response, int64, error) {
	var total sql.NullInt64
	countQuery := `SELECT COUNT(*) FROM service_orders WHERE status = 'completed'`
	if err := db.QueryRow(countQuery).Scan(&total); err != nil {
		return nil, 0, err
	}
	totalCount := int64OrZero(total)

	q := `
		SELECT so.id,
		       so.order_number,
		       c.name AS customer_name,
		       v.plate_number,
		       COALESCE(so.total, 0) AS total,
		       COALESCE(so.labor_cost, 0) AS labor_cost,
		       COALESCE(so.material_cost, 0) AS material_cost,
		       so.status,
		       GREATEST(0, TIMESTAMPDIFF(DAY, so.created_at, NOW())) AS days_outstanding,
		       DATE_FORMAT(so.created_at, '%Y-%m-%d %H:%i:%s') AS created_at
		FROM service_orders so
		LEFT JOIN customers c ON c.id = so.customer_id
		LEFT JOIN vehicles v ON v.id = so.vehicle_id
		WHERE so.status = 'completed'
		ORDER BY so.created_at DESC, so.id DESC
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
		var orderNumber sql.NullString
		var customerName sql.NullString
		var vehiclePlate sql.NullString
		var total sql.NullInt64
		var laborCost sql.NullInt64
		var materialCost sql.NullInt64
		var status sql.NullString
		var daysOutstanding sql.NullInt64
		var createdAt sql.NullString

		if err := rows.Scan(
			&id,
			&orderNumber,
			&customerName,
			&vehiclePlate,
			&total,
			&laborCost,
			&materialCost,
			&status,
			&daysOutstanding,
			&createdAt,
		); err != nil {
			return nil, 0, err
		}

		items = append(items, response{
			"id":               int64OrZero(id),
			"order_number":     overallNullStringValue(orderNumber),
			"customer_name":    overallNullStringValue(customerName),
			"vehicle_plate":    overallNullStringValue(vehiclePlate),
			"total":            int64OrZero(total),
			"labor_cost":       int64OrZero(laborCost),
			"material_cost":    int64OrZero(materialCost),
			"status":           overallNullStringValue(status),
			"days_outstanding": int64OrZero(daysOutstanding),
			"created_at":       overallNullStringValue(createdAt),
		})
	}

	return items, totalCount, rows.Err()
}

func queryOutstandingPaymentSummary(db *sql.DB) (int64, error) {
	q := `SELECT COALESCE(SUM(total), 0) AS total_outstanding FROM service_orders WHERE status = 'completed'`
	var totalOutstanding sql.NullInt64
	if err := db.QueryRow(q).Scan(&totalOutstanding); err != nil {
		return 0, err
	}
	return int64OrZero(totalOutstanding), nil
}
