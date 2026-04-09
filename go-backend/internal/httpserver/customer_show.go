package httpserver

import (
	"database/sql"
	"net/http"
	"strings"
)

func customerShowHandler(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if db == nil {
			writeJSON(w, http.StatusServiceUnavailable, response{"message": "database is not configured"})
			return
		}

		id := strings.TrimSpace(r.PathValue("id"))
		if id == "" {
			writeJSON(w, http.StatusBadRequest, response{"message": "customer id is required"})
			return
		}

		customerID := parseInt64WithDefault(id)
		if customerID <= 0 {
			writeJSON(w, http.StatusBadRequest, response{"message": "customer id is required"})
			return
		}

		customer, err := queryCustomerShowCustomer(db, customerID)
		if err == sql.ErrNoRows {
			writeJSON(w, http.StatusNotFound, response{"message": "customer not found"})
			return
		}
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, response{"message": "failed to read customer"})
			return
		}

		vehicles, err := queryCustomerShowVehicles(db, customerID)
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, response{"message": "failed to read vehicles"})
			return
		}

		serviceOrders, err := queryCustomerShowServiceOrders(db, customerID)
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, response{"message": "failed to read service orders"})
			return
		}

		customer["vehicles"] = vehicles
		customer["service_orders"] = serviceOrders

		writeJSON(w, http.StatusOK, response{"customer": customer})
	}
}

func queryCustomerShowCustomer(db *sql.DB, customerID int64) (response, error) {
	const q = `
		SELECT c.id, c.name, c.phone, c.email, c.address, c.created_at, c.updated_at
		FROM customers c
		WHERE c.id = ?
		LIMIT 1
	`

	var id int64
	var name, phone, email, address sql.NullString
	var createdAt, updatedAt sql.NullTime

	err := db.QueryRow(q, customerID).Scan(&id, &name, &phone, &email, &address, &createdAt, &updatedAt)
	if err != nil {
		return nil, err
	}

	return response{
		"id":         id,
		"name":       nullString(name),
		"phone":      nullString(phone),
		"email":      nullString(email),
		"address":    nullString(address),
		"created_at": timeToISO(createdAt),
		"updated_at": timeToISO(updatedAt),
	}, nil
}

func queryCustomerShowVehicles(db *sql.DB, customerID int64) ([]response, error) {
	const q = `
		SELECT v.id, v.customer_id, v.plate_number, v.brand, v.model, v.year, v.km, v.created_at, v.updated_at
		FROM vehicles v
		WHERE v.customer_id = ?
		ORDER BY v.created_at DESC, v.id DESC
	`

	rows, err := db.Query(q, customerID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	items := make([]response, 0)
	for rows.Next() {
		var id int64
		var relatedCustomerID sql.NullInt64
		var plate, brand, model sql.NullString
		var year, km sql.NullInt64
		var createdAt, updatedAt sql.NullTime

		if err := rows.Scan(&id, &relatedCustomerID, &plate, &brand, &model, &year, &km, &createdAt, &updatedAt); err != nil {
			return nil, err
		}

		items = append(items, response{
			"id":           id,
			"customer_id":  nullInt(relatedCustomerID),
			"plate_number": nullString(plate),
			"brand":        nullString(brand),
			"model":        nullString(model),
			"year":         nullInt(year),
			"km":           nullInt(km),
			"created_at":   timeToISO(createdAt),
			"updated_at":   timeToISO(updatedAt),
		})
	}

	return items, rows.Err()
}

func queryCustomerShowServiceOrders(db *sql.DB, customerID int64) ([]response, error) {
	const q = `
		SELECT so.id, so.order_number, so.status, so.created_at,
		       v.id, v.plate_number, v.brand, v.model,
		       m.id, m.name
		FROM service_orders so
		LEFT JOIN vehicles v ON v.id = so.vehicle_id
		LEFT JOIN mechanics m ON m.id = so.mechanic_id
		WHERE so.customer_id = ?
		ORDER BY so.created_at DESC, so.id DESC
		LIMIT 20
	`

	rows, err := db.Query(q, customerID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	items := make([]response, 0)
	for rows.Next() {
		var id int64
		var orderNumber, status sql.NullString
		var createdAt sql.NullTime
		var vehicleID, mechanicID sql.NullInt64
		var vehiclePlate, vehicleBrand, vehicleModel sql.NullString
		var mechanicName sql.NullString

		if err := rows.Scan(&id, &orderNumber, &status, &createdAt, &vehicleID, &vehiclePlate, &vehicleBrand, &vehicleModel, &mechanicID, &mechanicName); err != nil {
			return nil, err
		}

		item := response{
			"id":           id,
			"order_number": nullString(orderNumber),
			"status":       nullString(status),
			"created_at":   timeToISO(createdAt),
			"vehicle":      nil,
			"mechanic":     nil,
		}

		if vehicleID.Valid {
			item["vehicle"] = response{
				"id":           vehicleID.Int64,
				"plate_number": nullString(vehiclePlate),
				"brand":        nullString(vehicleBrand),
				"model":        nullString(vehicleModel),
			}
		}

		if mechanicID.Valid {
			item["mechanic"] = response{
				"id":   mechanicID.Int64,
				"name": nullString(mechanicName),
			}
		}

		items = append(items, item)
	}

	return items, rows.Err()
}

func timeToISO(t sql.NullTime) any {
	if !t.Valid {
		return nil
	}
	return t.Time.Format("2006-01-02T15:04:05-07:00")
}
