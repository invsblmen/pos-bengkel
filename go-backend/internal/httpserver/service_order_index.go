package httpserver

import (
	"database/sql"
	"net/http"
	"strconv"
	"time"
)

func serviceOrderIndexHandler(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if db == nil {
			writeJSON(w, http.StatusServiceUnavailable, response{
				"error": "database not available",
			})
			return
		}

		page := 1
		if p := r.URL.Query().Get("page"); p != "" {
			if parsed, err := strconv.Atoi(p); err == nil && parsed > 0 {
				page = parsed
			}
		}
		perPage := 15
		offset := (page - 1) * perPage

		search := r.URL.Query().Get("search")
		status := r.URL.Query().Get("status")
		dateFrom := r.URL.Query().Get("date_from")
		dateTo := r.URL.Query().Get("date_to")
		mechanicID := r.URL.Query().Get("mechanic_id")

		// Query orders with filters
		orders, total, err := queryServiceOrderIndexOrders(db, search, status, dateFrom, dateTo, mechanicID, offset, perPage)
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, response{"error": "failed to fetch orders"})
			return
		}

		// Query stats
		stats, err := queryServiceOrderIndexStats(db)
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, response{"error": "failed to fetch stats"})
			return
		}

		// Query mechanics
		mechanics, err := queryServiceOrderIndexMechanics(db)
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, response{"error": "failed to fetch mechanics"})
			return
		}

		// Calculate pagination
		totalPages := (total + perPage - 1) / perPage
		if page > totalPages && totalPages > 0 {
			page = totalPages
		}

		writeJSON(w, http.StatusOK, response{
			"orders": map[string]any{
				"data":         orders,
				"current_page": page,
				"per_page":     perPage,
				"total":        total,
				"last_page":    totalPages,
				"from":         offset + 1,
				"to": func() int {
					if offset+perPage > total {
						return total
					}
					return offset + perPage
				}(),
			},
			"stats":     stats,
			"mechanics": mechanics,
			"filters": map[string]any{
				"search":      search,
				"status":      status,
				"date_from":   dateFrom,
				"date_to":     dateTo,
				"mechanic_id": mechanicID,
			},
		})
	}
}

func queryServiceOrderIndexOrders(db *sql.DB, search, status, dateFrom, dateTo, mechanicID string, offset, limit int) ([]map[string]any, int, error) {
	var orders []map[string]any
	var total int

	// Build base query
	baseWhere := "WHERE 1=1 AND so.deleted_at IS NULL"
	whereArgs := []any{}

	// Search filter (order_number, customer name, vehicle plate/brand/model)
	if search != "" {
		search = "%" + search + "%"
		baseWhere += ` AND (so.order_number LIKE ? OR c.name LIKE ? OR v.plate_number LIKE ? OR v.brand LIKE ? OR v.model LIKE ?)`
		whereArgs = append(whereArgs, search, search, search, search, search)
	}

	// Status filter
	if status != "" && status != "all" {
		baseWhere += " AND so.status = ?"
		whereArgs = append(whereArgs, status)
	}

	// Date from filter
	if dateFrom != "" {
		baseWhere += " AND DATE(so.created_at) >= DATE(?)"
		whereArgs = append(whereArgs, dateFrom)
	}

	// Date to filter
	if dateTo != "" {
		baseWhere += " AND DATE(so.created_at) <= DATE(?)"
		whereArgs = append(whereArgs, dateTo)
	}

	// Mechanic filter
	if mechanicID != "" && mechanicID != "all" {
		baseWhere += " AND so.mechanic_id = ?"
		whereArgs = append(whereArgs, mechanicID)
	}

	// Count total
	countQuery := `
		SELECT COUNT(DISTINCT so.id) as total
		FROM service_orders so
		LEFT JOIN customers c ON so.customer_id = c.id
		LEFT JOIN vehicles v ON so.vehicle_id = v.id
		LEFT JOIN mechanics m ON so.mechanic_id = m.id
		` + baseWhere

	if err := db.QueryRow(countQuery, whereArgs...).Scan(&total); err != nil && err != sql.ErrNoRows {
		return nil, 0, err
	}

	// Fetch orders with related data
	query := `
		SELECT DISTINCT
			so.id, so.order_number, so.customer_id, so.vehicle_id, so.mechanic_id,
			so.status, so.total, so.labor_cost, so.material_cost, so.created_at,
			c.id as customer_id, c.name as customer_name,
			v.id as vehicle_id, v.plate_number, v.brand, v.model,
			m.id as mechanic_id, m.name as mechanic_name
		FROM service_orders so
		LEFT JOIN customers c ON so.customer_id = c.id
		LEFT JOIN vehicles v ON so.vehicle_id = v.id
		LEFT JOIN mechanics m ON so.mechanic_id = m.id
		` + baseWhere + `
		ORDER BY so.created_at DESC
		LIMIT ? OFFSET ?
	`
	whereArgs = append(whereArgs, limit, offset)

	rows, err := db.Query(query, whereArgs...)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()

	for rows.Next() {
		var id, customerID, vehicleID, mechanicID sql.NullInt64
		var orderNumber, status, customerName, platNumber, brand, model, mechanicName sql.NullString
		var totalVal, laborCost, materialCost sql.NullInt64
		var createdAt sql.NullTime

		if err := rows.Scan(
			&id, &orderNumber, &customerID, &vehicleID, &mechanicID,
			&status, &totalVal, &laborCost, &materialCost, &createdAt,
			&customerID, &customerName,
			&vehicleID, &platNumber, &brand, &model,
			&mechanicID, &mechanicName,
		); err != nil {
			return nil, 0, err
		}

		// Load details for this order
		details, err := queryServiceOrderIndexDetails(db, id.Int64)
		if err != nil {
			return nil, 0, err
		}

		orders = append(orders, map[string]any{
			"id":            id.Int64,
			"order_number":  orderNumber.String,
			"status":        status.String,
			"total":         totalVal.Int64,
			"labor_cost":    laborCost.Int64,
			"material_cost": materialCost.Int64,
			"created_at": func() string {
				if createdAt.Valid {
					return createdAt.Time.Format(time.RFC3339)
				}
				return ""
			}(),
			"customer": func() map[string]any {
				if customerID.Valid {
					return map[string]any{
						"id":   customerID.Int64,
						"name": customerName.String,
					}
				}
				return nil
			}(),
			"vehicle": func() map[string]any {
				if vehicleID.Valid {
					return map[string]any{
						"id":           vehicleID.Int64,
						"plate_number": platNumber.String,
						"brand":        brand.String,
						"model":        model.String,
					}
				}
				return nil
			}(),
			"mechanic": func() map[string]any {
				if mechanicID.Valid {
					return map[string]any{
						"id":   mechanicID.Int64,
						"name": mechanicName.String,
					}
				}
				return nil
			}(),
			"details": details,
		})
	}

	if orders == nil {
		orders = []map[string]any{}
	}

	return orders, total, rows.Err()
}

func queryServiceOrderIndexDetails(db *sql.DB, orderID int64) ([]map[string]any, error) {
	var details []map[string]any

	query := `
		SELECT
			sod.id, sod.service_id, sod.part_id, sod.qty, sod.price, sod.amount, sod.final_amount,
			s.id as service_id, s.name as service_name,
			p.id as part_id, p.name as part_name
		FROM service_order_details sod
		LEFT JOIN services s ON sod.service_id = s.id
		LEFT JOIN parts p ON sod.part_id = p.id
		WHERE sod.service_order_id = ?
	`

	rows, err := db.Query(query, orderID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	for rows.Next() {
		var id, qty, price, amount, finalAmount sql.NullInt64
		var detailServiceID, detailPartID sql.NullInt64
		var serviceName, partName sql.NullString

		if err := rows.Scan(
			&id, &detailServiceID, &detailPartID, &qty, &price, &amount, &finalAmount,
			&detailServiceID, &serviceName,
			&detailPartID, &partName,
		); err != nil {
			return nil, err
		}

		detail := map[string]any{
			"id":           id.Int64,
			"qty":          qty.Int64,
			"price":        price.Int64,
			"amount":       amount.Int64,
			"final_amount": finalAmount.Int64,
		}

		if detailServiceID.Valid {
			detail["service"] = map[string]any{
				"id":   detailServiceID.Int64,
				"name": serviceName.String,
			}
		}

		if detailPartID.Valid {
			detail["part"] = map[string]any{
				"id":   detailPartID.Int64,
				"name": partName.String,
			}
		}

		details = append(details, detail)
	}

	if details == nil {
		details = []map[string]any{}
	}

	return details, rows.Err()
}

func queryServiceOrderIndexStats(db *sql.DB) (map[string]any, error) {
	var pending, inProgress, completed, paid int64
	var totalRevenue sql.NullInt64

	query := `
		SELECT
			SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending,
			SUM(CASE WHEN status = 'in_progress' THEN 1 ELSE 0 END) as in_progress,
			SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed,
			SUM(CASE WHEN status = 'paid' THEN 1 ELSE 0 END) as paid,
			SUM(CASE WHEN status IN ('completed', 'paid') THEN grand_total ELSE 0 END) as total_revenue
		FROM service_orders
		WHERE deleted_at IS NULL
	`

	if err := db.QueryRow(query).Scan(&pending, &inProgress, &completed, &paid, &totalRevenue); err != nil && err != sql.ErrNoRows {
		return nil, err
	}

	stats := map[string]any{
		"pending":       pending,
		"in_progress":   inProgress,
		"completed":     completed,
		"paid":          paid,
		"total_revenue": int64(0),
	}

	if totalRevenue.Valid {
		stats["total_revenue"] = totalRevenue.Int64
	}

	return stats, nil
}

func queryServiceOrderIndexMechanics(db *sql.DB) ([]map[string]any, error) {
	var mechanics []map[string]any

	query := `
		SELECT id, name
		FROM mechanics
		ORDER BY name
	`

	rows, err := db.Query(query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	for rows.Next() {
		var id int64
		var name string

		if err := rows.Scan(&id, &name); err != nil {
			return nil, err
		}

		mechanics = append(mechanics, map[string]any{
			"id":   id,
			"name": name,
		})
	}

	if mechanics == nil {
		mechanics = []map[string]any{}
	}

	return mechanics, rows.Err()
}
