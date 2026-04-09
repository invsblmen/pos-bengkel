package httpserver

import (
	"database/sql"
	"net/http"
	"strings"
)

func partSaleShowHandler(db *sql.DB) http.HandlerFunc {
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

		details, err := queryPartSaleShowDetails(db, partSaleIntID)
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, response{"message": "failed to read part sale details"})
			return
		}
		sale["details"] = details

		businessProfile, err := queryPartSaleShowBusinessProfile(db)
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, response{"message": "failed to read business profile"})
			return
		}

		cashDenominations, err := queryPartSaleShowCashDenominations(db)
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, response{"message": "failed to read cash denominations"})
			return
		}

		writeJSON(w, http.StatusOK, response{
			"sale":              sale,
			"businessProfile":   businessProfile,
			"cashDenominations": cashDenominations,
		})
	}
}

func queryPartSaleShowSale(db *sql.DB, partSaleID int64) (response, error) {
	const q = `
		SELECT ps.id, ps.sale_number,
		       DATE_FORMAT(ps.sale_date, '%Y-%m-%d') AS sale_date,
		       COALESCE(ps.subtotal, 0),
		       COALESCE(ps.discount_amount, 0),
		       COALESCE(ps.voucher_code, ''),
		       COALESCE(ps.voucher_discount_amount, 0),
		       COALESCE(ps.tax_amount, 0),
		       COALESCE(ps.grand_total, 0),
		       COALESCE(ps.paid_amount, 0),
		       COALESCE(ps.remaining_amount, 0),
		       COALESCE(ps.status, 'draft'),
		       COALESCE(ps.payment_status, 'unpaid'),
		       COALESCE(ps.notes, ''),
		       DATE_FORMAT(ps.created_at, '%Y-%m-%d %H:%i:%s') AS created_at,
		       c.id, c.name,
		       u.id, u.name
		FROM part_sales ps
		LEFT JOIN customers c ON c.id = ps.customer_id
		LEFT JOIN users u ON u.id = ps.created_by
		WHERE ps.id = ?
		LIMIT 1
	`

	var id int64
	var saleNumber sql.NullString
	var saleDate sql.NullString
	var subtotal sql.NullInt64
	var discountAmount sql.NullInt64
	var voucherCode sql.NullString
	var voucherDiscountAmount sql.NullInt64
	var taxAmount sql.NullInt64
	var grandTotal sql.NullInt64
	var paidAmount sql.NullInt64
	var remainingAmount sql.NullInt64
	var status sql.NullString
	var paymentStatus sql.NullString
	var notes sql.NullString
	var createdAt sql.NullString
	var customerID sql.NullInt64
	var customerName sql.NullString
	var creatorID sql.NullInt64
	var creatorName sql.NullString

	err := db.QueryRow(q, partSaleID).Scan(
		&id,
		&saleNumber,
		&saleDate,
		&subtotal,
		&discountAmount,
		&voucherCode,
		&voucherDiscountAmount,
		&taxAmount,
		&grandTotal,
		&paidAmount,
		&remainingAmount,
		&status,
		&paymentStatus,
		&notes,
		&createdAt,
		&customerID,
		&customerName,
		&creatorID,
		&creatorName,
	)
	if err != nil {
		return nil, err
	}

	sale := response{
		"id":                      id,
		"sale_number":             nullStringValue(saleNumber),
		"sale_date":               nullStringValue(saleDate),
		"subtotal":                int64OrZero(subtotal),
		"discount_amount":         int64OrZero(discountAmount),
		"voucher_code":            nullString(voucherCode),
		"voucher_discount_amount": int64OrZero(voucherDiscountAmount),
		"tax_amount":              int64OrZero(taxAmount),
		"grand_total":             int64OrZero(grandTotal),
		"paid_amount":             int64OrZero(paidAmount),
		"remaining_amount":        int64OrZero(remainingAmount),
		"status":                  nullStringValue(status),
		"payment_status":          nullStringValue(paymentStatus),
		"notes":                   nullString(notes),
		"created_at":              nullStringValue(createdAt),
		"customer":                nil,
		"creator":                 nil,
	}

	if customerID.Valid {
		sale["customer"] = response{
			"id":   customerID.Int64,
			"name": nullString(customerName),
		}
	}

	if creatorID.Valid {
		sale["creator"] = response{
			"id":   creatorID.Int64,
			"name": nullString(creatorName),
		}
	}

	return sale, nil
}

func queryPartSaleShowDetails(db *sql.DB, partSaleID int64) ([]response, error) {
	const q = `
		SELECT d.id, d.quantity, d.unit_price,
		       COALESCE(d.discount_amount, 0),
		       COALESCE(d.final_amount, 0),
		       COALESCE(d.warranty_period_days, 0),
		       DATE_FORMAT(d.warranty_end_date, '%Y-%m-%d') AS warranty_end_date,
		       DATE_FORMAT(d.warranty_claimed_at, '%Y-%m-%d %H:%i:%s') AS warranty_claimed_at,
		       p.id, p.name, p.part_number
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
		var quantity sql.NullInt64
		var unitPrice sql.NullInt64
		var discountAmount sql.NullInt64
		var finalAmount sql.NullInt64
		var warrantyPeriodDays sql.NullInt64
		var warrantyEndDate sql.NullString
		var warrantyClaimedAt sql.NullString
		var partID sql.NullInt64
		var partName sql.NullString
		var partNumber sql.NullString

		if err := rows.Scan(
			&id,
			&quantity,
			&unitPrice,
			&discountAmount,
			&finalAmount,
			&warrantyPeriodDays,
			&warrantyEndDate,
			&warrantyClaimedAt,
			&partID,
			&partName,
			&partNumber,
		); err != nil {
			return nil, err
		}

		item := response{
			"id":                   id,
			"quantity":             int64OrZero(quantity),
			"unit_price":           int64OrZero(unitPrice),
			"discount_amount":      int64OrZero(discountAmount),
			"final_amount":         int64OrZero(finalAmount),
			"warranty_period_days": int64OrZero(warrantyPeriodDays),
			"warranty_end_date":    stringOrNil(warrantyEndDate),
			"warranty_claimed_at":  stringOrNil(warrantyClaimedAt),
			"part":                 nil,
		}

		if partID.Valid {
			item["part"] = response{
				"id":          partID.Int64,
				"name":        nullString(partName),
				"part_number": nullString(partNumber),
			}
		}

		items = append(items, item)
	}

	return items, rows.Err()
}

func queryPartSaleShowBusinessProfile(db *sql.DB) (response, error) {
	const q = `
		SELECT business_name, business_phone, business_address
		FROM business_profiles
		ORDER BY id ASC
		LIMIT 1
	`

	var businessName sql.NullString
	var businessPhone sql.NullString
	var businessAddress sql.NullString
	err := db.QueryRow(q).Scan(&businessName, &businessPhone, &businessAddress)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}

	return response{
		"business_name":    nullString(businessName),
		"business_phone":   nullString(businessPhone),
		"business_address": nullString(businessAddress),
	}, nil
}

func queryPartSaleShowCashDenominations(db *sql.DB) ([]response, error) {
	const q = `
		SELECT cd.id, cd.value, COALESCE(cdd.quantity, 0) AS quantity
		FROM cash_denominations cd
		LEFT JOIN cash_drawer_denominations cdd ON cdd.denomination_id = cd.id
		WHERE cd.is_active = 1
		ORDER BY cd.value ASC
	`

	rows, err := db.Query(q)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	items := make([]response, 0)
	for rows.Next() {
		var id sql.NullInt64
		var value sql.NullInt64
		var quantity sql.NullInt64
		if err := rows.Scan(&id, &value, &quantity); err != nil {
			return nil, err
		}

		items = append(items, response{
			"id":       int64OrZero(id),
			"value":    int64OrZero(value),
			"quantity": int64OrZero(quantity),
		})
	}

	return items, rows.Err()
}
