package httpserver

import (
	"database/sql"
	"math"
	"net/http"
	"net/url"
	"strconv"
	"strings"
)

type partPurchaseIndexParams struct {
	Q          string
	SupplierID string
	Status     string
	DateFrom   string
	DateTo     string
	Page       int
	PerPage    int
}

func partPurchaseIndexHandler(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if db == nil {
			writeJSON(w, http.StatusServiceUnavailable, response{"message": "database is not configured"})
			return
		}

		params := partPurchaseIndexParams{
			Q:          strings.TrimSpace(r.URL.Query().Get("q")),
			SupplierID: strings.TrimSpace(r.URL.Query().Get("supplier_id")),
			Status:     strings.TrimSpace(r.URL.Query().Get("status")),
			DateFrom:   strings.TrimSpace(r.URL.Query().Get("date_from")),
			DateTo:     strings.TrimSpace(r.URL.Query().Get("date_to")),
			Page:       parsePositiveInt(r.URL.Query().Get("page"), 1),
			PerPage:    15,
		}

		purchases, err := partPurchaseIndexQueryPurchases(db, r.URL.Query(), params)
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, response{"message": "failed to read part purchases"})
			return
		}

		suppliers, err := partPurchaseIndexQuerySuppliers(db)
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, response{"message": "failed to read suppliers"})
			return
		}

		writeJSON(w, http.StatusOK, response{
			"purchases": purchases,
			"suppliers": suppliers,
			"filters": response{
				"q":           emptyStringToNil(params.Q),
				"supplier_id": emptyStringToNil(params.SupplierID),
				"status":      emptyStringToNil(params.Status),
				"date_from":   emptyStringToNil(params.DateFrom),
				"date_to":     emptyStringToNil(params.DateTo),
			},
		})
	}
}

func partPurchaseIndexQueryPurchases(db *sql.DB, query url.Values, params partPurchaseIndexParams) (response, error) {
	whereClause, args := partPurchaseIndexBuildWhere(params)

	countQuery := `
		SELECT COUNT(*)
		FROM part_purchases pp
		LEFT JOIN suppliers s ON s.id = pp.supplier_id
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
		SELECT
			pp.id, pp.purchase_number, pp.supplier_id, pp.purchase_date,
			pp.expected_delivery_date, pp.actual_delivery_date,
			pp.status, pp.total_amount, pp.notes,
			s.id, s.name
		FROM part_purchases pp
		LEFT JOIN suppliers s ON s.id = pp.supplier_id
	` + whereClause + `
		ORDER BY pp.purchase_date DESC, pp.created_at DESC
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
	purchaseIDs := make([]int64, 0)
	indexByPurchaseID := map[int64]int{}

	for rows.Next() {
		var id int64
		var purchaseNumber sql.NullString
		var supplierID sql.NullInt64
		var purchaseDate sql.NullTime
		var expectedDeliveryDate sql.NullTime
		var actualDeliveryDate sql.NullTime
		var status sql.NullString
		var totalAmount sql.NullInt64
		var notes sql.NullString
		var supplierRefID sql.NullInt64
		var supplierName sql.NullString

		if err := rows.Scan(
			&id,
			&purchaseNumber,
			&supplierID,
			&purchaseDate,
			&expectedDeliveryDate,
			&actualDeliveryDate,
			&status,
			&totalAmount,
			&notes,
			&supplierRefID,
			&supplierName,
		); err != nil {
			return nil, err
		}

		item := response{
			"id":                     id,
			"purchase_number":        nullString(purchaseNumber),
			"supplier_id":            nullInt(supplierID),
			"purchase_date":          nullDate(purchaseDate),
			"expected_delivery_date": nullDate(expectedDeliveryDate),
			"actual_delivery_date":   nullDate(actualDeliveryDate),
			"status":                 nullString(status),
			"total_amount":           int64OrZero(totalAmount),
			"notes":                  nullString(notes),
			"supplier":               nil,
			"details":                []response{},
		}

		if supplierRefID.Valid {
			item["supplier"] = response{
				"id":   supplierRefID.Int64,
				"name": nullString(supplierName),
			}
		}

		indexByPurchaseID[id] = len(items)
		purchaseIDs = append(purchaseIDs, id)
		items = append(items, item)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}

	if len(purchaseIDs) > 0 {
		if err := partPurchaseIndexAttachDetails(db, items, indexByPurchaseID, purchaseIDs); err != nil {
			return nil, err
		}
	}

	from, to := paginationBounds(total, currentPage, params.PerPage)

	return response{
		"current_page": currentPage,
		"data":         items,
		"from":         from,
		"last_page":    lastPage,
		"links":        partPurchaseIndexBuildLinks("/part-purchases", query, currentPage, lastPage),
		"per_page":     params.PerPage,
		"to":           to,
		"total":        total,
	}, nil
}

func partPurchaseIndexAttachDetails(db *sql.DB, items []response, indexByPurchaseID map[int64]int, purchaseIDs []int64) error {
	placeholders := make([]string, 0, len(purchaseIDs))
	args := make([]any, 0, len(purchaseIDs))
	for _, purchaseID := range purchaseIDs {
		placeholders = append(placeholders, "?")
		args = append(args, purchaseID)
	}

	query := `
		SELECT id, part_purchase_id, part_id, quantity, unit_price, subtotal,
		       discount_type, discount_value
		FROM part_purchase_details
		WHERE part_purchase_id IN (` + strings.Join(placeholders, ",") + `)
		ORDER BY id ASC
	`

	rows, err := db.Query(query, args...)
	if err != nil {
		return err
	}
	defer rows.Close()

	for rows.Next() {
		var id int64
		var purchaseID int64
		var partID sql.NullInt64
		var quantity sql.NullInt64
		var unitPrice sql.NullInt64
		var subtotal sql.NullInt64
		var discountType sql.NullString
		var discountValue sql.NullFloat64

		if err := rows.Scan(&id, &purchaseID, &partID, &quantity, &unitPrice, &subtotal, &discountType, &discountValue); err != nil {
			return err
		}

		idx, ok := indexByPurchaseID[purchaseID]
		if !ok {
			continue
		}

		detail := response{
			"id":             id,
			"part_id":        nullInt(partID),
			"quantity":       int64OrZero(quantity),
			"unit_price":     int64OrZero(unitPrice),
			"subtotal":       int64OrZero(subtotal),
			"discount_type":  nullString(discountType),
			"discount_value": partPurchaseFloat64OrZero(discountValue),
		}

		currentDetails := items[idx]["details"].([]response)
		items[idx]["details"] = append(currentDetails, detail)
	}

	return rows.Err()
}

func partPurchaseIndexBuildWhere(params partPurchaseIndexParams) (string, []any) {
	clauses := make([]string, 0)
	args := make([]any, 0)

	if params.SupplierID != "" {
		clauses = append(clauses, "pp.supplier_id = ?")
		args = append(args, params.SupplierID)
	}
	if params.Status != "" {
		clauses = append(clauses, "pp.status = ?")
		args = append(args, params.Status)
	}
	if params.DateFrom != "" {
		clauses = append(clauses, "DATE(pp.purchase_date) >= ?")
		args = append(args, params.DateFrom)
	}
	if params.DateTo != "" {
		clauses = append(clauses, "DATE(pp.purchase_date) <= ?")
		args = append(args, params.DateTo)
	}
	if params.Q != "" {
		like := "%" + params.Q + "%"
		clauses = append(clauses, "(pp.purchase_number LIKE ? OR COALESCE(pp.notes, '') LIKE ? OR COALESCE(s.name, '') LIKE ?)")
		args = append(args, like, like, like)
	}

	if len(clauses) == 0 {
		return "", args
	}

	return " WHERE " + strings.Join(clauses, " AND "), args
}

func partPurchaseIndexBuildLinks(basePath string, query url.Values, currentPage, lastPage int) []response {
	buildURL := func(page int) any {
		if page < 1 || page > lastPage {
			return nil
		}

		q := url.Values{}
		for key, values := range query {
			for _, value := range values {
				q.Add(key, value)
			}
		}
		q.Set("page", strconv.Itoa(page))
		return basePath + "?" + q.Encode()
	}

	links := make([]response, 0, lastPage+2)
	links = append(links, response{
		"url":    buildURL(currentPage - 1),
		"label":  "&laquo; Previous",
		"active": false,
	})

	for page := 1; page <= lastPage; page++ {
		links = append(links, response{
			"url":    buildURL(page),
			"label":  strconv.Itoa(page),
			"active": page == currentPage,
		})
	}

	links = append(links, response{
		"url":    buildURL(currentPage + 1),
		"label":  "Next &raquo;",
		"active": false,
	})

	return links
}

func partPurchaseIndexQuerySuppliers(db *sql.DB) ([]response, error) {
	rows, err := db.Query(`SELECT id, name FROM suppliers ORDER BY name ASC`)
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

func nullDate(value sql.NullTime) any {
	if !value.Valid {
		return nil
	}
	return value.Time.Format("2006-01-02")
}

func partPurchaseFloat64OrZero(value sql.NullFloat64) float64 {
	if value.Valid {
		return value.Float64
	}
	return 0
}
