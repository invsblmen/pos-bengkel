package httpserver

import (
	"database/sql"
	"net/http"
)

func mechanicPayrollReportHandler(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if db == nil {
			writeJSON(w, http.StatusServiceUnavailable, response{"message": "database is not configured"})
			return
		}

		filters := parseMechanicProductivityFilters(r)
		mechanics, err := queryMechanicPayrollRows(db, filters)
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, response{"message": "failed to read mechanic payroll data"})
			return
		}

		summary := response{
			"total_mechanics":     int64(len(mechanics)),
			"total_base_salary":   int64(0),
			"total_incentive":     int64(0),
			"total_take_home_pay": int64(0),
		}

		for _, item := range mechanics {
			summary["total_base_salary"] = summary["total_base_salary"].(int64) + toInt64(item["base_salary"])
			summary["total_incentive"] = summary["total_incentive"].(int64) + toInt64(item["incentive_amount"])
			summary["total_take_home_pay"] = summary["total_take_home_pay"].(int64) + toInt64(item["take_home_pay"])
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

func queryMechanicPayrollRows(db *sql.DB, filters mechanicProductivityFilters) ([]response, error) {
	start := filters.StartDate.Format("2006-01-02 15:04:05")
	end := filters.EndDate.Format("2006-01-02 15:04:05")

	q := `
		SELECT m.id,
		       m.name,
		       m.employee_number,
		       COALESCE(m.hourly_rate, 0) AS hourly_rate,
		       COALESCE(order_summary.total_orders, 0) AS total_orders,
		       COALESCE(detail_summary.service_count, 0) AS service_count,
		       COALESCE(detail_summary.estimated_work_minutes, 0) AS estimated_work_minutes,
		       COALESCE(detail_summary.total_incentive, 0) AS total_incentive
		FROM mechanics m
		LEFT JOIN (
			SELECT mechanic_id,
			       COUNT(*) AS total_orders
			FROM service_orders
			WHERE created_at BETWEEN ? AND ?
			  AND status IN ('completed', 'paid')
			  AND mechanic_id IS NOT NULL
			GROUP BY mechanic_id
		) order_summary ON m.id = order_summary.mechanic_id
		LEFT JOIN (
			SELECT so.mechanic_id,
			       COUNT(*) AS service_count,
			       COALESCE(SUM(COALESCE(s.est_time_minutes, 0)), 0) AS estimated_work_minutes,
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
		ORDER BY (COALESCE(detail_summary.estimated_work_minutes, 0) / 60.0 * COALESCE(m.hourly_rate, 0) + COALESCE(detail_summary.total_incentive, 0)) DESC, m.id ASC
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
		var employeeNumber sql.NullString
		var hourlyRate sql.NullInt64
		var totalOrders sql.NullInt64
		var serviceCount sql.NullInt64
		var estimatedWorkMinutes sql.NullInt64
		var totalIncentive sql.NullInt64

		if err := rows.Scan(
			&id,
			&name,
			&employeeNumber,
			&hourlyRate,
			&totalOrders,
			&serviceCount,
			&estimatedWorkMinutes,
			&totalIncentive,
		); err != nil {
			return nil, err
		}

		hourlyRateValue := int64OrZero(hourlyRate)
		estimatedMinutesValue := int64OrZero(estimatedWorkMinutes)
		incentiveValue := int64OrZero(totalIncentive)
		baseSalary := int64(float64(estimatedMinutesValue) / 60.0 * float64(hourlyRateValue))

		items = append(items, response{
			"id":                     int64OrZero(id),
			"name":                   overallNullStringValue(name),
			"employee_number":        overallNullStringValue(employeeNumber),
			"total_orders":           int64OrZero(totalOrders),
			"service_count":          int64OrZero(serviceCount),
			"estimated_work_minutes": estimatedMinutesValue,
			"hourly_rate":            hourlyRateValue,
			"base_salary":            baseSalary,
			"incentive_amount":       incentiveValue,
			"take_home_pay":          baseSalary + incentiveValue,
		})
	}

	return items, rows.Err()
}
