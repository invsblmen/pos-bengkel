package httpserver

import (
	"bytes"
	"database/sql"
	"encoding/csv"
	"net/http"
	"strconv"
	"strings"
)

type partSaleWarrantiesExportRow struct {
	sourceLabel        string
	referenceNumber    string
	referenceDate      string
	customerName       string
	vehicleLabel       string
	mechanicName       string
	itemName           string
	itemType           string
	warrantyPeriodDays int64
	warrantyStartDate  string
	warrantyEndDate    string
	statusLabel        string
	claimedAt          string
	claimNotes         string
}

func partSaleWarrantiesExportHandler(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if db == nil {
			writeJSON(w, http.StatusServiceUnavailable, response{"message": "database is not configured"})
			return
		}

		filters := parsePartSaleWarrantiesFilters(r)
		rows, err := queryPartSaleWarrantiesExportRows(db, filters)
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, response{"message": "failed to export warranties"})
			return
		}

		var buffer bytes.Buffer
		writer := csv.NewWriter(&buffer)
		_ = writer.Write([]string{
			"Sumber",
			"No Referensi",
			"Tanggal Referensi",
			"Pelanggan",
			"Kendaraan",
			"Mekanik",
			"Item",
			"Tipe Item",
			"Periode Garansi (Hari)",
			"Mulai Garansi",
			"Akhir Garansi",
			"Status Garansi",
			"Tanggal Klaim",
			"Catatan Klaim",
		})

		for _, row := range rows {
			_ = writer.Write([]string{
				row.sourceLabel,
				row.referenceNumber,
				row.referenceDate,
				row.customerName,
				row.vehicleLabel,
				row.mechanicName,
				row.itemName,
				row.itemType,
				formatInt64CSV(row.warrantyPeriodDays),
				row.warrantyStartDate,
				row.warrantyEndDate,
				row.statusLabel,
				row.claimedAt,
				row.claimNotes,
			})
		}

		writer.Flush()
		if err := writer.Error(); err != nil {
			writeJSON(w, http.StatusInternalServerError, response{"message": "failed to generate warranties csv"})
			return
		}

		w.Header().Set("Content-Type", "text/csv")
		w.Header().Set("Content-Disposition", "attachment; filename=unified-warranties-export.csv")
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write(buffer.Bytes())
	}
}

func queryPartSaleWarrantiesExportRows(db *sql.DB, f partSaleWarrantiesFilters) ([]partSaleWarrantiesExportRow, error) {
	whereClause, args := buildPartSaleWarrantiesWhereClause(f)

	dataQuery := `
		SELECT wr.source_type,
		       COALESCE(ps.sale_number, so.order_number, '-') AS reference_number,
		       DATE_FORMAT(COALESCE(ps.sale_date, so.created_at), '%Y-%m-%d') AS reference_date,
		       c.name AS customer_name,
		       v.plate_number, v.brand, v.model,
		       m.name AS mechanic_name,
		       JSON_UNQUOTE(JSON_EXTRACT(wr.metadata, '$.item_name')) AS item_name,
		       JSON_UNQUOTE(JSON_EXTRACT(wr.metadata, '$.part_name')) AS part_name,
		       wr.warrantable_type,
		       COALESCE(wr.warranty_period_days, 0),
		       DATE_FORMAT(wr.warranty_start_date, '%Y-%m-%d') AS warranty_start_date,
		       DATE_FORMAT(wr.warranty_end_date, '%Y-%m-%d') AS warranty_end_date,
		       DATE_FORMAT(wr.claimed_at, '%Y-%m-%d %H:%i:%s') AS claimed_at,
		       wr.claim_notes
		FROM warranty_registrations wr
		LEFT JOIN customers c ON c.id = wr.customer_id
		LEFT JOIN vehicles v ON v.id = wr.vehicle_id
		LEFT JOIN part_sales ps ON wr.source_type = 'App\\Models\\PartSale' AND ps.id = wr.source_id
		LEFT JOIN service_orders so ON wr.source_type = 'App\\Models\\ServiceOrder' AND so.id = wr.source_id
		LEFT JOIN mechanics m ON m.id = so.mechanic_id
	` + whereClause + `
		ORDER BY CASE WHEN wr.claimed_at IS NULL THEN 0 ELSE 1 END ASC, wr.warranty_end_date ASC
	`

	rows, err := db.Query(dataQuery, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	items := make([]partSaleWarrantiesExportRow, 0)
	for rows.Next() {
		var sourceType sql.NullString
		var referenceNumber sql.NullString
		var referenceDate sql.NullString
		var customerName sql.NullString
		var plateNumber sql.NullString
		var vehicleBrand sql.NullString
		var vehicleModel sql.NullString
		var mechanicName sql.NullString
		var itemName sql.NullString
		var partName sql.NullString
		var warrantableType sql.NullString
		var warrantyPeriodDays sql.NullInt64
		var warrantyStartDate sql.NullString
		var warrantyEndDate sql.NullString
		var claimedAt sql.NullString
		var claimNotes sql.NullString

		if err := rows.Scan(
			&sourceType,
			&referenceNumber,
			&referenceDate,
			&customerName,
			&plateNumber, &vehicleBrand, &vehicleModel,
			&mechanicName,
			&itemName, &partName,
			&warrantableType,
			&warrantyPeriodDays,
			&warrantyStartDate,
			&warrantyEndDate,
			&claimedAt,
			&claimNotes,
		); err != nil {
			return nil, err
		}

		itemNameValue := fallbackString(itemName, "")
		if itemNameValue == "" {
			itemNameValue = fallbackString(partName, "-")
		}

		sourceTypeValue := nullStringValue(sourceType)
		sourceLabel := "Service Order"
		if sourceTypeValue == "App\\Models\\PartSale" {
			sourceLabel = "Part Sale"
		}

		vehicleLabel := "-"
		if nullStringValue(plateNumber) != "" || nullStringValue(vehicleBrand) != "" || nullStringValue(vehicleModel) != "" {
			vehicleLabel = stringsTrimJoinSpace(nullStringValue(plateNumber), nullStringValue(vehicleBrand), nullStringValue(vehicleModel))
		}

		itemType := "Sparepart"
		if nullStringValue(warrantableType) == "App\\Models\\Service" {
			itemType = "Service"
		}

		statusLabel := resolveWarrantyStatusText(claimedAt, warrantyEndDate, f.ExpiringInDays)
		claimedAtValue := fallbackString(claimedAt, "-")
		claimNotesValue := fallbackString(claimNotes, "-")
		if claimNotesValue == "" {
			claimNotesValue = "-"
		}

		items = append(items, partSaleWarrantiesExportRow{
			sourceLabel:        sourceLabel,
			referenceNumber:    fallbackString(referenceNumber, "-"),
			referenceDate:      fallbackString(referenceDate, "-"),
			customerName:       fallbackString(customerName, "-"),
			vehicleLabel:       vehicleLabel,
			mechanicName:       fallbackString(mechanicName, "-"),
			itemName:           itemNameValue,
			itemType:           itemType,
			warrantyPeriodDays: int64OrZero(warrantyPeriodDays),
			warrantyStartDate:  fallbackString(warrantyStartDate, "-"),
			warrantyEndDate:    fallbackString(warrantyEndDate, "-"),
			statusLabel:        statusLabel,
			claimedAt:          claimedAtValue,
			claimNotes:         claimNotesValue,
		})
	}

	if err := rows.Err(); err != nil {
		return nil, err
	}

	return items, nil
}

func stringsTrimJoinSpace(parts ...string) string {
	cleaned := make([]string, 0, len(parts))
	for _, part := range parts {
		trimmed := strings.TrimSpace(part)
		if trimmed != "" {
			cleaned = append(cleaned, trimmed)
		}
	}
	if len(cleaned) == 0 {
		return "-"
	}
	return strings.Join(cleaned, " ")
}

func formatInt64CSV(v int64) string {
	return strconv.FormatInt(v, 10)
}
