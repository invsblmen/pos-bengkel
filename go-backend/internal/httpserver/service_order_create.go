package httpserver

import (
	"database/sql"
	"net/http"
)

func serviceOrderCreateHandler(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if db == nil {
			writeJSON(w, http.StatusServiceUnavailable, response{
				"error": "database not available",
			})
			return
		}

		// Query all data needed for create form
		activeOrders, err := queryServiceOrderCreateActiveOrders(db)
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, response{"error": "failed to fetch active orders"})
			return
		}

		customers, err := queryServiceOrderCreateCustomers(db)
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, response{"error": "failed to fetch customers"})
			return
		}

		vehicles, err := queryServiceOrderCreateVehicles(db)
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, response{"error": "failed to fetch vehicles"})
			return
		}

		mechanics, err := queryServiceOrderCreateMechanics(db)
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, response{"error": "failed to fetch mechanics"})
			return
		}

		services, err := queryServiceOrderCreateServices(db)
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, response{"error": "failed to fetch services"})
			return
		}

		parts, err := queryServiceOrderCreateParts(db)
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, response{"error": "failed to fetch parts"})
			return
		}

		tags, err := queryServiceOrderCreateTags(db)
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, response{"error": "failed to fetch tags"})
			return
		}

		vouchers, err := queryServiceOrderCreateVouchers(db)
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, response{"error": "failed to fetch vouchers"})
			return
		}

		writeJSON(w, http.StatusOK, response{
			"customers":           customers,
			"vehicles":            vehicles,
			"mechanics":           mechanics,
			"services":            services,
			"parts":               parts,
			"tags":                tags,
			"activeServiceOrders": activeOrders,
			"availableVouchers":   vouchers,
		})
	}
}

func queryServiceOrderCreateActiveOrders(db *sql.DB) ([]map[string]any, error) {
	var orders []map[string]any

	query := `
		SELECT id, vehicle_id, status, order_number
		FROM service_orders
		WHERE status IN ('pending', 'in_progress') AND deleted_at IS NULL
		ORDER BY created_at DESC
	`

	rows, err := db.Query(query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	for rows.Next() {
		var id, vehicleID sql.NullInt64
		var status, orderNumber sql.NullString

		if err := rows.Scan(&id, &vehicleID, &status, &orderNumber); err != nil {
			return nil, err
		}

		orders = append(orders, map[string]any{
			"id":           id.Int64,
			"vehicle_id":   vehicleID.Int64,
			"status":       status.String,
			"order_number": orderNumber.String,
		})
	}

	if orders == nil {
		orders = []map[string]any{}
	}

	return orders, rows.Err()
}

func queryServiceOrderCreateCustomers(db *sql.DB) ([]map[string]any, error) {
	var customers []map[string]any

	query := `
		SELECT c.id, c.name, v.id as vehicle_id, v.plate_number, v.brand, v.model
		FROM customers c
		LEFT JOIN vehicles v ON c.id = v.customer_id
		ORDER BY c.name ASC
	`

	rows, err := db.Query(query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	// Build map to group vehicles by customer
	customerMap := make(map[int64]map[string]any)

	for rows.Next() {
		var customerID sql.NullInt64
		var customerName sql.NullString
		var vehicleID sql.NullInt64
		var platNumber, brand, model sql.NullString

		if err := rows.Scan(&customerID, &customerName, &vehicleID, &platNumber, &brand, &model); err != nil {
			return nil, err
		}

		if !customerID.Valid {
			continue
		}

		keyID := customerID.Int64

		// Initialize customer if not exists
		if _, exists := customerMap[keyID]; !exists {
			customerMap[keyID] = map[string]any{
				"id":       customerID.Int64,
				"name":     customerName.String,
				"vehicles": []map[string]any{},
			}
		}

		// Add vehicle if exists
		if vehicleID.Valid {
			vehicles := customerMap[keyID]["vehicles"].([]map[string]any)
			vehicles = append(vehicles, map[string]any{
				"id":           vehicleID.Int64,
				"plate_number": platNumber.String,
				"brand":        brand.String,
				"model":        model.String,
			})
			customerMap[keyID]["vehicles"] = vehicles
		}
	}

	// Convert map to slice
	for _, customer := range customerMap {
		customers = append(customers, customer)
	}

	if customers == nil {
		customers = []map[string]any{}
	}

	return customers, rows.Err()
}

func queryServiceOrderCreateVehicles(db *sql.DB) ([]map[string]any, error) {
	var vehicles []map[string]any

	query := `
		SELECT v.id, v.plate_number, v.brand, v.model, v.customer_id, c.name as customer_name
		FROM vehicles v
		LEFT JOIN customers c ON v.customer_id = c.id
		ORDER BY v.brand ASC, v.model ASC
	`

	rows, err := db.Query(query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	for rows.Next() {
		var id, customerID sql.NullInt64
		var platNumber, brand, model, customerName sql.NullString

		if err := rows.Scan(&id, &platNumber, &brand, &model, &customerID, &customerName); err != nil {
			return nil, err
		}

		vehicle := map[string]any{
			"id":           id.Int64,
			"plate_number": platNumber.String,
			"brand":        brand.String,
			"model":        model.String,
		}

		if customerID.Valid {
			vehicle["customer"] = map[string]any{
				"id":   customerID.Int64,
				"name": customerName.String,
			}
		}

		vehicles = append(vehicles, vehicle)
	}

	if vehicles == nil {
		vehicles = []map[string]any{}
	}

	return vehicles, rows.Err()
}

func queryServiceOrderCreateMechanics(db *sql.DB) ([]map[string]any, error) {
	var mechanics []map[string]any

	query := `
		SELECT id, name
		FROM mechanics
		ORDER BY name ASC
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

func queryServiceOrderCreateServices(db *sql.DB) ([]map[string]any, error) {
	var services []map[string]any

	query := `
		SELECT id, name, description, price
		FROM services
		ORDER BY name ASC
	`

	rows, err := db.Query(query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	for rows.Next() {
		var id, price sql.NullInt64
		var name, description sql.NullString

		if err := rows.Scan(&id, &name, &description, &price); err != nil {
			return nil, err
		}

		services = append(services, map[string]any{
			"id":          id.Int64,
			"name":        name.String,
			"description": description.String,
			"price":       price.Int64,
		})
	}

	if services == nil {
		services = []map[string]any{}
	}

	return services, rows.Err()
}

func queryServiceOrderCreateParts(db *sql.DB) ([]map[string]any, error) {
	var parts []map[string]any

	query := `
		SELECT p.id, p.name, p.part_number, p.sell_price, pc.id as category_id, pc.name as category_name
		FROM parts p
		LEFT JOIN part_categories pc ON p.part_category_id = pc.id
		ORDER BY p.name ASC
	`

	rows, err := db.Query(query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	for rows.Next() {
		var id, sellPrice, categoryID sql.NullInt64
		var name, partNumber, categoryName sql.NullString

		if err := rows.Scan(&id, &name, &partNumber, &sellPrice, &categoryID, &categoryName); err != nil {
			return nil, err
		}

		part := map[string]any{
			"id":          id.Int64,
			"name":        name.String,
			"part_number": partNumber.String,
			"sell_price":  sellPrice.Int64,
		}

		if categoryID.Valid {
			part["category"] = map[string]any{
				"id":   categoryID.Int64,
				"name": categoryName.String,
			}
		}

		parts = append(parts, part)
	}

	if parts == nil {
		parts = []map[string]any{}
	}

	return parts, rows.Err()
}

func queryServiceOrderCreateTags(db *sql.DB) ([]map[string]any, error) {
	var tags []map[string]any

	query := `
		SELECT id, name
		FROM tags
		ORDER BY name ASC
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

		tags = append(tags, map[string]any{
			"id":   id,
			"name": name,
		})
	}

	if tags == nil {
		tags = []map[string]any{}
	}

	return tags, rows.Err()
}

func queryServiceOrderCreateVouchers(db *sql.DB) ([]map[string]any, error) {
	var vouchers []map[string]any

	query := `
		SELECT id, code, name, scope
		FROM vouchers
		WHERE is_active = 1
		ORDER BY code ASC
	`

	rows, err := db.Query(query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	for rows.Next() {
		var id int64
		var code, name, scope string

		if err := rows.Scan(&id, &code, &name, &scope); err != nil {
			return nil, err
		}

		vouchers = append(vouchers, map[string]any{
			"id":    id,
			"code":  code,
			"name":  name,
			"scope": scope,
		})
	}

	if vouchers == nil {
		vouchers = []map[string]any{}
	}

	return vouchers, rows.Err()
}
