package httpserver

import (
	"database/sql"
	"net/http"
	"strings"
)

func partsInventoryReportHandler(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if db == nil {
			writeJSON(w, http.StatusServiceUnavailable, response{"message": "database is not configured"})
			return
		}

		status := strings.TrimSpace(r.URL.Query().Get("status"))
		if status == "" {
			status = "all"
		}

		parts, err := queryPartsInventoryRows(db, status)
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, response{"message": "failed to read parts inventory"})
			return
		}

		summary := response{
			"total_parts":       int64(len(parts)),
			"total_stock_value": int64(0),
			"low_stock_items":   int64(0),
		}

		for _, item := range parts {
			summary["total_stock_value"] = summary["total_stock_value"].(int64) + toInt64(item["stock_value"])
			if item["status"] == "low" {
				summary["low_stock_items"] = summary["low_stock_items"].(int64) + 1
			}
		}

		writeJSON(w, http.StatusOK, response{
			"parts": parts,
			"filters": response{
				"status": status,
			},
			"summary": summary,
		})
	}
}

func queryPartsInventoryRows(db *sql.DB, statusFilter string) ([]response, error) {
	q := `
		SELECT p.id,
		       p.name,
		       pc.name AS category_name,
		       COALESCE(p.stock, 0) AS stock,
		       COALESCE(p.reorder_level, 10) AS reorder_level,
		       COALESCE(p.sell_price, 0) AS sell_price
		FROM parts p
		LEFT JOIN part_categories pc ON pc.id = p.part_category_id
		WHERE p.deleted_at IS NULL
		ORDER BY p.name ASC
	`

	rows, err := db.Query(q)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	items := make([]response, 0)
	for rows.Next() {
		var id sql.NullInt64
		var name sql.NullString
		var categoryName sql.NullString
		var stock sql.NullInt64
		var reorderLevel sql.NullInt64
		var sellPrice sql.NullInt64

		if err := rows.Scan(&id, &name, &categoryName, &stock, &reorderLevel, &sellPrice); err != nil {
			return nil, err
		}

		stockValue := int64OrZero(stock) * int64OrZero(sellPrice)
		status := "good"
		if int64OrZero(stock) <= int64OrZero(reorderLevel) {
			status = "low"
		}

		if statusFilter == "low" && status != "low" {
			continue
		}

		items = append(items, response{
			"id":            int64OrZero(id),
			"name":          overallNullStringValue(name),
			"category":      overallNullStringValue(categoryName),
			"stock":         int64OrZero(stock),
			"reorder_level": int64OrZero(reorderLevel),
			"price":         int64OrZero(sellPrice),
			"stock_value":   stockValue,
			"status":        status,
		})
	}

	return items, rows.Err()
}
