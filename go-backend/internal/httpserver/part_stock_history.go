package httpserver

import (
	"database/sql"
	"encoding/csv"
	"math"
	"net/http"
	"net/url"
	"strings"
)

type partStockHistoryParams struct {
	Q        string
	PartID   string
	Type     string
	DateFrom string
	DateTo   string
	PerPage  int
	Page     int
}

func partStockHistoryIndexHandler(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if db == nil {
			writeJSON(w, http.StatusServiceUnavailable, response{"message": "database is not configured"})
			return
		}

		params := parsePartStockHistoryParams(r)
		movements, err := queryPartStockHistoryPage(db, r.URL.Query(), params)
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, response{"message": "failed to read stock movements"})
			return
		}

		parts, err := queryPartStockHistoryParts(db)
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, response{"message": "failed to read parts"})
			return
		}

		types, err := queryPartStockHistoryTypes(db)
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, response{"message": "failed to read movement types"})
			return
		}

		writeJSON(w, http.StatusOK, response{
			"movements": movements,
			"parts":     parts,
			"types":     types,
			"filters": response{
				"q":         emptyStringToNil(params.Q),
				"part_id":   emptyStringToNil(params.PartID),
				"type":      emptyStringToNil(params.Type),
				"date_from": emptyStringToNil(params.DateFrom),
				"date_to":   emptyStringToNil(params.DateTo),
			},
		})
	}
}

func partStockHistoryExportHandler(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if db == nil {
			writeJSON(w, http.StatusServiceUnavailable, response{"message": "database is not configured"})
			return
		}

		params := parsePartStockHistoryParams(r)
		rows, err := queryPartStockHistoryExportRows(db, params)
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, response{"message": "failed to export stock movements"})
			return
		}

		w.Header().Set("Content-Type", "text/csv")
		w.Header().Set("Content-Disposition", "attachment; filename=part-stock-history-export.csv")
		w.WriteHeader(http.StatusOK)

		writer := csv.NewWriter(w)
		_ = writer.Write([]string{"Date", "Part", "Type", "Qty", "Before Stock", "After Stock", "Reference", "Supplier", "User", "Notes"})
		for _, item := range rows {
			_ = writer.Write([]string{
				item.createdAt,
				item.partName,
				item.movementType,
				item.qty,
				item.beforeStock,
				item.afterStock,
				item.reference,
				item.supplierName,
				item.userName,
				item.notes,
			})
		}
		writer.Flush()
	}
}

func parsePartStockHistoryParams(r *http.Request) partStockHistoryParams {
	q := r.URL.Query()
	return partStockHistoryParams{
		Q:        strings.TrimSpace(q.Get("q")),
		PartID:   strings.TrimSpace(q.Get("part_id")),
		Type:     strings.TrimSpace(q.Get("type")),
		DateFrom: strings.TrimSpace(q.Get("date_from")),
		DateTo:   strings.TrimSpace(q.Get("date_to")),
		PerPage:  parsePositiveInt(q.Get("per_page"), 20),
		Page:     parsePositiveInt(q.Get("page"), 1),
	}
}

func queryPartStockHistoryPage(db *sql.DB, query url.Values, params partStockHistoryParams) (response, error) {
	if params.PerPage > 100 {
		params.PerPage = 100
	}

	whereClause, args := buildPartStockHistoryWhereClause(params)
	countQuery := `
		SELECT COUNT(*)
		FROM part_stock_movements psm
		LEFT JOIN parts p ON p.id = psm.part_id
		LEFT JOIN part_purchases pp ON psm.reference_type = 'App\\Models\\PartPurchase' AND psm.reference_id = pp.id
		LEFT JOIN part_sales ps ON psm.reference_type = 'App\\Models\\PartSale' AND psm.reference_id = ps.id
		LEFT JOIN part_sales_orders pso ON psm.reference_type = 'App\\Models\\PartSalesOrder' AND psm.reference_id = pso.id
		LEFT JOIN part_purchase_orders ppo ON psm.reference_type = 'App\\Models\\PartPurchaseOrder' AND psm.reference_id = ppo.id
	` + whereClause

	var total int64
	if err := db.QueryRow(countQuery, args...).Scan(&total); err != nil {
		return nil, err
	}

	lastPage := 1
	if total > 0 {
		lastPage = int(math.Ceil(float64(total) / float64(params.PerPage)))
	}

	currentPage := params.Page
	if currentPage < 1 {
		currentPage = 1
	}
	if currentPage > lastPage {
		currentPage = lastPage
	}

	dataQuery := `
		SELECT psm.id, psm.type, psm.qty, psm.before_stock, psm.after_stock,
		       psm.reference_type, psm.reference_id, psm.notes,
		       DATE_FORMAT(psm.created_at, '%Y-%m-%d %H:%i:%s') AS created_at,
		       p.id, p.name, p.part_number,
		       s.id, s.name,
		       u.id, u.name,
		       pp.purchase_number,
		       COALESCE(ps.sale_number, ps.invoice) AS sale_number,
		       pso.order_number,
		       ppo.po_number
		FROM part_stock_movements psm
		LEFT JOIN parts p ON p.id = psm.part_id
		LEFT JOIN suppliers s ON s.id = psm.supplier_id
		LEFT JOIN users u ON u.id = psm.created_by
		LEFT JOIN part_purchases pp ON psm.reference_type = 'App\\Models\\PartPurchase' AND psm.reference_id = pp.id
		LEFT JOIN part_sales ps ON psm.reference_type = 'App\\Models\\PartSale' AND psm.reference_id = ps.id
		LEFT JOIN part_sales_orders pso ON psm.reference_type = 'App\\Models\\PartSalesOrder' AND psm.reference_id = pso.id
		LEFT JOIN part_purchase_orders ppo ON psm.reference_type = 'App\\Models\\PartPurchaseOrder' AND psm.reference_id = ppo.id
	` + whereClause + `
		ORDER BY psm.created_at DESC, psm.id DESC
		LIMIT ? OFFSET ?
	`

	queryArgs := append([]any{}, args...)
	queryArgs = append(queryArgs, params.PerPage, (currentPage-1)*params.PerPage)

	rows, err := db.Query(dataQuery, queryArgs...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	items := make([]response, 0)
	for rows.Next() {
		var id int64
		var movementType sql.NullString
		var qty sql.NullInt64
		var beforeStock sql.NullInt64
		var afterStock sql.NullInt64
		var referenceType sql.NullString
		var referenceID sql.NullInt64
		var notes sql.NullString
		var createdAt sql.NullString

		var partID sql.NullInt64
		var partName sql.NullString
		var partNumber sql.NullString

		var supplierID sql.NullInt64
		var supplierName sql.NullString

		var userID sql.NullInt64
		var userName sql.NullString

		var purchaseNumber sql.NullString
		var saleNumber sql.NullString
		var orderNumber sql.NullString
		var poNumber sql.NullString

		if err := rows.Scan(
			&id, &movementType, &qty, &beforeStock, &afterStock,
			&referenceType, &referenceID, &notes, &createdAt,
			&partID, &partName, &partNumber,
			&supplierID, &supplierName,
			&userID, &userName,
			&purchaseNumber, &saleNumber, &orderNumber, &poNumber,
		); err != nil {
			return nil, err
		}

		item := response{
			"id":             id,
			"type":           nullString(movementType),
			"qty":            intOrDefault(qty, 0),
			"before_stock":   intOrDefault(beforeStock, 0),
			"after_stock":    intOrDefault(afterStock, 0),
			"reference_type": stringOrNil(referenceType),
			"reference_id":   nullInt(referenceID),
			"notes":          stringOrNil(notes),
			"created_at":     stringOrNil(createdAt),
			"part":           nil,
			"supplier":       nil,
			"user":           nil,
			"reference":      nil,
		}

		if partID.Valid {
			item["part"] = response{
				"id":          partID.Int64,
				"name":        nullString(partName),
				"part_number": nullString(partNumber),
			}
		}
		if supplierID.Valid {
			item["supplier"] = response{
				"id":   supplierID.Int64,
				"name": nullString(supplierName),
			}
		}
		if userID.Valid {
			item["user"] = response{
				"id":   userID.Int64,
				"name": nullString(userName),
			}
		}

		reference := response{}
		hasReference := false
		if purchaseNumber.Valid && strings.TrimSpace(purchaseNumber.String) != "" {
			reference["purchase_number"] = purchaseNumber.String
			hasReference = true
		}
		if saleNumber.Valid && strings.TrimSpace(saleNumber.String) != "" {
			reference["invoice"] = saleNumber.String
			hasReference = true
		}
		if orderNumber.Valid && strings.TrimSpace(orderNumber.String) != "" {
			reference["order_number"] = orderNumber.String
			hasReference = true
		}
		if poNumber.Valid && strings.TrimSpace(poNumber.String) != "" {
			reference["po_number"] = poNumber.String
			hasReference = true
		}
		if hasReference {
			item["reference"] = reference
		}

		items = append(items, item)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}

	from, to := paginationBounds(total, currentPage, params.PerPage)

	return response{
		"current_page": currentPage,
		"data":         items,
		"from":         from,
		"last_page":    lastPage,
		"links":        buildReportIndexLinks("/part-stock-history", query, currentPage, lastPage),
		"per_page":     params.PerPage,
		"to":           to,
		"total":        total,
	}, nil
}

func buildPartStockHistoryWhereClause(params partStockHistoryParams) (string, []any) {
	clauses := []string{"(psm.reference_type IN ('App\\Models\\PartPurchase','App\\Models\\PartSale','App\\Models\\PartSalesOrder','App\\Models\\PartPurchaseOrder') OR psm.reference_type IS NULL)"}
	args := make([]any, 0)

	if params.PartID != "" {
		clauses = append(clauses, "psm.part_id = ?")
		args = append(args, params.PartID)
	}
	if params.Type != "" {
		clauses = append(clauses, "psm.type = ?")
		args = append(args, params.Type)
	}
	if params.DateFrom != "" {
		clauses = append(clauses, "DATE(psm.created_at) >= ?")
		args = append(args, params.DateFrom)
	}
	if params.DateTo != "" {
		clauses = append(clauses, "DATE(psm.created_at) <= ?")
		args = append(args, params.DateTo)
	}
	if params.Q != "" {
		search := "%" + params.Q + "%"
		clauses = append(clauses, `(COALESCE(psm.notes, '') LIKE ? OR COALESCE(p.name, '') LIKE ? OR COALESCE(p.part_number, '') LIKE ? OR COALESCE(pp.purchase_number, '') LIKE ? OR COALESCE(ps.sale_number, ps.invoice, '') LIKE ? OR COALESCE(pso.order_number, '') LIKE ? OR COALESCE(ppo.po_number, '') LIKE ?)`)
		args = append(args, search, search, search, search, search, search, search)
	}

	return " WHERE " + strings.Join(clauses, " AND "), args
}

func queryPartStockHistoryParts(db *sql.DB) ([]response, error) {
	rows, err := db.Query("SELECT id, name FROM parts ORDER BY name ASC")
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	items := make([]response, 0)
	for rows.Next() {
		var id int64
		var name sql.NullString
		if err := rows.Scan(&id, &name); err != nil {
			return nil, err
		}
		items = append(items, response{
			"id":   id,
			"name": nullString(name),
		})
	}
	return items, rows.Err()
}

func queryPartStockHistoryTypes(db *sql.DB) ([]string, error) {
	rows, err := db.Query("SELECT DISTINCT type FROM part_stock_movements ORDER BY type ASC")
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	items := make([]string, 0)
	for rows.Next() {
		var movementType sql.NullString
		if err := rows.Scan(&movementType); err != nil {
			return nil, err
		}
		if movementType.Valid && strings.TrimSpace(movementType.String) != "" {
			items = append(items, movementType.String)
		}
	}
	return items, rows.Err()
}

type partStockHistoryExportRow struct {
	createdAt    string
	partName     string
	movementType string
	qty          string
	beforeStock  string
	afterStock   string
	reference    string
	supplierName string
	userName     string
	notes        string
}

func queryPartStockHistoryExportRows(db *sql.DB, params partStockHistoryParams) ([]partStockHistoryExportRow, error) {
	whereClause, args := buildPartStockHistoryWhereClause(params)
	q := `
		SELECT DATE_FORMAT(psm.created_at, '%Y-%m-%d %H:%i:%s') AS created_at,
		       COALESCE(p.name, '') AS part_name,
		       COALESCE(psm.type, '') AS movement_type,
		       CAST(COALESCE(psm.qty, 0) AS CHAR) AS qty,
		       CAST(COALESCE(psm.before_stock, 0) AS CHAR) AS before_stock,
		       CAST(COALESCE(psm.after_stock, 0) AS CHAR) AS after_stock,
		       COALESCE(pp.purchase_number, pso.order_number, ppo.po_number, ps.sale_number, ps.invoice, '') AS reference_label,
		       COALESCE(s.name, '') AS supplier_name,
		       COALESCE(u.name, '') AS user_name,
		       COALESCE(psm.notes, '') AS notes
		FROM part_stock_movements psm
		LEFT JOIN parts p ON p.id = psm.part_id
		LEFT JOIN suppliers s ON s.id = psm.supplier_id
		LEFT JOIN users u ON u.id = psm.created_by
		LEFT JOIN part_purchases pp ON psm.reference_type = 'App\\Models\\PartPurchase' AND psm.reference_id = pp.id
		LEFT JOIN part_sales ps ON psm.reference_type = 'App\\Models\\PartSale' AND psm.reference_id = ps.id
		LEFT JOIN part_sales_orders pso ON psm.reference_type = 'App\\Models\\PartSalesOrder' AND psm.reference_id = pso.id
		LEFT JOIN part_purchase_orders ppo ON psm.reference_type = 'App\\Models\\PartPurchaseOrder' AND psm.reference_id = ppo.id
	` + whereClause + `
		ORDER BY psm.created_at DESC, psm.id DESC
	`

	rows, err := db.Query(q, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	items := make([]partStockHistoryExportRow, 0)
	for rows.Next() {
		var createdAt sql.NullString
		var partName sql.NullString
		var movementType sql.NullString
		var qty sql.NullString
		var beforeStock sql.NullString
		var afterStock sql.NullString
		var referenceLabel sql.NullString
		var supplierName sql.NullString
		var userName sql.NullString
		var notes sql.NullString

		if err := rows.Scan(
			&createdAt,
			&partName,
			&movementType,
			&qty,
			&beforeStock,
			&afterStock,
			&referenceLabel,
			&supplierName,
			&userName,
			&notes,
		); err != nil {
			return nil, err
		}

		items = append(items, partStockHistoryExportRow{
			createdAt:    nullStringValue(createdAt),
			partName:     nullStringValue(partName),
			movementType: nullStringValue(movementType),
			qty:          nullStringValue(qty),
			beforeStock:  nullStringValue(beforeStock),
			afterStock:   nullStringValue(afterStock),
			reference:    nullStringValue(referenceLabel),
			supplierName: nullStringValue(supplierName),
			userName:     nullStringValue(userName),
			notes:        nullStringValue(notes),
		})
	}

	return items, rows.Err()
}

func nullStringValue(value sql.NullString) string {
	if value.Valid {
		return value.String
	}

	return ""
}
