package httpserver

import (
	"database/sql"
	"net/http"
	"strings"
	"time"
)

type serviceRevenueFilters struct {
	StartDate time.Time
	EndDate   time.Time
	Period    string
}

func serviceRevenueReportHandler(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if db == nil {
			writeJSON(w, http.StatusServiceUnavailable, response{"message": "database is not configured"})
			return
		}

		filters := parseServiceRevenueFilters(r)
		reportData, err := queryServiceRevenueRows(db, filters)
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, response{"message": "failed to read service revenue data"})
			return
		}

		summary, err := queryServiceRevenueSummary(db, filters)
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, response{"message": "failed to read service revenue summary"})
			return
		}

		writeJSON(w, http.StatusOK, response{
			"report_data": reportData,
			"filters": response{
				"start_date": filters.StartDate.Format("2006-01-02"),
				"end_date":   filters.EndDate.Format("2006-01-02"),
				"period":     filters.Period,
			},
			"summary": summary,
		})
	}
}

func parseServiceRevenueFilters(r *http.Request) serviceRevenueFilters {
	now := time.Now()
	startDefault := time.Date(now.Year(), now.Month(), 1, 0, 0, 0, 0, now.Location())

	q := r.URL.Query()
	startDate := parseDateOnlyOrDefault(q.Get("start_date"), startDefault)

	var endDate time.Time
	if strings.TrimSpace(q.Get("end_date")) == "" {
		endDate = now
	} else {
		parsedEnd := parseDateOnlyOrDefault(q.Get("end_date"), now)
		endDate = time.Date(parsedEnd.Year(), parsedEnd.Month(), parsedEnd.Day(), 23, 59, 59, 0, parsedEnd.Location())
	}

	period := strings.TrimSpace(q.Get("period"))
	switch period {
	case "daily", "weekly", "monthly":
	default:
		period = "daily"
	}

	return serviceRevenueFilters{
		StartDate: startDate,
		EndDate:   endDate,
		Period:    period,
	}
}

func queryServiceRevenueRows(db *sql.DB, filters serviceRevenueFilters) ([]response, error) {
	start := filters.StartDate.Format("2006-01-02 15:04:05")
	end := filters.EndDate.Format("2006-01-02 15:04:05")

	var query string
	switch filters.Period {
	case "weekly":
		query = `
			SELECT YEAR(created_at) AS year,
			       WEEK(created_at) AS week,
			       COUNT(*) AS count,
			       COALESCE(SUM(COALESCE(total, 0)), 0) AS revenue,
			       COALESCE(SUM(COALESCE(labor_cost, 0)), 0) AS labor_cost,
			       COALESCE(SUM(COALESCE(material_cost, 0)), 0) AS material_cost
			FROM service_orders
			WHERE status IN ('completed', 'paid')
			  AND created_at BETWEEN ? AND ?
			GROUP BY YEAR(created_at), WEEK(created_at)
			ORDER BY year ASC, week ASC
		`
	case "monthly":
		query = `
			SELECT YEAR(created_at) AS year,
			       MONTH(created_at) AS month,
			       COUNT(*) AS count,
			       COALESCE(SUM(COALESCE(total, 0)), 0) AS revenue,
			       COALESCE(SUM(COALESCE(labor_cost, 0)), 0) AS labor_cost,
			       COALESCE(SUM(COALESCE(material_cost, 0)), 0) AS material_cost
			FROM service_orders
			WHERE status IN ('completed', 'paid')
			  AND created_at BETWEEN ? AND ?
			GROUP BY YEAR(created_at), MONTH(created_at)
			ORDER BY year ASC, month ASC
		`
	default:
		query = `
			SELECT DATE(created_at) AS date,
			       COUNT(*) AS count,
			       COALESCE(SUM(COALESCE(total, 0)), 0) AS revenue,
			       COALESCE(SUM(COALESCE(labor_cost, 0)), 0) AS labor_cost,
			       COALESCE(SUM(COALESCE(material_cost, 0)), 0) AS material_cost
			FROM service_orders
			WHERE status IN ('completed', 'paid')
			  AND created_at BETWEEN ? AND ?
			GROUP BY DATE(created_at)
			ORDER BY date ASC
		`
	}

	rows, err := db.Query(query, start, end)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	items := make([]response, 0)
	for rows.Next() {
		var count sql.NullInt64
		var revenue sql.NullInt64
		var laborCost sql.NullInt64
		var materialCost sql.NullInt64

		if filters.Period == "daily" {
			var date sql.NullString
			if err := rows.Scan(&date, &count, &revenue, &laborCost, &materialCost); err != nil {
				return nil, err
			}
			items = append(items, response{
				"date":          overallNullStringValue(date),
				"count":         int64OrZero(count),
				"revenue":       int64OrZero(revenue),
				"labor_cost":    int64OrZero(laborCost),
				"material_cost": int64OrZero(materialCost),
			})
			continue
		}

		var year sql.NullInt64
		if filters.Period == "weekly" {
			var week sql.NullInt64
			if err := rows.Scan(&year, &week, &count, &revenue, &laborCost, &materialCost); err != nil {
				return nil, err
			}
			items = append(items, response{
				"year":          int64OrZero(year),
				"week":          int64OrZero(week),
				"count":         int64OrZero(count),
				"revenue":       int64OrZero(revenue),
				"labor_cost":    int64OrZero(laborCost),
				"material_cost": int64OrZero(materialCost),
			})
			continue
		}

		var month sql.NullInt64
		if err := rows.Scan(&year, &month, &count, &revenue, &laborCost, &materialCost); err != nil {
			return nil, err
		}
		items = append(items, response{
			"year":          int64OrZero(year),
			"month":         int64OrZero(month),
			"count":         int64OrZero(count),
			"revenue":       int64OrZero(revenue),
			"labor_cost":    int64OrZero(laborCost),
			"material_cost": int64OrZero(materialCost),
		})
	}

	return items, rows.Err()
}

func queryServiceRevenueSummary(db *sql.DB, filters serviceRevenueFilters) (response, error) {
	start := filters.StartDate.Format("2006-01-02 15:04:05")
	end := filters.EndDate.Format("2006-01-02 15:04:05")

	q := `
		SELECT COALESCE(SUM(COALESCE(total, 0)), 0) AS total_revenue,
		       COUNT(*) AS total_orders,
		       COALESCE(SUM(COALESCE(labor_cost, 0)), 0) AS total_labor_cost,
		       COALESCE(SUM(COALESCE(material_cost, 0)), 0) AS total_material_cost
		FROM service_orders
		WHERE status IN ('completed', 'paid')
		  AND created_at BETWEEN ? AND ?
	`

	var totalRevenue sql.NullInt64
	var totalOrders sql.NullInt64
	var totalLaborCost sql.NullInt64
	var totalMaterialCost sql.NullInt64
	if err := db.QueryRow(q, start, end).Scan(&totalRevenue, &totalOrders, &totalLaborCost, &totalMaterialCost); err != nil {
		return nil, err
	}

	revenueValue := int64OrZero(totalRevenue)
	orderValue := int64OrZero(totalOrders)
	avgOrder := int64(0)
	if orderValue > 0 {
		avgOrder = revenueValue / orderValue
	}

	return response{
		"total_revenue":       revenueValue,
		"total_orders":        orderValue,
		"total_labor_cost":    int64OrZero(totalLaborCost),
		"total_material_cost": int64OrZero(totalMaterialCost),
		"average_order_value": avgOrder,
	}, nil
}
