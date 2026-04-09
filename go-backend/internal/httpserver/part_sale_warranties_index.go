package httpserver

import (
	"database/sql"
	"math"
	"net/http"
	"strconv"
	"strings"
	"time"
)

type partSaleWarrantiesFilters struct {
	Search         string
	WarrantyStatus string
	SourceType     string
	ItemType       string
	CustomerID     *int64
	VehicleID      *int64
	MechanicID     *int64
	DateFrom       string
	DateTo         string
	ExpiringInDays int
	Page           int
	PerPage        int
}

func partSaleWarrantiesIndexHandler(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if db == nil {
			writeJSON(w, http.StatusServiceUnavailable, response{"message": "database is not configured"})
			return
		}

		filters := parsePartSaleWarrantiesFilters(r)

		warranties, summary, err := queryPartSaleWarrantiesPage(db, r, filters)
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, response{"message": "failed to read warranties"})
			return
		}

		customers, err := queryPartSaleWarrantiesCustomers(db)
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, response{"message": "failed to read customers"})
			return
		}

		vehicles, err := queryPartSaleWarrantiesVehicles(db)
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, response{"message": "failed to read vehicles"})
			return
		}

		mechanics, err := queryPartSaleWarrantiesMechanics(db)
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, response{"message": "failed to read mechanics"})
			return
		}

		writeJSON(w, http.StatusOK, response{
			"warranties": warranties,
			"summary":    summary,
			"filters": response{
				"search":           filters.Search,
				"warranty_status":  filters.WarrantyStatus,
				"source_type":      filters.SourceType,
				"item_type":        filters.ItemType,
				"customer_id":      nullableFilterID(filters.CustomerID),
				"vehicle_id":       nullableFilterID(filters.VehicleID),
				"mechanic_id":      nullableFilterID(filters.MechanicID),
				"date_from":        emptyToNil(filters.DateFrom),
				"date_to":          emptyToNil(filters.DateTo),
				"expiring_in_days": filters.ExpiringInDays,
			},
			"customers": customers,
			"vehicles":  vehicles,
			"mechanics": mechanics,
		})
	}
}

func parsePartSaleWarrantiesFilters(r *http.Request) partSaleWarrantiesFilters {
	q := r.URL.Query()
	status := strings.TrimSpace(q.Get("warranty_status"))
	if status == "" {
		status = "all"
	}
	sourceType := strings.TrimSpace(q.Get("source_type"))
	if sourceType == "" {
		sourceType = "all"
	}
	itemType := strings.TrimSpace(q.Get("item_type"))
	if itemType == "" {
		itemType = "all"
	}

	expiring := parsePositiveInt(q.Get("expiring_in_days"), 30)
	if expiring < 1 {
		expiring = 1
	}
	if expiring > 365 {
		expiring = 365
	}

	perPage := parsePositiveInt(q.Get("per_page"), 15)
	if perPage > 100 {
		perPage = 100
	}

	return partSaleWarrantiesFilters{
		Search:         strings.TrimSpace(q.Get("search")),
		WarrantyStatus: status,
		SourceType:     sourceType,
		ItemType:       itemType,
		CustomerID:     parseFilterID(q.Get("customer_id")),
		VehicleID:      parseFilterID(q.Get("vehicle_id")),
		MechanicID:     parseFilterID(q.Get("mechanic_id")),
		DateFrom:       strings.TrimSpace(q.Get("date_from")),
		DateTo:         strings.TrimSpace(q.Get("date_to")),
		ExpiringInDays: expiring,
		Page:           parsePositiveInt(q.Get("page"), 1),
		PerPage:        perPage,
	}
}

func queryPartSaleWarrantiesPage(db *sql.DB, r *http.Request, f partSaleWarrantiesFilters) (response, response, error) {
	whereClause, args := buildPartSaleWarrantiesWhereClause(f)

	countQuery := `SELECT COUNT(*) FROM warranty_registrations wr ` + whereClause
	var total int64
	if err := db.QueryRow(countQuery, args...).Scan(&total); err != nil {
		return nil, nil, err
	}

	lastPage := 1
	if total > 0 {
		lastPage = int(math.Ceil(float64(total) / float64(f.PerPage)))
	}
	currentPage := f.Page
	if currentPage < 1 {
		currentPage = 1
	}
	if currentPage > lastPage {
		currentPage = lastPage
	}

	dataQuery := `
		SELECT wr.id, wr.source_type, wr.source_id, wr.source_detail_id,
		       COALESCE(wr.warranty_period_days, 0),
		       DATE_FORMAT(wr.warranty_start_date, '%Y-%m-%d') AS warranty_start_date,
		       DATE_FORMAT(wr.warranty_end_date, '%Y-%m-%d') AS warranty_end_date,
		       DATE_FORMAT(wr.claimed_at, '%Y-%m-%d %H:%i:%s') AS claimed_at,
		       wr.claim_notes,
		       wr.warrantable_type,
		       JSON_UNQUOTE(JSON_EXTRACT(wr.metadata, '$.item_name')) AS item_name,
		       JSON_UNQUOTE(JSON_EXTRACT(wr.metadata, '$.part_name')) AS part_name,
		       JSON_UNQUOTE(JSON_EXTRACT(wr.metadata, '$.part_number')) AS part_number,
		       c.name AS customer_name,
		       v.plate_number, v.brand, v.model,
		       ps.sale_number,
		       DATE_FORMAT(ps.sale_date, '%Y-%m-%d') AS sale_date,
		       so.order_number,
		       DATE_FORMAT(so.created_at, '%Y-%m-%d') AS order_date,
		       m.name AS mechanic_name
		FROM warranty_registrations wr
		LEFT JOIN customers c ON c.id = wr.customer_id
		LEFT JOIN vehicles v ON v.id = wr.vehicle_id
		LEFT JOIN part_sales ps ON wr.source_type = 'App\\Models\\PartSale' AND ps.id = wr.source_id
		LEFT JOIN service_orders so ON wr.source_type = 'App\\Models\\ServiceOrder' AND so.id = wr.source_id
		LEFT JOIN mechanics m ON m.id = so.mechanic_id
	` + whereClause + `
		ORDER BY CASE WHEN wr.claimed_at IS NULL THEN 0 ELSE 1 END ASC, wr.warranty_end_date ASC
		LIMIT ? OFFSET ?
	`

	queryArgs := append([]any{}, args...)
	queryArgs = append(queryArgs, f.PerPage, (currentPage-1)*f.PerPage)
	rows, err := db.Query(dataQuery, queryArgs...)
	if err != nil {
		return nil, nil, err
	}
	defer rows.Close()

	items := make([]response, 0)
	for rows.Next() {
		var id int64
		var sourceType sql.NullString
		var sourceID sql.NullInt64
		var sourceDetailID sql.NullInt64
		var warrantyPeriodDays sql.NullInt64
		var warrantyStartDate sql.NullString
		var warrantyEndDate sql.NullString
		var claimedAt sql.NullString
		var claimNotes sql.NullString
		var warrantableType sql.NullString
		var itemName sql.NullString
		var partName sql.NullString
		var partNumber sql.NullString
		var customerName sql.NullString
		var plateNumber sql.NullString
		var vehicleBrand sql.NullString
		var vehicleModel sql.NullString
		var saleNumber sql.NullString
		var saleDate sql.NullString
		var orderNumber sql.NullString
		var orderDate sql.NullString
		var mechanicName sql.NullString

		if err := rows.Scan(
			&id, &sourceType, &sourceID, &sourceDetailID,
			&warrantyPeriodDays,
			&warrantyStartDate, &warrantyEndDate, &claimedAt,
			&claimNotes,
			&warrantableType,
			&itemName, &partName, &partNumber,
			&customerName,
			&plateNumber, &vehicleBrand, &vehicleModel,
			&saleNumber, &saleDate,
			&orderNumber, &orderDate,
			&mechanicName,
		); err != nil {
			return nil, nil, err
		}

		sourceTypeValue := nullStringValue(sourceType)
		referenceNumber := "-"
		sourceDate := ""
		sourceLabel := "Service Order"
		if sourceTypeValue == "App\\Models\\PartSale" {
			referenceNumber = fallbackString(saleNumber, "-")
			sourceDate = nullStringValue(saleDate)
			sourceLabel = "Part Sale"
		} else {
			referenceNumber = fallbackString(orderNumber, "-")
			sourceDate = nullStringValue(orderDate)
		}

		vehicleLabel := "-"
		if strings.TrimSpace(nullStringValue(plateNumber)) != "" || strings.TrimSpace(nullStringValue(vehicleBrand)) != "" || strings.TrimSpace(nullStringValue(vehicleModel)) != "" {
			vehicleLabel = strings.TrimSpace(strings.TrimSpace(nullStringValue(plateNumber)) + " " + strings.TrimSpace(nullStringValue(vehicleBrand)) + " " + strings.TrimSpace(nullStringValue(vehicleModel)))
		}

		itemNameValue := strings.TrimSpace(nullStringValue(itemName))
		if itemNameValue == "" {
			itemNameValue = strings.TrimSpace(nullStringValue(partName))
		}
		if itemNameValue == "" {
			itemNameValue = "-"
		}

		resolvedStatus := resolveWarrantyStatusText(claimedAt, warrantyEndDate, f.ExpiringInDays)
		itemType := "part"
		if nullStringValue(warrantableType) == "App\\Models\\Service" {
			itemType = "service"
		}

		item := response{
			"id":                   id,
			"source_type":          sourceTypeValue,
			"source_id":            int64OrZero(sourceID),
			"source_detail_id":     int64OrZero(sourceDetailID),
			"reference_number":     referenceNumber,
			"source_date":          emptyToNil(sourceDate),
			"source_label":         sourceLabel,
			"customer_name":        fallbackString(customerName, "-"),
			"vehicle_label":        vehicleLabel,
			"mechanic_name":        fallbackString(mechanicName, "-"),
			"item_name":            itemNameValue,
			"item_number":          fallbackString(partNumber, "-"),
			"item_type":            itemType,
			"warranty_period_days": int64OrZero(warrantyPeriodDays),
			"warranty_start_date":  stringOrNil(warrantyStartDate),
			"warranty_end_date":    stringOrNil(warrantyEndDate),
			"claimed_at":           stringOrNil(claimedAt),
			"claim_notes":          stringOrNil(claimNotes),
			"resolved_status":      resolvedStatus,
		}
		items = append(items, item)
	}
	if err := rows.Err(); err != nil {
		return nil, nil, err
	}

	summary := response{}
	for _, status := range []string{"all", "active", "expiring", "expired", "claimed"} {
		sq, sargs := buildPartSaleWarrantiesSummaryWhereClause(f, status)
		var c int64
		if err := db.QueryRow(`SELECT COUNT(*) FROM warranty_registrations wr `+sq, sargs...).Scan(&c); err != nil {
			return nil, nil, err
		}
		summary[status] = c
	}

	from, to := paginationBounds(total, currentPage, f.PerPage)
	pagination := response{
		"current_page": currentPage,
		"data":         items,
		"from":         from,
		"last_page":    lastPage,
		"links":        buildReportIndexLinks("/part-sales/warranties", r.URL.Query(), currentPage, lastPage),
		"per_page":     f.PerPage,
		"to":           to,
		"total":        total,
	}

	return pagination, summary, nil
}

func buildPartSaleWarrantiesWhereClause(f partSaleWarrantiesFilters) (string, []any) {
	clauses := []string{"wr.warranty_period_days > 0"}
	args := make([]any, 0)

	if f.SourceType == "part_sale" {
		clauses = append(clauses, "wr.source_type = 'App\\Models\\PartSale'")
	} else if f.SourceType == "service_order" {
		clauses = append(clauses, "wr.source_type = 'App\\Models\\ServiceOrder'")
	}

	if f.ItemType == "part" {
		clauses = append(clauses, "wr.warrantable_type = 'App\\Models\\Part'")
	} else if f.ItemType == "service" {
		clauses = append(clauses, "wr.warrantable_type = 'App\\Models\\Service'")
	}

	if f.CustomerID != nil {
		clauses = append(clauses, "wr.customer_id = ?")
		args = append(args, *f.CustomerID)
	}
	if f.VehicleID != nil {
		clauses = append(clauses, "wr.vehicle_id = ?")
		args = append(args, *f.VehicleID)
	}
	if f.MechanicID != nil {
		clauses = append(clauses, "wr.source_type = 'App\\Models\\ServiceOrder' AND EXISTS (SELECT 1 FROM service_orders so2 WHERE so2.id = wr.source_id AND so2.mechanic_id = ?)")
		args = append(args, *f.MechanicID)
	}
	if f.DateFrom != "" {
		clauses = append(clauses, "DATE(wr.warranty_start_date) >= ?")
		args = append(args, f.DateFrom)
	}
	if f.DateTo != "" {
		clauses = append(clauses, "DATE(wr.warranty_start_date) <= ?")
		args = append(args, f.DateTo)
	}

	if f.Search != "" {
		search := "%" + f.Search + "%"
		clauses = append(clauses, `(COALESCE(JSON_UNQUOTE(JSON_EXTRACT(wr.metadata, '$.item_name')), '') LIKE ? OR COALESCE(JSON_UNQUOTE(JSON_EXTRACT(wr.metadata, '$.part_name')), '') LIKE ? OR COALESCE(JSON_UNQUOTE(JSON_EXTRACT(wr.metadata, '$.part_number')), '') LIKE ? OR COALESCE(JSON_UNQUOTE(JSON_EXTRACT(wr.metadata, '$.part_sale_number')), '') LIKE ? OR COALESCE(JSON_UNQUOTE(JSON_EXTRACT(wr.metadata, '$.service_order_number')), '') LIKE ? OR EXISTS (SELECT 1 FROM customers c2 WHERE c2.id = wr.customer_id AND c2.name LIKE ?))`)
		args = append(args, search, search, search, search, search, search)
	}

	statusClause, statusArgs := buildWarrantyStatusClause(f.WarrantyStatus, f.ExpiringInDays)
	if statusClause != "" {
		clauses = append(clauses, statusClause)
		args = append(args, statusArgs...)
	}

	return " WHERE " + strings.Join(clauses, " AND "), args
}

func buildPartSaleWarrantiesSummaryWhereClause(f partSaleWarrantiesFilters, status string) (string, []any) {
	forSummary := f
	forSummary.WarrantyStatus = status
	return buildPartSaleWarrantiesWhereClause(forSummary)
}

func buildWarrantyStatusClause(status string, expiringInDays int) (string, []any) {
	today := time.Now().Format("2006-01-02")
	expiringDate := time.Now().AddDate(0, 0, expiringInDays).Format("2006-01-02")

	switch status {
	case "active":
		return "wr.claimed_at IS NULL AND DATE(wr.warranty_end_date) >= ?", []any{today}
	case "expiring":
		return "wr.claimed_at IS NULL AND DATE(wr.warranty_end_date) BETWEEN ? AND ?", []any{today, expiringDate}
	case "expired":
		return "wr.claimed_at IS NULL AND DATE(wr.warranty_end_date) < ?", []any{today}
	case "claimed":
		return "wr.claimed_at IS NOT NULL", nil
	default:
		return "", nil
	}
}

func resolveWarrantyStatusText(claimedAt sql.NullString, warrantyEndDate sql.NullString, expiringInDays int) string {
	if strings.TrimSpace(nullStringValue(claimedAt)) != "" {
		return "Sudah Diklaim"
	}

	if strings.TrimSpace(nullStringValue(warrantyEndDate)) == "" {
		return "Expired"
	}

	endDate, err := time.Parse("2006-01-02", nullStringValue(warrantyEndDate))
	if err != nil {
		return "Expired"
	}
	today := time.Now()
	today = time.Date(today.Year(), today.Month(), today.Day(), 0, 0, 0, 0, today.Location())
	endDate = time.Date(endDate.Year(), endDate.Month(), endDate.Day(), 0, 0, 0, 0, endDate.Location())

	if endDate.Before(today) {
		return "Expired"
	}

	threshold := today.AddDate(0, 0, expiringInDays)
	if !endDate.After(threshold) {
		return "Akan Expired"
	}

	return "Aktif"
}

func queryPartSaleWarrantiesCustomers(db *sql.DB) ([]response, error) {
	rows, err := db.Query(`SELECT id, name FROM customers ORDER BY name ASC`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	items := make([]response, 0)
	for rows.Next() {
		var id sql.NullInt64
		var name sql.NullString
		if err := rows.Scan(&id, &name); err != nil {
			return nil, err
		}
		items = append(items, response{"id": int64OrZero(id), "name": nullString(name)})
	}
	return items, rows.Err()
}

func queryPartSaleWarrantiesVehicles(db *sql.DB) ([]response, error) {
	rows, err := db.Query(`SELECT id, plate_number, brand, model FROM vehicles ORDER BY plate_number ASC`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	items := make([]response, 0)
	for rows.Next() {
		var id sql.NullInt64
		var plate sql.NullString
		var brand sql.NullString
		var model sql.NullString
		if err := rows.Scan(&id, &plate, &brand, &model); err != nil {
			return nil, err
		}
		items = append(items, response{"id": int64OrZero(id), "plate_number": nullString(plate), "brand": nullString(brand), "model": nullString(model)})
	}
	return items, rows.Err()
}

func queryPartSaleWarrantiesMechanics(db *sql.DB) ([]response, error) {
	rows, err := db.Query(`SELECT id, name FROM mechanics ORDER BY name ASC`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	items := make([]response, 0)
	for rows.Next() {
		var id sql.NullInt64
		var name sql.NullString
		if err := rows.Scan(&id, &name); err != nil {
			return nil, err
		}
		items = append(items, response{"id": int64OrZero(id), "name": nullString(name)})
	}
	return items, rows.Err()
}

func parseFilterID(raw string) *int64 {
	value := strings.TrimSpace(raw)
	if value == "" {
		return nil
	}
	parsed, err := strconv.ParseInt(value, 10, 64)
	if err != nil || parsed <= 0 {
		return nil
	}
	return &parsed
}

func nullableFilterID(v *int64) any {
	if v == nil || *v <= 0 {
		return ""
	}
	return *v
}

func emptyToNil(v string) any {
	if strings.TrimSpace(v) == "" {
		return ""
	}
	return strings.TrimSpace(v)
}

func fallbackString(v sql.NullString, fallback string) string {
	if v.Valid && strings.TrimSpace(v.String) != "" {
		return v.String
	}
	return fallback
}
