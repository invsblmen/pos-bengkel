package httpserver

import (
	"database/sql"
	"encoding/json"
	"net/http"
	"strings"
	"time"
)

type mechanicProductivityFilters struct {
	StartDate time.Time
	EndDate   time.Time
}

func mechanicProductivityReportHandler(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if db == nil {
			writeJSON(w, http.StatusServiceUnavailable, response{"message": "database is not configured"})
			return
		}

		filters := parseMechanicProductivityFilters(r)
		mechanics, err := queryMechanicProductivityRows(db, filters)
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, response{"message": "failed to read mechanic productivity data"})
			return
		}

		summary := response{
			"total_mechanics": int64(len(mechanics)),
			"total_revenue":   int64(0),
			"total_orders":    int64(0),
			"total_incentive": int64(0),
			"total_salary":    int64(0),
		}

		for _, item := range mechanics {
			summary["total_revenue"] = summary["total_revenue"].(int64) + toInt64(item["total_revenue"])
			summary["total_orders"] = summary["total_orders"].(int64) + toInt64(item["total_orders"])
			summary["total_incentive"] = summary["total_incentive"].(int64) + toInt64(item["total_incentive"])
			summary["total_salary"] = summary["total_salary"].(int64) + toInt64(item["total_salary"])
		}

		writeJSON(w, http.StatusOK, response{
			"mechanics": mechanics,
			"filters": response{
				"start_date": filters.StartDate.Format("2006-01-02"),
				"end_date":   filters.EndDate.Format("2006-01-02"),
			},
			"summary": summary,
		})
	}
}

func parseMechanicProductivityFilters(r *http.Request) mechanicProductivityFilters {
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

	return mechanicProductivityFilters{
		StartDate: startDate,
		EndDate:   endDate,
	}
}

func queryMechanicProductivityRows(db *sql.DB, filters mechanicProductivityFilters) ([]response, error) {
	start := filters.StartDate.Format("2006-01-02 15:04:05")
	end := filters.EndDate.Format("2006-01-02 15:04:05")

	q := `
		SELECT m.id,
		       m.name,
		       m.specialization,
		       COALESCE(m.hourly_rate, 0) AS hourly_rate,
		       COALESCE(order_summary.total_orders, 0) AS total_orders,
		       COALESCE(order_summary.total_revenue, 0) AS total_revenue,
		       COALESCE(order_summary.total_labor_cost, 0) AS total_labor_cost,
		       COALESCE(order_summary.total_material_cost, 0) AS total_material_cost,
		       COALESCE(detail_summary.service_revenue, 0) AS service_revenue,
		       COALESCE(detail_summary.total_auto_discount, 0) AS total_auto_discount,
		       COALESCE(detail_summary.total_incentive, 0) AS total_incentive,
		       COALESCE(detail_summary.estimated_work_minutes, 0) AS estimated_work_minutes
		FROM mechanics m
		LEFT JOIN (
			SELECT mechanic_id,
			       COUNT(*) AS total_orders,
			       COALESCE(SUM(COALESCE(total, 0)), 0) AS total_revenue,
			       COALESCE(SUM(COALESCE(labor_cost, 0)), 0) AS total_labor_cost,
			       COALESCE(SUM(COALESCE(material_cost, 0)), 0) AS total_material_cost
			FROM service_orders
			WHERE created_at BETWEEN ? AND ?
			  AND status IN ('completed', 'paid')
			  AND mechanic_id IS NOT NULL
			GROUP BY mechanic_id
		) order_summary ON m.id = order_summary.mechanic_id
		LEFT JOIN (
			SELECT so.mechanic_id,
			       COALESCE(SUM(COALESCE(s.est_time_minutes, 0)), 0) AS estimated_work_minutes,
			       COALESCE(SUM(COALESCE(sod.final_amount, 0)), 0) AS service_revenue,
			       COALESCE(SUM(COALESCE(sod.auto_discount_amount, 0)), 0) AS total_auto_discount,
			       COALESCE(SUM(COALESCE(sod.incentive_amount, 0)), 0) AS total_incentive
			FROM service_order_details sod
			JOIN service_orders so ON sod.service_order_id = so.id
			LEFT JOIN services s ON sod.service_id = s.id
			WHERE so.created_at BETWEEN ? AND ?
			  AND so.status IN ('completed', 'paid')
			  AND so.mechanic_id IS NOT NULL
			  AND sod.service_id IS NOT NULL
			GROUP BY so.mechanic_id
		) detail_summary ON m.id = detail_summary.mechanic_id
		ORDER BY COALESCE(order_summary.total_revenue, 0) DESC, m.id ASC
	`

	rows, err := db.Query(q, start, end, start, end)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	items := make([]response, 0)
	for rows.Next() {
		var id sql.NullInt64
		var name sql.NullString
		var specialization sql.NullString
		var hourlyRate sql.NullInt64
		var totalOrders sql.NullInt64
		var totalRevenue sql.NullInt64
		var totalLaborCost sql.NullInt64
		var totalMaterialCost sql.NullInt64
		var serviceRevenue sql.NullInt64
		var totalAutoDiscount sql.NullInt64
		var totalIncentive sql.NullInt64
		var estimatedWorkMinutes sql.NullInt64

		if err := rows.Scan(
			&id,
			&name,
			&specialization,
			&hourlyRate,
			&totalOrders,
			&totalRevenue,
			&totalLaborCost,
			&totalMaterialCost,
			&serviceRevenue,
			&totalAutoDiscount,
			&totalIncentive,
			&estimatedWorkMinutes,
		); err != nil {
			return nil, err
		}

		hourlyRateValue := int64OrZero(hourlyRate)
		estimatedMinutesValue := int64OrZero(estimatedWorkMinutes)
		totalIncentiveValue := int64OrZero(totalIncentive)
		totalOrdersValue := int64OrZero(totalOrders)
		totalRevenueValue := int64OrZero(totalRevenue)
		baseSalary := int64(float64(estimatedMinutesValue) / 60.0 * float64(hourlyRateValue))
		totalSalary := baseSalary + totalIncentiveValue
		avgOrder := int64(0)
		if totalOrdersValue > 0 {
			avgOrder = totalRevenueValue / totalOrdersValue
		}

		items = append(items, response{
			"id":                     int64OrZero(id),
			"name":                   overallNullStringValue(name),
			"specialty":              normalizeSpecialization(overallNullStringValue(specialization)),
			"total_orders":           totalOrdersValue,
			"total_revenue":          totalRevenueValue,
			"service_revenue":        int64OrZero(serviceRevenue),
			"total_auto_discount":    int64OrZero(totalAutoDiscount),
			"total_incentive":        totalIncentiveValue,
			"estimated_work_minutes": estimatedMinutesValue,
			"hourly_rate":            hourlyRateValue,
			"base_salary":            baseSalary,
			"total_salary":           totalSalary,
			"total_labor_cost":       int64OrZero(totalLaborCost),
			"total_material_cost":    int64OrZero(totalMaterialCost),
			"average_order_value":    avgOrder,
		})
	}

	return items, rows.Err()
}

func normalizeSpecialization(raw string) string {
	trimmed := strings.TrimSpace(raw)
	if trimmed == "" {
		return "-"
	}

	if strings.HasPrefix(trimmed, "[") {
		var values []string
		if err := json.Unmarshal([]byte(trimmed), &values); err == nil {
			filtered := make([]string, 0, len(values))
			for _, item := range values {
				item = strings.TrimSpace(item)
				if item != "" {
					filtered = append(filtered, item)
				}
			}
			if len(filtered) > 0 {
				return strings.Join(filtered, ", ")
			}
		}
	}

	return trimmed
}

func toInt64(value any) int64 {
	switch typed := value.(type) {
	case int:
		return int64(typed)
	case int64:
		return typed
	case int32:
		return int64(typed)
	case float64:
		return int64(typed)
	default:
		return 0
	}
}
