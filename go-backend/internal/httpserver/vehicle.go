package httpserver

import (
	"database/sql"
	"fmt"
	"net/http"
	"strings"
)

func vehicleMaintenanceInsightsHandler(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if db == nil {
			writeJSON(w, http.StatusServiceUnavailable, response{"message": "database is not configured"})
			return
		}

		vehicleID := strings.TrimSpace(r.PathValue("id"))
		if vehicleID == "" {
			writeJSON(w, http.StatusBadRequest, response{"message": "vehicle id is required"})
			return
		}

		vehicleKM, err := queryLatestKM(db, vehicleID)
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, response{"message": "failed to read vehicle km"})
			return
		}

		lastServiceDate, nextServiceDate, err := queryServiceDates(db, vehicleID)
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, response{"message": "failed to read service dates"})
			return
		}

		lastKM, err := queryLastKMByCategory(db, vehicleID)
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, response{"message": "failed to read maintenance insights"})
			return
		}

		writeJSON(w, http.StatusOK, response{
			"vehicle_km":        vehicleKM,
			"last_service_date": lastServiceDate,
			"next_service_date": nextServiceDate,
			"last_km":           lastKM,
		})
	}
}

func vehicleServiceHistoryHandler(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if db == nil {
			writeJSON(w, http.StatusServiceUnavailable, response{"message": "database is not configured"})
			return
		}

		vehicleID := strings.TrimSpace(r.PathValue("id"))
		if vehicleID == "" {
			writeJSON(w, http.StatusBadRequest, response{"message": "vehicle id is required"})
			return
		}

		exists, err := vehicleExists(db, vehicleID)
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, response{"service_orders": []any{}, "error": "failed to read vehicle"})
			return
		}
		if !exists {
			writeJSON(w, http.StatusInternalServerError, response{"service_orders": []any{}, "error": "vehicle not found"})
			return
		}

		orders, err := queryServiceOrders(db, vehicleID, 20)
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, response{"service_orders": []any{}, "error": err.Error()})
			return
		}

		writeJSON(w, http.StatusOK, response{"service_orders": orders})
	}
}

func vehicleWithHistoryHandler(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if db == nil {
			writeJSON(w, http.StatusServiceUnavailable, response{"message": "database is not configured"})
			return
		}

		vehicleID := strings.TrimSpace(r.PathValue("id"))
		if vehicleID == "" {
			writeJSON(w, http.StatusBadRequest, response{"message": "vehicle id is required"})
			return
		}

		vehicle, err := queryVehicleSummary(db, vehicleID)
		if err == sql.ErrNoRows {
			writeJSON(w, http.StatusNotFound, response{"message": "vehicle not found"})
			return
		}
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, response{"message": "failed to read vehicle"})
			return
		}

		vehicleKM, err := queryLatestKM(db, vehicleID)
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, response{"message": "failed to read vehicle km"})
			return
		}

		lastServiceDate, nextServiceDate, err := queryServiceDates(db, vehicleID)
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, response{"message": "failed to read service dates"})
			return
		}

		recentOrders, err := queryRecentOrdersWithCost(db, vehicleID, 10)
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, response{"message": "failed to read recent orders"})
			return
		}

		vehicle["km"] = vehicleKM
		vehicle["last_service_date"] = lastServiceDate
		vehicle["next_service_date"] = nextServiceDate

		writeJSON(w, http.StatusOK, response{
			"vehicle":       vehicle,
			"recent_orders": recentOrders,
		})
	}
}

func vehicleDetailHandler(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if db == nil {
			writeJSON(w, http.StatusServiceUnavailable, response{"message": "database is not configured"})
			return
		}

		vehicleID := strings.TrimSpace(r.PathValue("id"))
		if vehicleID == "" {
			writeJSON(w, http.StatusBadRequest, response{"message": "vehicle id is required"})
			return
		}

		vehicle, err := queryVehicleDetail(db, vehicleID)
		if err == sql.ErrNoRows {
			writeJSON(w, http.StatusNotFound, response{"message": "vehicle not found"})
			return
		}
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, response{"message": "failed to read vehicle"})
			return
		}

		serviceOrders, err := queryVehicleShowServiceOrders(db, vehicleID)
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, response{"message": "failed to read service orders"})
			return
		}

		vehicle["km"] = nil
		vehicle["last_service_date"] = nil
		vehicle["next_service_date"] = nil

		if km, lastServiceDate, nextServiceDate, err := queryVehicleRealtimeSummary(db, vehicleID); err == nil {
			vehicle["km"] = km
			vehicle["last_service_date"] = lastServiceDate
			vehicle["next_service_date"] = nextServiceDate
		}

		writeJSON(w, http.StatusOK, response{
			"vehicle":        vehicle,
			"service_orders": serviceOrders,
		})
	}
}

func queryLatestKM(db *sql.DB, vehicleID string) (any, error) {
	const q = `
		SELECT MAX(odometer_km)
		FROM service_orders
		WHERE vehicle_id = ?
		  AND status IN ('completed', 'paid')
		  AND odometer_km IS NOT NULL
	`

	var km sql.NullInt64
	if err := db.QueryRow(q, vehicleID).Scan(&km); err != nil {
		return nil, err
	}
	if !km.Valid {
		return nil, nil
	}
	return km.Int64, nil
}

func queryServiceDates(db *sql.DB, vehicleID string) (any, any, error) {
	const lastServiceQuery = `
		SELECT COALESCE(actual_finish_at, created_at) AS service_date, next_service_date
		FROM service_orders
		WHERE vehicle_id = ?
		  AND status IN ('completed', 'paid')
		  AND odometer_km IS NOT NULL
		ORDER BY created_at DESC
		LIMIT 1
	`

	var serviceDate sql.NullTime
	var latestNextServiceDate sql.NullTime
	err := db.QueryRow(lastServiceQuery, vehicleID).Scan(&serviceDate, &latestNextServiceDate)
	if err != nil && err != sql.ErrNoRows {
		return nil, nil, err
	}

	var lastService any
	if err != sql.ErrNoRows && serviceDate.Valid {
		lastService = serviceDate.Time.Format("2006-01-02")
	}

	const upcomingQuery = `
		SELECT next_service_date
		FROM service_orders
		WHERE vehicle_id = ?
		  AND status IN ('pending', 'in_progress')
		  AND next_service_date IS NOT NULL
		ORDER BY next_service_date ASC
		LIMIT 1
	`

	var upcomingNextServiceDate sql.NullTime
	err = db.QueryRow(upcomingQuery, vehicleID).Scan(&upcomingNextServiceDate)
	if err != nil && err != sql.ErrNoRows {
		return nil, nil, err
	}

	var nextService any
	if err != sql.ErrNoRows && upcomingNextServiceDate.Valid {
		nextService = upcomingNextServiceDate.Time.Format("2006-01-02")
	} else if latestNextServiceDate.Valid {
		nextService = latestNextServiceDate.Time.Format("2006-01-02")
	}

	return lastService, nextService, nil
}

func queryLastKMByCategory(db *sql.DB, vehicleID string) (map[string]any, error) {
	const q = `
		SELECT so.odometer_km, COALESCE(s.title, ''), COALESCE(p.name, '')
		FROM service_orders so
		JOIN service_order_details sod ON sod.service_order_id = so.id
		LEFT JOIN services s ON s.id = sod.service_id
		LEFT JOIN parts p ON p.id = sod.part_id
		WHERE so.vehicle_id = ?
		  AND so.odometer_km IS NOT NULL
		ORDER BY so.odometer_km DESC
		LIMIT 500
	`

	rows, err := db.Query(q, vehicleID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	lastKM := map[string]any{
		"oil":      nil,
		"air":      nil,
		"spark":    nil,
		"brakepad": nil,
		"belt":     nil,
	}

	for rows.Next() {
		var odometer int64
		var serviceTitle string
		var partName string
		if err := rows.Scan(&odometer, &serviceTitle, &partName); err != nil {
			return nil, err
		}

		if lastKM["oil"] == nil && (matchKeyword(serviceTitle, "oli", "oil") || matchKeyword(partName, "oli", "oil")) {
			lastKM["oil"] = odometer
		}
		if lastKM["air"] == nil && (matchKeyword(serviceTitle, "filter udara", "air filter") || matchKeyword(partName, "filter udara", "air filter")) {
			lastKM["air"] = odometer
		}
		if lastKM["spark"] == nil && (matchKeyword(serviceTitle, "busi", "spark") || matchKeyword(partName, "busi", "spark")) {
			lastKM["spark"] = odometer
		}
		if lastKM["brakepad"] == nil && (matchKeyword(serviceTitle, "kampas rem", "brake pad") || matchKeyword(partName, "kampas rem", "brake pad")) {
			lastKM["brakepad"] = odometer
		}
		if lastKM["belt"] == nil && (matchKeyword(serviceTitle, "belt", "v-belt", "cvt") || matchKeyword(partName, "belt", "v-belt", "cvt")) {
			lastKM["belt"] = odometer
		}
	}

	if err := rows.Err(); err != nil {
		return nil, err
	}

	return lastKM, nil
}

func matchKeyword(text string, keywords ...string) bool {
	lower := strings.ToLower(text)
	for _, kw := range keywords {
		if strings.Contains(lower, strings.ToLower(kw)) {
			return true
		}
	}
	return false
}

func dsnFromConfig(host, port, user, password, dbName, params string) string {
	base := fmt.Sprintf("%s:%s@tcp(%s:%s)/%s", user, password, host, port, dbName)
	if strings.TrimSpace(params) != "" {
		return base + "?" + params
	}
	return base
}

func queryVehicleSummary(db *sql.DB, vehicleID string) (response, error) {
	const q = `
		SELECT id, plate_number, brand, model
		FROM vehicles
		WHERE id = ?
		LIMIT 1
	`

	var id int64
	var plate sql.NullString
	var brand sql.NullString
	var model sql.NullString
	if err := db.QueryRow(q, vehicleID).Scan(&id, &plate, &brand, &model); err != nil {
		return nil, err
	}

	return response{
		"id":           id,
		"plate_number": nullString(plate),
		"brand":        nullString(brand),
		"model":        nullString(model),
	}, nil
}

func queryVehicleDetail(db *sql.DB, vehicleID string) (response, error) {
	const q = `
		SELECT v.id, v.plate_number, v.brand, v.model, v.year, v.color, v.engine_type,
		       v.transmission_type, v.cylinder_volume, v.notes,
		       v.features, c.id, c.name, c.phone
		FROM vehicles v
		LEFT JOIN customers c ON c.id = v.customer_id
		WHERE v.id = ?
		LIMIT 1
	`

	var id int64
	var plate sql.NullString
	var brand sql.NullString
	var model sql.NullString
	var year sql.NullInt64
	var color sql.NullString
	var engineType sql.NullString
	var transmissionType sql.NullString
	var cylinderVolume sql.NullInt64
	var notes sql.NullString
	var features sql.NullString
	var customerID sql.NullInt64
	var customerName sql.NullString
	var customerPhone sql.NullString

	if err := db.QueryRow(q, vehicleID).Scan(&id, &plate, &brand, &model, &year, &color, &engineType, &transmissionType, &cylinderVolume, &notes, &features, &customerID, &customerName, &customerPhone); err != nil {
		return nil, err
	}

	vehicle := response{
		"id":                id,
		"plate_number":      nullString(plate),
		"brand":             nullString(brand),
		"model":             nullString(model),
		"year":              nullInt(year),
		"color":             nullString(color),
		"engine_type":       nullString(engineType),
		"transmission_type": nullString(transmissionType),
		"cylinder_volume":   nullInt(cylinderVolume),
		"features":          parseJSONArray(features.String),
		"notes":             nullString(notes),
		"customer":          nil,
	}

	if customerID.Valid {
		vehicle["customer"] = response{
			"id":    customerID.Int64,
			"name":  nullString(customerName),
			"phone": nullString(customerPhone),
		}
	}

	return vehicle, nil
}

func queryVehicleRealtimeSummary(db *sql.DB, vehicleID string) (any, any, any, error) {
	const q = `
		SELECT COALESCE(MAX(odometer_km), NULL),
		       COALESCE(DATE(MAX(CASE WHEN status IN ('completed', 'paid') AND actual_finish_at IS NOT NULL THEN actual_finish_at ELSE created_at END)), NULL),
		       COALESCE(DATE((SELECT next_service_date FROM service_orders WHERE vehicle_id = ? AND status IN ('pending', 'in_progress') AND next_service_date IS NOT NULL ORDER BY next_service_date ASC LIMIT 1)), NULL)
		FROM service_orders
		WHERE vehicle_id = ?
		  AND status IN ('completed', 'paid')
		  AND odometer_km IS NOT NULL
	`

	var km sql.NullInt64
	var lastServiceDate sql.NullString
	var nextServiceDate sql.NullString
	if err := db.QueryRow(q, vehicleID, vehicleID).Scan(&km, &lastServiceDate, &nextServiceDate); err != nil {
		return nil, nil, nil, err
	}

	return nullInt(km), stringOrNil(lastServiceDate), stringOrNil(nextServiceDate), nil
}

func queryVehicleShowServiceOrders(db *sql.DB, vehicleID string) ([]response, error) {
	const ordersQuery = `
		SELECT so.id, so.order_number, so.status, so.odometer_km, so.total, so.labor_cost, so.material_cost,
		       so.created_at, so.actual_finish_at, so.estimated_finish_at,
		       m.id AS mechanic_id, m.name AS mechanic_name
		FROM service_orders so
		LEFT JOIN mechanics m ON m.id = so.mechanic_id
		WHERE so.vehicle_id = ?
		ORDER BY so.created_at DESC
	`

	rows, err := db.Query(ordersQuery, vehicleID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	orders := make([]response, 0)
	orderIDs := make([]int64, 0)
	orderIndex := map[int64]int{}
	for rows.Next() {
		var id int64
		var orderNumber sql.NullString
		var status sql.NullString
		var odometer sql.NullInt64
		var total sql.NullInt64
		var labor sql.NullInt64
		var material sql.NullInt64
		var createdAt sql.NullTime
		var actualFinish sql.NullTime
		var estimatedFinish sql.NullTime
		var mechanicID sql.NullInt64
		var mechanicName sql.NullString

		if err := rows.Scan(&id, &orderNumber, &status, &odometer, &total, &labor, &material, &createdAt, &actualFinish, &estimatedFinish, &mechanicID, &mechanicName); err != nil {
			return nil, err
		}

		order := response{
			"id":                  id,
			"order_number":        nullString(orderNumber),
			"status":              nullString(status),
			"odometer_km":         nullInt(odometer),
			"total":               intOrDefault(total, 0),
			"labor_cost":          intOrDefault(labor, 0),
			"material_cost":       intOrDefault(material, 0),
			"created_at":          nullTime(createdAt),
			"actual_finish_at":    nullTime(actualFinish),
			"estimated_finish_at": nullTime(estimatedFinish),
			"mechanic":            nil,
			"details":             []response{},
		}

		if mechanicID.Valid {
			order["mechanic"] = response{"id": mechanicID.Int64, "name": nullString(mechanicName)}
		}

		orderIndex[id] = len(orders)
		orderIDs = append(orderIDs, id)
		orders = append(orders, order)
	}

	if err := rows.Err(); err != nil {
		return nil, err
	}

	if len(orderIDs) == 0 {
		return orders, nil
	}

	if err := attachVehicleShowDetails(db, orders, orderIndex, orderIDs); err != nil {
		return nil, err
	}

	return orders, nil
}

func attachVehicleShowDetails(db *sql.DB, orders []response, orderIndex map[int64]int, orderIDs []int64) error {
	placeholders := make([]string, 0, len(orderIDs))
	args := make([]any, 0, len(orderIDs))
	for _, id := range orderIDs {
		placeholders = append(placeholders, "?")
		args = append(args, id)
	}

	q := `
		SELECT sod.service_order_id, sod.id, sod.qty, sod.price,
		       s.id, s.title, s.price,
		       p.id, p.name, p.sell_price
		FROM service_order_details sod
		LEFT JOIN services s ON s.id = sod.service_id
		LEFT JOIN parts p ON p.id = sod.part_id
		WHERE sod.service_order_id IN (` + strings.Join(placeholders, ",") + `)
		ORDER BY sod.id ASC
	`

	rows, err := db.Query(q, args...)
	if err != nil {
		return err
	}
	defer rows.Close()

	for rows.Next() {
		var orderID int64
		var detailID int64
		var qty sql.NullInt64
		var price sql.NullInt64
		var serviceID sql.NullInt64
		var serviceTitle sql.NullString
		var servicePrice sql.NullInt64
		var partID sql.NullInt64
		var partName sql.NullString
		var partPrice sql.NullInt64

		if err := rows.Scan(&orderID, &detailID, &qty, &price, &serviceID, &serviceTitle, &servicePrice, &partID, &partName, &partPrice); err != nil {
			return err
		}

		idx, ok := orderIndex[orderID]
		if !ok {
			continue
		}

		detail := response{
			"id":      detailID,
			"qty":     intOrDefault(qty, 1),
			"price":   intOrDefault(price, 0),
			"service": nil,
			"part":    nil,
		}

		if serviceID.Valid {
			detail["service"] = response{
				"id":    serviceID.Int64,
				"title": nullString(serviceTitle),
				"price": intOrDefault(servicePrice, 0),
			}
		}
		if partID.Valid {
			detail["part"] = response{
				"id":    partID.Int64,
				"name":  nullString(partName),
				"price": intOrDefault(partPrice, 0),
			}
		}

		current := orders[idx]["details"].([]response)
		orders[idx]["details"] = append(current, detail)
	}

	return rows.Err()
}

func parseJSONArray(raw string) any {
	trimmed := strings.TrimSpace(raw)
	if trimmed == "" {
		return []any{}
	}
	if strings.HasPrefix(trimmed, "[") && strings.HasSuffix(trimmed, "]") {
		return []any{}
	}
	return []any{}
}

func stringOrNil(v sql.NullString) any {
	if v.Valid {
		return v.String
	}
	return nil
}

func queryRecentOrdersWithCost(db *sql.DB, vehicleID string, limit int) ([]response, error) {
	const q = `
		SELECT
			so.id,
			so.order_number,
			so.status,
			DATE(so.created_at) AS created_date,
			so.odometer_km,
			m.name AS mechanic_name,
			COALESCE(SUM(COALESCE(s.price, 0) + (COALESCE(p.sell_price, 0) * COALESCE(sod.qty, 1))), 0) AS total_cost
		FROM service_orders so
		LEFT JOIN mechanics m ON m.id = so.mechanic_id
		LEFT JOIN service_order_details sod ON sod.service_order_id = so.id
		LEFT JOIN services s ON s.id = sod.service_id
		LEFT JOIN parts p ON p.id = sod.part_id
		WHERE so.vehicle_id = ?
		GROUP BY so.id, so.order_number, so.status, DATE(so.created_at), so.odometer_km, m.name, so.created_at
		ORDER BY so.created_at DESC
		LIMIT ?
	`

	rows, err := db.Query(q, vehicleID, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	orders := make([]response, 0)
	for rows.Next() {
		var id int64
		var orderNumber sql.NullString
		var status sql.NullString
		var createdDate sql.NullString
		var odometerKM sql.NullInt64
		var mechanicName sql.NullString
		var totalCost sql.NullInt64

		if err := rows.Scan(&id, &orderNumber, &status, &createdDate, &odometerKM, &mechanicName, &totalCost); err != nil {
			return nil, err
		}

		order := response{
			"id":           id,
			"order_number": nullString(orderNumber),
			"status":       nullString(status),
			"created_at":   nullString(createdDate),
			"odometer_km":  nullInt(odometerKM),
			"mechanic":     nil,
			"total_cost":   int64(0),
		}

		if mechanicName.Valid {
			order["mechanic"] = response{"name": mechanicName.String}
		}
		if totalCost.Valid {
			order["total_cost"] = totalCost.Int64
		}

		orders = append(orders, order)
	}

	return orders, rows.Err()
}

func vehicleExists(db *sql.DB, vehicleID string) (bool, error) {
	var exists int
	err := db.QueryRow("SELECT 1 FROM vehicles WHERE id = ? LIMIT 1", vehicleID).Scan(&exists)
	if err == sql.ErrNoRows {
		return false, nil
	}
	if err != nil {
		return false, err
	}
	return true, nil
}

func queryServiceOrders(db *sql.DB, vehicleID string, limit int) ([]response, error) {
	const ordersQuery = `
		SELECT so.id, so.order_number, so.status, so.created_at, so.odometer_km, so.total, so.notes,
		       m.id AS mechanic_id, m.name AS mechanic_name
		FROM service_orders so
		LEFT JOIN mechanics m ON m.id = so.mechanic_id
		WHERE so.vehicle_id = ?
		ORDER BY so.created_at DESC
		LIMIT ?
	`

	rows, err := db.Query(ordersQuery, vehicleID, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	orders := make([]response, 0)
	orderIDList := make([]int64, 0)
	orderIndexByID := make(map[int64]int)

	for rows.Next() {
		var id int64
		var orderNumber sql.NullString
		var status sql.NullString
		var createdAt sql.NullTime
		var odometerKM sql.NullInt64
		var total sql.NullInt64
		var notes sql.NullString
		var mechanicID sql.NullInt64
		var mechanicName sql.NullString

		if err := rows.Scan(&id, &orderNumber, &status, &createdAt, &odometerKM, &total, &notes, &mechanicID, &mechanicName); err != nil {
			return nil, err
		}

		order := response{
			"id":           id,
			"order_number": nullString(orderNumber),
			"status":       nullString(status),
			"created_at":   nullTime(createdAt),
			"odometer_km":  nullInt(odometerKM),
			"total":        nullInt(total),
			"notes":        nullString(notes),
			"mechanic":     nil,
			"details":      []response{},
		}

		if mechanicID.Valid {
			order["mechanic"] = response{
				"id":   mechanicID.Int64,
				"name": nullString(mechanicName),
			}
		}

		orderIndexByID[id] = len(orders)
		orderIDList = append(orderIDList, id)
		orders = append(orders, order)
	}

	if err := rows.Err(); err != nil {
		return nil, err
	}

	if len(orderIDList) == 0 {
		return orders, nil
	}

	if err := attachServiceOrderDetails(db, orders, orderIndexByID, orderIDList); err != nil {
		return nil, err
	}

	return orders, nil
}

func attachServiceOrderDetails(db *sql.DB, orders []response, orderIndexByID map[int64]int, orderIDs []int64) error {
	placeholders := make([]string, 0, len(orderIDs))
	args := make([]any, 0, len(orderIDs))
	for _, id := range orderIDs {
		placeholders = append(placeholders, "?")
		args = append(args, id)
	}

	detailsQuery := `
		SELECT sod.service_order_id, sod.id,
		       s.id AS service_id, s.name AS service_name,
		       p.id AS part_id, p.name AS part_name,
		       sod.qty,
		       COALESCE(sod.final_amount, sod.amount, sod.price, 0) AS line_price
		FROM service_order_details sod
		LEFT JOIN services s ON s.id = sod.service_id
		LEFT JOIN parts p ON p.id = sod.part_id
		WHERE sod.service_order_id IN (` + strings.Join(placeholders, ",") + `)
		ORDER BY sod.id ASC
	`

	rows, err := db.Query(detailsQuery, args...)
	if err != nil {
		return err
	}
	defer rows.Close()

	for rows.Next() {
		var orderID int64
		var detailID int64
		var serviceID sql.NullInt64
		var serviceName sql.NullString
		var partID sql.NullInt64
		var partName sql.NullString
		var qty sql.NullInt64
		var linePrice sql.NullInt64

		if err := rows.Scan(&orderID, &detailID, &serviceID, &serviceName, &partID, &partName, &qty, &linePrice); err != nil {
			return err
		}

		idx, ok := orderIndexByID[orderID]
		if !ok {
			continue
		}

		detail := response{
			"id":       detailID,
			"service":  nil,
			"part":     nil,
			"quantity": 1,
			"price":    int64(0),
		}

		if serviceID.Valid {
			detail["service"] = response{
				"id":   serviceID.Int64,
				"name": nullString(serviceName),
			}
		}
		if partID.Valid {
			detail["part"] = response{
				"id":   partID.Int64,
				"name": nullString(partName),
			}
		}
		if qty.Valid {
			detail["quantity"] = qty.Int64
		}
		if linePrice.Valid {
			detail["price"] = linePrice.Int64
		}

		current := orders[idx]["details"].([]response)
		orders[idx]["details"] = append(current, detail)
	}

	return rows.Err()
}

func nullString(v sql.NullString) any {
	if v.Valid {
		return v.String
	}
	return nil
}

func nullInt(v sql.NullInt64) any {
	if v.Valid {
		return v.Int64
	}
	return nil
}

func nullTime(v sql.NullTime) any {
	if v.Valid {
		return v.Time.Format("2006-01-02T15:04:05Z07:00")
	}
	return nil
}
