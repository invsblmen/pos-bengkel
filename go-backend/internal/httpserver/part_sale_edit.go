package httpserver

import (
	"database/sql"
	"net/http"
	"strings"
)

func partSaleEditHandler(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if db == nil {
			writeJSON(w, http.StatusServiceUnavailable, response{"message": "database is not configured"})
			return
		}

		partSaleID := strings.TrimSpace(r.PathValue("id"))
		if partSaleID == "" {
			writeJSON(w, http.StatusBadRequest, response{"message": "part sale id is required"})
			return
		}

		partSaleIntID := parseInt64WithDefault(partSaleID)
		if partSaleIntID <= 0 {
			writeJSON(w, http.StatusBadRequest, response{"message": "part sale id is required"})
			return
		}

		sale, err := queryPartSaleShowSale(db, partSaleIntID)
		if err == sql.ErrNoRows {
			writeJSON(w, http.StatusNotFound, response{"message": "Part sale not found."})
			return
		}
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, response{"message": "failed to read part sale"})
			return
		}

		if strings.TrimSpace(anyToString(sale["status"])) != "draft" {
			writeJSON(w, http.StatusUnprocessableEntity, response{
				"message": "The given data was invalid.",
				"errors": response{
					"error": []string{"Hanya penjualan draft yang bisa diedit"},
				},
			})
			return
		}

		details, err := queryPartSaleEditDetails(db, partSaleIntID)
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, response{"message": "failed to read part sale details"})
			return
		}
		sale["details"] = details

		customers, err := queryPartSaleEditCustomers(db)
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, response{"message": "failed to read customers"})
			return
		}

		parts, err := queryPartSaleEditParts(db)
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, response{"message": "failed to read parts"})
			return
		}

		vouchers, err := queryPartSaleEditVouchers(db)
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, response{"message": "failed to read vouchers"})
			return
		}

		writeJSON(w, http.StatusOK, response{
			"sale":              sale,
			"customers":         customers,
			"parts":             parts,
			"availableVouchers": vouchers,
		})
	}
}

func queryPartSaleEditDetails(db *sql.DB, partSaleID int64) ([]response, error) {
	const q = `
		SELECT d.id,
		       d.part_id,
		       d.quantity,
		       d.unit_price,
		       COALESCE(d.discount_type, 'none'),
		       COALESCE(d.discount_value, 0),
		       COALESCE(d.warranty_period_days, 0),
		       p.id,
		       p.name,
		       p.part_number
		FROM part_sale_details d
		LEFT JOIN parts p ON p.id = d.part_id
		WHERE d.part_sale_id = ?
		ORDER BY d.id ASC
	`

	rows, err := db.Query(q, partSaleID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	items := make([]response, 0)
	for rows.Next() {
		var id int64
		var partID sql.NullInt64
		var quantity sql.NullInt64
		var unitPrice sql.NullInt64
		var discountType sql.NullString
		var discountValue sql.NullFloat64
		var warrantyDays sql.NullInt64
		var nestedPartID sql.NullInt64
		var partName sql.NullString
		var partNumber sql.NullString

		if err := rows.Scan(
			&id,
			&partID,
			&quantity,
			&unitPrice,
			&discountType,
			&discountValue,
			&warrantyDays,
			&nestedPartID,
			&partName,
			&partNumber,
		); err != nil {
			return nil, err
		}

		item := response{
			"id":                   id,
			"part_id":              int64OrZero(partID),
			"quantity":             int64OrZero(quantity),
			"unit_price":           int64OrZero(unitPrice),
			"discount_type":        nullStringValue(discountType),
			"discount_value":       float64OrZero(discountValue),
			"warranty_period_days": int64OrZero(warrantyDays),
			"part":                 nil,
		}

		if nestedPartID.Valid {
			item["part"] = response{
				"id":          nestedPartID.Int64,
				"name":        nullString(partName),
				"part_number": nullString(partNumber),
			}
		}

		items = append(items, item)
	}

	return items, rows.Err()
}

func queryPartSaleEditCustomers(db *sql.DB) ([]response, error) {
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
		items = append(items, response{
			"id":   int64OrZero(id),
			"name": nullString(name),
		})
	}

	return items, rows.Err()
}

func queryPartSaleEditParts(db *sql.DB) ([]response, error) {
	rows, err := db.Query(`
		SELECT id, name, part_number, COALESCE(sell_price, 0), COALESCE(stock, 0)
		FROM parts
		ORDER BY name ASC
	`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	items := make([]response, 0)
	for rows.Next() {
		var id sql.NullInt64
		var name sql.NullString
		var partNumber sql.NullString
		var sellPrice sql.NullInt64
		var stock sql.NullInt64
		if err := rows.Scan(&id, &name, &partNumber, &sellPrice, &stock); err != nil {
			return nil, err
		}
		items = append(items, response{
			"id":          int64OrZero(id),
			"name":        nullString(name),
			"part_number": nullString(partNumber),
			"sell_price":  int64OrZero(sellPrice),
			"stock":       int64OrZero(stock),
		})
	}

	return items, rows.Err()
}

func queryPartSaleEditVouchers(db *sql.DB) ([]response, error) {
	rows, err := db.Query(`
		SELECT id, code, name, scope
		FROM vouchers
		WHERE is_active = 1
		ORDER BY code ASC
	`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	items := make([]response, 0)
	for rows.Next() {
		var id sql.NullInt64
		var code sql.NullString
		var name sql.NullString
		var scope sql.NullString
		if err := rows.Scan(&id, &code, &name, &scope); err != nil {
			return nil, err
		}
		items = append(items, response{
			"id":    int64OrZero(id),
			"code":  nullString(code),
			"name":  nullString(name),
			"scope": nullString(scope),
		})
	}

	return items, rows.Err()
}

func anyToString(v any) string {
	if s, ok := v.(string); ok {
		return s
	}
	return ""
}
