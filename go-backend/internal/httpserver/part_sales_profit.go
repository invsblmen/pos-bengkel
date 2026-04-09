package httpserver

import (
	"database/sql"
	"fmt"
	"math"
	"net/http"
	"net/url"
	"strings"
	"time"
)

func partSalesProfitHandler(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if db == nil {
			writeJSON(w, http.StatusServiceUnavailable, response{"message": "database is not configured"})
			return
		}

		filters := parsePartSalesProfitFilters(r)
		quantityColumn, err := detectPartSaleQuantityColumn(db)
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, response{"message": "failed to detect quantity column"})
			return
		}

		sales, err := queryPartSalesProfitPage(db, r.URL.Query(), filters, quantityColumn)
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, response{"message": "failed to read sales"})
			return
		}

		summary, err := queryPartSalesProfitSummary(db, filters, quantityColumn)
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, response{"message": "failed to read report summary"})
			return
		}

		topParts, err := queryTopProfitParts(db, filters, quantityColumn)
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, response{"message": "failed to read top parts"})
			return
		}

		writeJSON(w, http.StatusOK, response{
			"sales":    sales,
			"summary":  summary,
			"topParts": topParts,
			"filters": response{
				"start_date": emptyStringToNil(filters.StartDate),
				"end_date":   emptyStringToNil(filters.EndDate),
				"invoice":    emptyStringToNil(filters.Invoice),
			},
		})
	}
}

func partSalesProfitBySupplierHandler(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if db == nil {
			writeJSON(w, http.StatusServiceUnavailable, response{"message": "database is not configured"})
			return
		}

		filters := parsePartSalesProfitFilters(r)
		quantityColumn, err := detectPartSaleQuantityColumn(db)
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, response{"message": "failed to detect quantity column"})
			return
		}

		supplierPerformance, err := queryPartSalesProfitBySupplier(db, filters, quantityColumn)
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, response{"message": "failed to read supplier report"})
			return
		}

		writeJSON(w, http.StatusOK, response{
			"supplier_performance": supplierPerformance,
			"filters": response{
				"start_date": emptyStringToNil(filters.StartDate),
				"end_date":   emptyStringToNil(filters.EndDate),
			},
		})
	}
}

type partSalesProfitFilters struct {
	StartDate string
	EndDate   string
	Invoice   string
	Page      int
	PerPage   int
}

func parsePartSalesProfitFilters(r *http.Request) partSalesProfitFilters {
	q := r.URL.Query()
	return partSalesProfitFilters{
		StartDate: strings.TrimSpace(q.Get("start_date")),
		EndDate:   strings.TrimSpace(q.Get("end_date")),
		Invoice:   strings.TrimSpace(q.Get("invoice")),
		Page:      parsePositiveInt(q.Get("page"), 1),
		PerPage:   parsePositiveInt(q.Get("per_page"), 15),
	}
}

func detectPartSaleQuantityColumn(db *sql.DB) (string, error) {
	const q = `
		SELECT COLUMN_NAME
		FROM information_schema.columns
		WHERE table_schema = DATABASE()
		  AND table_name = 'part_sale_details'
		  AND column_name IN ('quantity', 'qty')
		ORDER BY CASE WHEN column_name = 'quantity' THEN 0 ELSE 1 END
		LIMIT 1
	`

	var column sql.NullString
	if err := db.QueryRow(q).Scan(&column); err != nil {
		return "", err
	}
	if !column.Valid {
		return "", sql.ErrNoRows
	}
	return column.String, nil
}

func queryPartSalesProfitPage(db *sql.DB, query url.Values, filters partSalesProfitFilters, quantityColumn string) (response, error) {
	whereClause, args := buildPartSalesProfitWhereClause(filters)
	countQuery := `SELECT COUNT(*) FROM part_sales ps ` + whereClause

	var total int64
	if err := db.QueryRow(countQuery, args...).Scan(&total); err != nil {
		return nil, err
	}

	lastPage := 1
	if total > 0 {
		lastPage = int(math.Ceil(float64(total) / float64(filters.PerPage)))
	}
	page := filters.Page
	if page < 1 {
		page = 1
	}
	if page > lastPage {
		page = lastPage
	}

	dataQuery := fmt.Sprintf(`
		SELECT ps.id, ps.invoice, DATE_FORMAT(ps.created_at, '%%Y-%%m-%%d %%H:%%i:%%s') AS created_at,
		       u.id, u.name
		FROM part_sales ps
		LEFT JOIN users u ON u.id = ps.user_id
		%s
		ORDER BY ps.created_at DESC, ps.id DESC
		LIMIT ? OFFSET ?
	`, whereClause)

	queryArgs := append([]any{}, args...)
	queryArgs = append(queryArgs, filters.PerPage, (page-1)*filters.PerPage)

	rows, err := db.Query(dataQuery, queryArgs...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	sales := make([]response, 0)
	saleIDs := make([]int64, 0)
	indexByID := map[int64]int{}
	for rows.Next() {
		var id int64
		var invoice sql.NullString
		var createdAt sql.NullString
		var userID sql.NullInt64
		var userName sql.NullString
		if err := rows.Scan(&id, &invoice, &createdAt, &userID, &userName); err != nil {
			return nil, err
		}

		sale := response{
			"id":            id,
			"invoice":       nullString(invoice),
			"created_at":    stringOrNil(createdAt),
			"user":          nil,
			"total_cost":    int64(0),
			"total_revenue": int64(0),
			"total_profit":  int64(0),
			"profit_margin": float64(0),
		}
		if userID.Valid {
			sale["user"] = response{"id": userID.Int64, "name": nullString(userName)}
		}

		indexByID[id] = len(sales)
		saleIDs = append(saleIDs, id)
		sales = append(sales, sale)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}

	if len(saleIDs) > 0 {
		metrics, err := queryPartSalesProfitMetrics(db, saleIDs, quantityColumn)
		if err != nil {
			return nil, err
		}
		for saleID, metric := range metrics {
			idx, ok := indexByID[saleID]
			if !ok {
				continue
			}
			totalCost := metric.totalCost
			totalRevenue := metric.totalRevenue
			totalProfit := totalRevenue - totalCost
			margin := float64(0)
			if totalRevenue > 0 {
				margin = (totalProfit / totalRevenue) * 100
			}

			sales[idx]["total_cost"] = int64(math.Round(totalCost))
			sales[idx]["total_revenue"] = int64(math.Round(totalRevenue))
			sales[idx]["total_profit"] = int64(math.Round(totalProfit))
			sales[idx]["profit_margin"] = roundTwo(margin)
		}
	}

	from, to := paginationBounds(total, page, filters.PerPage)

	return response{
		"current_page": page,
		"data":         sales,
		"from":         from,
		"last_page":    lastPage,
		"links":        buildReportIndexLinks("/reports/part-sales-profit", query, page, lastPage),
		"per_page":     filters.PerPage,
		"to":           to,
		"total":        total,
	}, nil
}

type partSaleMetric struct {
	totalCost    float64
	totalRevenue float64
}

func queryPartSalesProfitMetrics(db *sql.DB, saleIDs []int64, quantityColumn string) (map[int64]partSaleMetric, error) {
	placeholders := make([]string, 0, len(saleIDs))
	args := make([]any, 0, len(saleIDs))
	for _, id := range saleIDs {
		placeholders = append(placeholders, "?")
		args = append(args, id)
	}

	q := fmt.Sprintf(`
		SELECT part_sale_id,
		       SUM(COALESCE(cost_price, 0) * COALESCE(%s, 0)) AS total_cost,
		       SUM(COALESCE(selling_price, 0) * COALESCE(%s, 0)) AS total_revenue
		FROM part_sale_details
		WHERE part_sale_id IN (%s)
		GROUP BY part_sale_id
	`, quantityColumn, quantityColumn, strings.Join(placeholders, ","))

	rows, err := db.Query(q, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	metrics := map[int64]partSaleMetric{}
	for rows.Next() {
		var saleID int64
		var totalCost sql.NullFloat64
		var totalRevenue sql.NullFloat64
		if err := rows.Scan(&saleID, &totalCost, &totalRevenue); err != nil {
			return nil, err
		}
		metrics[saleID] = partSaleMetric{totalCost: float64OrZero(totalCost), totalRevenue: float64OrZero(totalRevenue)}
	}

	return metrics, rows.Err()
}

func queryPartSalesProfitSummary(db *sql.DB, filters partSalesProfitFilters, quantityColumn string) (response, error) {
	whereClause, args := buildPartSalesProfitWhereClause(filters)
	q := fmt.Sprintf(`
		SELECT
			COALESCE(SUM(COALESCE(psd.cost_price, 0) * COALESCE(psd.%s, 0)), 0) AS total_cost,
			COALESCE(SUM(COALESCE(psd.selling_price, 0) * COALESCE(psd.%s, 0)), 0) AS total_revenue,
			COALESCE(SUM(COALESCE(psd.%s, 0)), 0) AS total_quantity,
			COUNT(DISTINCT ps.id) AS orders_count
		FROM part_sales ps
		LEFT JOIN part_sale_details psd ON psd.part_sale_id = ps.id
		%s
	`, quantityColumn, quantityColumn, quantityColumn, whereClause)

	var totalCost sql.NullFloat64
	var totalRevenue sql.NullFloat64
	var totalQuantity sql.NullInt64
	var ordersCount sql.NullInt64
	if err := db.QueryRow(q, args...).Scan(&totalCost, &totalRevenue, &totalQuantity, &ordersCount); err != nil {
		return nil, err
	}

	tCost := float64OrZero(totalCost)
	tRevenue := float64OrZero(totalRevenue)
	tProfit := tRevenue - tCost
	profitMargin := float64(0)
	if tRevenue > 0 {
		profitMargin = (tProfit / tRevenue) * 100
	}
	orders := int64OrZero(ordersCount)

	return response{
		"total_cost":    int64(math.Round(tCost)),
		"total_revenue": int64(math.Round(tRevenue)),
		"total_profit":  int64(math.Round(tProfit)),
		"profit_margin": roundTwo(profitMargin),
		"average_profit_per_order": func() int64 {
			if orders == 0 {
				return 0
			}
			return int64(math.Round(tProfit / float64(orders)))
		}(),
		"orders_count": orders,
		"items_sold":   int64OrZero(totalQuantity),
	}, nil
}

func queryTopProfitParts(db *sql.DB, filters partSalesProfitFilters, quantityColumn string) ([]response, error) {
	whereClause, args := buildPartSalesProfitWhereClause(filters)
	q := fmt.Sprintf(`
		SELECT p.name, p.part_number,
		       SUM(COALESCE(psd.%s, 0)) AS total_quantity,
		       SUM((COALESCE(psd.selling_price, 0) - COALESCE(psd.cost_price, 0)) * COALESCE(psd.%s, 0)) AS total_profit,
		       AVG(CASE WHEN COALESCE(psd.cost_price, 0) > 0 THEN ((COALESCE(psd.selling_price, 0) - COALESCE(psd.cost_price, 0)) / COALESCE(psd.cost_price, 1)) * 100 ELSE 0 END) AS avg_margin
		FROM part_sale_details psd
		JOIN part_sales ps ON ps.id = psd.part_sale_id
		LEFT JOIN parts p ON p.id = psd.part_id
		%s
		GROUP BY p.id, p.name, p.part_number
		ORDER BY total_profit DESC
		LIMIT 10
	`, quantityColumn, quantityColumn, whereClause)

	rows, err := db.Query(q, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	items := make([]response, 0)
	for rows.Next() {
		var name sql.NullString
		var sku sql.NullString
		var totalQuantity sql.NullInt64
		var totalProfit sql.NullFloat64
		var avgMargin sql.NullFloat64
		if err := rows.Scan(&name, &sku, &totalQuantity, &totalProfit, &avgMargin); err != nil {
			return nil, err
		}
		items = append(items, response{
			"part_name":      stringOrDefault(name, "Unknown"),
			"part_sku":       stringOrDefault(sku, "N/A"),
			"total_quantity": int64OrZero(totalQuantity),
			"total_profit":   int64(math.Round(float64OrZero(totalProfit))),
			"avg_margin":     roundTwo(float64OrZero(avgMargin)),
		})
	}

	return items, rows.Err()
}

func queryPartSalesProfitBySupplier(db *sql.DB, filters partSalesProfitFilters, quantityColumn string) ([]response, error) {
	whereClause, args := buildPartSalesProfitWhereClause(filters)
	q := fmt.Sprintf(`
		SELECT suppliers.id, suppliers.name,
		       SUM((COALESCE(psd.selling_price, 0) - COALESCE(psd.cost_price, 0)) * COALESCE(psd.%s, 0)) AS total_profit,
		       SUM(COALESCE(psd.cost_price, 0) * COALESCE(psd.%s, 0)) AS total_cost,
		       SUM(COALESCE(psd.selling_price, 0) * COALESCE(psd.%s, 0)) AS total_revenue,
		       COUNT(DISTINCT ps.id) AS sales_count,
		       SUM(COALESCE(psd.%s, 0)) AS items_sold
		FROM part_sale_details psd
		JOIN part_sales ps ON ps.id = psd.part_sale_id
		JOIN part_purchase_details ppd ON psd.source_purchase_detail_id = ppd.id
		JOIN part_purchases pp ON ppd.part_purchase_id = pp.id
		JOIN suppliers ON pp.supplier_id = suppliers.id
		%s
		GROUP BY suppliers.id, suppliers.name
		ORDER BY total_profit DESC
	`, quantityColumn, quantityColumn, quantityColumn, quantityColumn, whereClause)

	rows, err := db.Query(q, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	items := make([]response, 0)
	for rows.Next() {
		var supplierID int64
		var supplierName sql.NullString
		var totalProfit sql.NullFloat64
		var totalCost sql.NullFloat64
		var totalRevenue sql.NullFloat64
		var salesCount sql.NullInt64
		var itemsSold sql.NullInt64
		if err := rows.Scan(&supplierID, &supplierName, &totalProfit, &totalCost, &totalRevenue, &salesCount, &itemsSold); err != nil {
			return nil, err
		}

		profit := float64OrZero(totalProfit)
		revenue := float64OrZero(totalRevenue)
		margin := float64(0)
		if revenue > 0 {
			margin = (profit / revenue) * 100
		}

		items = append(items, response{
			"supplier_id":   supplierID,
			"supplier_name": stringOrDefault(supplierName, "Unknown"),
			"total_profit":  int64(math.Round(profit)),
			"total_cost":    int64(math.Round(float64OrZero(totalCost))),
			"total_revenue": int64(math.Round(revenue)),
			"sales_count":   int64OrZero(salesCount),
			"items_sold":    int64OrZero(itemsSold),
			"profit_margin": roundTwo(margin),
		})
	}

	return items, rows.Err()
}

func buildPartSalesProfitWhereClause(filters partSalesProfitFilters) (string, []any) {
	clauses := make([]string, 0)
	args := make([]any, 0)

	if filters.Invoice != "" {
		clauses = append(clauses, "ps.invoice LIKE ?")
		args = append(args, "%"+filters.Invoice+"%")
	}
	if filters.StartDate != "" {
		clauses = append(clauses, "ps.created_at >= ?")
		args = append(args, mustParseDateStart(filters.StartDate))
	}
	if filters.EndDate != "" {
		clauses = append(clauses, "ps.created_at <= ?")
		args = append(args, mustParseDateEnd(filters.EndDate))
	}

	if len(clauses) == 0 {
		return "", args
	}

	return " WHERE " + strings.Join(clauses, " AND "), args
}

func mustParseDateStart(raw string) time.Time {
	parsed, err := time.ParseInLocation("2006-01-02", raw, time.Local)
	if err != nil {
		return time.Time{}
	}
	return parsed
}

func mustParseDateEnd(raw string) time.Time {
	parsed, err := time.ParseInLocation("2006-01-02", raw, time.Local)
	if err != nil {
		return time.Time{}
	}
	return parsed.Add(23*time.Hour + 59*time.Minute + 59*time.Second)
}

func buildReportIndexLinks(basePath string, query url.Values, currentPage, lastPage int) []response {
	if currentPage < 1 {
		currentPage = 1
	}
	if lastPage < 1 {
		lastPage = 1
	}

	links := make([]response, 0)
	prev := response{"url": nil, "label": "&laquo; Previous", "active": false}
	if currentPage > 1 {
		prev["url"] = buildReportIndexURL(basePath, query, currentPage-1)
	}
	links = append(links, prev)

	for page := 1; page <= lastPage; page++ {
		links = append(links, response{
			"url":    buildReportIndexURL(basePath, query, page),
			"label":  fmt.Sprintf("%d", page),
			"active": page == currentPage,
		})
	}

	next := response{"url": nil, "label": "Next &raquo;", "active": false}
	if currentPage < lastPage {
		next["url"] = buildReportIndexURL(basePath, query, currentPage+1)
	}
	links = append(links, next)

	return links
}

func buildReportIndexURL(basePath string, query url.Values, page int) string {
	values := url.Values{}
	for key, items := range query {
		if key == "page" {
			continue
		}
		for _, item := range items {
			if strings.TrimSpace(item) != "" {
				values.Add(key, item)
			}
		}
	}
	if page > 1 {
		values.Set("page", fmt.Sprintf("%d", page))
	}
	encoded := values.Encode()
	if encoded == "" {
		return basePath
	}
	return basePath + "?" + encoded
}

func roundTwo(value float64) float64 {
	return math.Round(value*100) / 100
}

func float64OrZero(v sql.NullFloat64) float64 {
	if v.Valid {
		return v.Float64
	}
	return 0
}

func int64OrZero(v sql.NullInt64) int64 {
	if v.Valid {
		return v.Int64
	}
	return 0
}
