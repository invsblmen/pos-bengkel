package httpserver

import (
	"database/sql"
	"net/http"
)

func partPurchaseCreateHandler(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if db == nil {
			writeJSON(w, http.StatusServiceUnavailable, response{"message": "database is not configured"})
			return
		}

		suppliers, err := queryPartPurchaseCreateSuppliers(db)
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, response{"message": "failed to read suppliers"})
			return
		}

		parts, err := queryPartPurchaseCreateParts(db)
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, response{"message": "failed to read parts"})
			return
		}

		categories, err := queryPartPurchaseCreateCategories(db)
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, response{"message": "failed to read categories"})
			return
		}

		writeJSON(w, http.StatusOK, response{
			"suppliers":  suppliers,
			"parts":      parts,
			"categories": categories,
		})
	}
}

func queryPartPurchaseCreateSuppliers(db *sql.DB) ([]response, error) {
	rows, err := db.Query(`
		SELECT id, name, phone, address
		FROM suppliers
		ORDER BY name ASC
	`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	items := make([]response, 0)
	for rows.Next() {
		var id int64
		var name, phone, address sql.NullString
		if err := rows.Scan(&id, &name, &phone, &address); err != nil {
			return nil, err
		}

		items = append(items, response{
			"id":      id,
			"name":    nullString(name),
			"phone":   nullString(phone),
			"address": nullString(address),
		})
	}

	return items, rows.Err()
}

func queryPartPurchaseCreateParts(db *sql.DB) ([]response, error) {
	rows, err := db.Query(`
		SELECT p.id, p.name, p.part_number, p.buy_price, p.stock, p.status,
		       pc.id, pc.name
		FROM parts p
		LEFT JOIN part_categories pc ON pc.id = p.part_category_id
		WHERE p.deleted_at IS NULL
		ORDER BY p.name ASC
	`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	items := make([]response, 0)
	for rows.Next() {
		var id int64
		var name, partNumber, status sql.NullString
		var buyPrice, stock sql.NullInt64
		var categoryID sql.NullInt64
		var categoryName sql.NullString
		if err := rows.Scan(&id, &name, &partNumber, &buyPrice, &stock, &status, &categoryID, &categoryName); err != nil {
			return nil, err
		}

		part := response{
			"id":          id,
			"name":        nullString(name),
			"part_number": nullString(partNumber),
			"buy_price":   int64OrZero(buyPrice),
			"stock":       int64OrZero(stock),
			"status":      nullString(status),
			"category":    nil,
		}

		if categoryID.Valid {
			part["category"] = response{
				"id":   categoryID.Int64,
				"name": nullString(categoryName),
			}
		}

		items = append(items, part)
	}

	return items, rows.Err()
}

func queryPartPurchaseCreateCategories(db *sql.DB) ([]response, error) {
	rows, err := db.Query(`
		SELECT id, name
		FROM part_categories
		ORDER BY name ASC
	`)
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