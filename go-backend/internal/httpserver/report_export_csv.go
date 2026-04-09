package httpserver

import (
	"bytes"
	"database/sql"
	"encoding/csv"
	"fmt"
	"net/http"
	"strings"
	"time"
)

func reportExportCSVHandler(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if db == nil {
			writeJSON(w, http.StatusServiceUnavailable, response{"message": "database is not configured"})
			return
		}

		typeFilter := strings.TrimSpace(r.URL.Query().Get("type"))
		if typeFilter == "" {
			typeFilter = "revenue"
		}

		now := time.Now()
		startDefault := time.Date(now.Year(), now.Month(), 1, 0, 0, 0, 0, now.Location())
		startDate := parseDateOnlyOrDefault(r.URL.Query().Get("start_date"), startDefault)
		parsedEnd := parseDateOnlyOrDefault(r.URL.Query().Get("end_date"), now)
		endDate := time.Date(parsedEnd.Year(), parsedEnd.Month(), parsedEnd.Day(), 23, 59, 59, 0, parsedEnd.Location())

		filename := fmt.Sprintf("%s_report_%s.csv", typeFilter, now.Format("2006-01-02_150405"))

		var buffer bytes.Buffer
		writer := csv.NewWriter(&buffer)

		switch typeFilter {
		case "mechanic_productivity":
			if err := exportMechanicProductivityCSV(writer, db, startDate, endDate); err != nil {
				writeJSON(w, http.StatusInternalServerError, response{"message": "failed to export mechanic productivity report"})
				return
			}
		case "mechanic_payroll":
			if err := exportMechanicPayrollCSV(writer, db, startDate, endDate); err != nil {
				writeJSON(w, http.StatusInternalServerError, response{"message": "failed to export mechanic payroll report"})
				return
			}
		case "overall":
			if err := exportOverallCSV(writer, db, r, startDate, endDate); err != nil {
				writeJSON(w, http.StatusInternalServerError, response{"message": "failed to export overall report"})
				return
			}
		default:
			if err := exportRevenueCSV(writer, db, startDate, endDate); err != nil {
				writeJSON(w, http.StatusInternalServerError, response{"message": "failed to export revenue report"})
				return
			}
		}

		writer.Flush()
		if err := writer.Error(); err != nil {
			writeJSON(w, http.StatusInternalServerError, response{"message": "failed to write csv payload"})
			return
		}

		w.Header().Set("Content-Type", "text/csv; charset=utf-8")
		w.Header().Set("Content-Disposition", fmt.Sprintf("attachment; filename=%s", filename))
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write(buffer.Bytes())
	}
}

func exportRevenueCSV(writer *csv.Writer, db *sql.DB, startDate, endDate time.Time) error {
	if err := writer.Write([]string{"Tanggal", "Jumlah Pesanan", "Pendapatan", "Biaya Tenaga Kerja", "Biaya Material"}); err != nil {
		return err
	}

	q := `
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

	rows, err := db.Query(q, startDate.Format("2006-01-02 15:04:05"), endDate.Format("2006-01-02 15:04:05"))
	if err != nil {
		return err
	}
	defer rows.Close()

	for rows.Next() {
		var date sql.NullString
		var count sql.NullInt64
		var revenue sql.NullInt64
		var laborCost sql.NullInt64
		var materialCost sql.NullInt64

		if err := rows.Scan(&date, &count, &revenue, &laborCost, &materialCost); err != nil {
			return err
		}

		if err := writer.Write([]string{
			overallNullStringValue(date),
			fmt.Sprint(int64OrZero(count)),
			fmt.Sprint(int64OrZero(revenue)),
			fmt.Sprint(int64OrZero(laborCost)),
			fmt.Sprint(int64OrZero(materialCost)),
		}); err != nil {
			return err
		}
	}

	return rows.Err()
}

func exportMechanicProductivityCSV(writer *csv.Writer, db *sql.DB, startDate, endDate time.Time) error {
	if err := writer.Write([]string{"Mekanik", "Total Order", "Total Revenue", "Auto Diskon", "Insentif", "Estimasi Menit Kerja", "Tarif per Jam", "Gaji Pokok", "Total Gaji"}); err != nil {
		return err
	}

	filters := mechanicProductivityFilters{StartDate: startDate, EndDate: endDate}
	rows, err := queryMechanicProductivityRows(db, filters)
	if err != nil {
		return err
	}

	for _, row := range rows {
		if err := writer.Write([]string{
			fmt.Sprint(row["name"]),
			fmt.Sprint(row["total_orders"]),
			fmt.Sprint(row["total_revenue"]),
			fmt.Sprint(row["total_auto_discount"]),
			fmt.Sprint(row["total_incentive"]),
			fmt.Sprint(row["estimated_work_minutes"]),
			fmt.Sprint(row["hourly_rate"]),
			fmt.Sprint(row["base_salary"]),
			fmt.Sprint(row["total_salary"]),
		}); err != nil {
			return err
		}
	}

	return nil
}

func exportMechanicPayrollCSV(writer *csv.Writer, db *sql.DB, startDate, endDate time.Time) error {
	if err := writer.Write([]string{"Mekanik", "No Pegawai", "Total Order", "Jumlah Layanan", "Estimasi Menit Kerja", "Tarif per Jam", "Gaji Pokok", "Insentif", "Take Home Pay"}); err != nil {
		return err
	}

	filters := mechanicProductivityFilters{StartDate: startDate, EndDate: endDate}
	rows, err := queryMechanicPayrollRows(db, filters)
	if err != nil {
		return err
	}

	for _, row := range rows {
		if err := writer.Write([]string{
			fmt.Sprint(row["name"]),
			fmt.Sprint(row["employee_number"]),
			fmt.Sprint(row["total_orders"]),
			fmt.Sprint(row["service_count"]),
			fmt.Sprint(row["estimated_work_minutes"]),
			fmt.Sprint(row["hourly_rate"]),
			fmt.Sprint(row["base_salary"]),
			fmt.Sprint(row["incentive_amount"]),
			fmt.Sprint(row["take_home_pay"]),
		}); err != nil {
			return err
		}
	}

	return nil
}

func exportOverallCSV(writer *csv.Writer, db *sql.DB, r *http.Request, startDate, endDate time.Time) error {
	if err := writer.Write([]string{"Tanggal", "Sumber", "Referensi", "Keterangan", "Arus", "Nominal", "Status", "Status Label", "Saldo Berjalan"}); err != nil {
		return err
	}

	source := strings.TrimSpace(r.URL.Query().Get("source"))
	switch source {
	case "all", "service_order", "part_sale", "cash_transaction":
	default:
		source = "all"
	}

	status := strings.TrimSpace(r.URL.Query().Get("status"))
	if status == "" {
		status = "all"
	}

	filters := overallReportFilters{
		StartDate: startDate,
		EndDate:   endDate,
		Source:    source,
	}

	outerWhere, outerArgs := overallOuterWhere(filters, status)
	query := `
		SELECT event_at, source, reference, description, flow, amount, status,
		       SUM(CASE WHEN flow = 'in' THEN amount WHEN flow = 'out' THEN -amount ELSE 0 END)
		         OVER (ORDER BY event_at ASC, reference ASC) AS running_balance
		FROM (` + overallRowsSubquery() + `) rows` + outerWhere + `
		ORDER BY event_at DESC, reference DESC
	`

	args := append(overallRowsArgs(filters), outerArgs...)
	rows, err := db.Query(query, args...)
	if err != nil {
		return err
	}
	defer rows.Close()

	for rows.Next() {
		var eventAt sql.NullString
		var rowSource sql.NullString
		var reference sql.NullString
		var description sql.NullString
		var flow sql.NullString
		var amount sql.NullInt64
		var rowStatus sql.NullString
		var runningBalance sql.NullInt64

		if err := rows.Scan(&eventAt, &rowSource, &reference, &description, &flow, &amount, &rowStatus, &runningBalance); err != nil {
			return err
		}

		statusValue := overallNullStringValue(rowStatus)
		if err := writer.Write([]string{
			overallNullStringValue(eventAt),
			overallNullStringValue(rowSource),
			overallNullStringValue(reference),
			overallNullStringValue(description),
			overallNullStringValue(flow),
			fmt.Sprint(int64OrZero(amount)),
			statusValue,
			formatOverallStatusLabel(statusValue),
			fmt.Sprint(int64OrZero(runningBalance)),
		}); err != nil {
			return err
		}
	}

	return rows.Err()
}
