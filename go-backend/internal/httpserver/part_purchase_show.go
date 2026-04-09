package httpserver

import (
	"database/sql"
	"net/http"
	"strings"
)

func partPurchaseShowHandler(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if db == nil {
			writeJSON(w, http.StatusServiceUnavailable, response{"message": "database is not configured"})
			return
		}

		purchaseID := strings.TrimSpace(r.PathValue("id"))
		if purchaseID == "" {
			writeJSON(w, http.StatusBadRequest, response{"message": "part purchase id is required"})
			return
		}

		purchaseIntID := parseInt64WithDefault(purchaseID)
		if purchaseIntID <= 0 {
			writeJSON(w, http.StatusBadRequest, response{"message": "part purchase id is required"})
			return
		}

		purchase, err := queryPartPurchaseShowPurchase(db, purchaseIntID)
		if err == sql.ErrNoRows {
			writeJSON(w, http.StatusNotFound, response{"message": "Part purchase not found."})
			return
		}
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, response{"message": "failed to read part purchase"})
			return
		}

		details, err := queryPartPurchaseShowDetails(db, purchaseIntID)
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, response{"message": "failed to read part purchase details"})
			return
		}

		purchase["details"] = details

		writeJSON(w, http.StatusOK, response{"purchase": purchase})
	}
}

func queryPartPurchaseShowPurchase(db *sql.DB, purchaseID int64) (response, error) {
	const q = `
		SELECT pp.id, pp.purchase_number,
		       DATE_FORMAT(pp.purchase_date, '%Y-%m-%d') AS purchase_date,
		       DATE_FORMAT(pp.expected_delivery_date, '%Y-%m-%d') AS expected_delivery_date,
		       DATE_FORMAT(pp.actual_delivery_date, '%Y-%m-%d') AS actual_delivery_date,
		       COALESCE(pp.status, 'pending'),
		       COALESCE(pp.total_amount, 0),
		       COALESCE(pp.notes, ''),
		       COALESCE(pp.discount_type, 'none'),
		       COALESCE(pp.discount_value, 0),
		       COALESCE(pp.discount_amount, 0),
		       COALESCE(pp.tax_type, 'none'),
		       COALESCE(pp.tax_value, 0),
		       COALESCE(pp.tax_amount, 0),
		       COALESCE(pp.grand_total, 0),
		       COALESCE(pp.unit_cost, 0),
		       COALESCE(pp.margin_type, 'percent'),
		       COALESCE(pp.margin_value, 0),
		       COALESCE(pp.promo_discount_type, 'none'),
		       COALESCE(pp.promo_discount_value, 0),
		       DATE_FORMAT(pp.created_at, '%Y-%m-%d %H:%i:%s') AS created_at,
		       DATE_FORMAT(pp.updated_at, '%Y-%m-%d %H:%i:%s') AS updated_at,
		       s.id, s.name, s.phone, s.address
		FROM part_purchases pp
		LEFT JOIN suppliers s ON s.id = pp.supplier_id
		WHERE pp.id = ?
		LIMIT 1
	`

	var id int64
	var purchaseNumber sql.NullString
	var purchaseDate sql.NullString
	var expectedDeliveryDate sql.NullString
	var actualDeliveryDate sql.NullString
	var status sql.NullString
	var totalAmount sql.NullInt64
	var notes sql.NullString
	var discountType sql.NullString
	var discountValue sql.NullFloat64
	var discountAmount sql.NullInt64
	var taxType sql.NullString
	var taxValue sql.NullFloat64
	var taxAmount sql.NullInt64
	var grandTotal sql.NullInt64
	var unitCost sql.NullInt64
	var marginType sql.NullString
	var marginValue sql.NullFloat64
	var promoDiscountType sql.NullString
	var promoDiscountValue sql.NullFloat64
	var createdAt sql.NullString
	var updatedAt sql.NullString
	var supplierID sql.NullInt64
	var supplierName sql.NullString
	var supplierPhone sql.NullString
	var supplierAddress sql.NullString

	err := db.QueryRow(q, purchaseID).Scan(
		&id,
		&purchaseNumber,
		&purchaseDate,
		&expectedDeliveryDate,
		&actualDeliveryDate,
		&status,
		&totalAmount,
		&notes,
		&discountType,
		&discountValue,
		&discountAmount,
		&taxType,
		&taxValue,
		&taxAmount,
		&grandTotal,
		&unitCost,
		&marginType,
		&marginValue,
		&promoDiscountType,
		&promoDiscountValue,
		&createdAt,
		&updatedAt,
		&supplierID,
		&supplierName,
		&supplierPhone,
		&supplierAddress,
	)
	if err != nil {
		return nil, err
	}

	purchase := response{
		"id":                     id,
		"purchase_number":        nullStringValue(purchaseNumber),
		"purchase_date":          nullStringValue(purchaseDate),
		"expected_delivery_date": nullString(expectedDeliveryDate),
		"actual_delivery_date":   nullString(actualDeliveryDate),
		"status":                 nullStringValue(status),
		"total_amount":           int64OrZero(totalAmount),
		"notes":                  nullString(notes),
		"discount_type":          nullStringValue(discountType),
		"discount_value":         partPurchaseShowFloat64OrZero(discountValue),
		"discount_amount":        int64OrZero(discountAmount),
		"tax_type":               nullStringValue(taxType),
		"tax_value":              partPurchaseShowFloat64OrZero(taxValue),
		"tax_amount":             int64OrZero(taxAmount),
		"grand_total":            int64OrZero(grandTotal),
		"unit_cost":              int64OrZero(unitCost),
		"margin_type":            nullStringValue(marginType),
		"margin_value":           partPurchaseShowFloat64OrZero(marginValue),
		"promo_discount_type":    nullStringValue(promoDiscountType),
		"promo_discount_value":   partPurchaseShowFloat64OrZero(promoDiscountValue),
		"created_at":             nullStringValue(createdAt),
		"updated_at":             nullStringValue(updatedAt),
		"supplier":               nil,
		"details":                nil,
	}

	if supplierID.Valid {
		purchase["supplier"] = response{
			"id":      supplierID.Int64,
			"name":    nullStringValue(supplierName),
			"phone":   nullString(supplierPhone),
			"address": nullString(supplierAddress),
		}
	}

	return purchase, nil
}

func queryPartPurchaseShowDetails(db *sql.DB, purchaseID int64) ([]response, error) {
	const q = `
		SELECT d.id, d.part_id, d.quantity, d.unit_price, d.subtotal,
		       COALESCE(d.discount_type, 'none'), COALESCE(d.discount_value, 0), COALESCE(d.discount_amount, 0), COALESCE(d.final_amount, 0),
		       COALESCE(d.margin_type, 'percent'), COALESCE(d.margin_value, 0), COALESCE(d.margin_amount, 0), COALESCE(d.normal_unit_price, 0),
		       COALESCE(d.promo_discount_type, 'none'), COALESCE(d.promo_discount_value, 0), COALESCE(d.promo_discount_amount, 0), COALESCE(d.selling_price, 0),
		       p.id, p.name, p.part_number,
		       pc.id, pc.name
		FROM part_purchase_details d
		LEFT JOIN parts p ON p.id = d.part_id
		LEFT JOIN part_categories pc ON pc.id = p.part_category_id
		WHERE d.part_purchase_id = ?
		ORDER BY d.id ASC
	`

	rows, err := db.Query(q, purchaseID)
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
		var subtotal sql.NullInt64
		var discountType sql.NullString
		var discountValue sql.NullFloat64
		var discountAmount sql.NullInt64
		var finalAmount sql.NullInt64
		var marginType sql.NullString
		var marginValue sql.NullFloat64
		var marginAmount sql.NullInt64
		var normalUnitPrice sql.NullInt64
		var promoDiscountType sql.NullString
		var promoDiscountValue sql.NullFloat64
		var promoDiscountAmount sql.NullInt64
		var sellingPrice sql.NullInt64
		var relatedPartID sql.NullInt64
		var partName sql.NullString
		var partNumber sql.NullString
		var categoryID sql.NullInt64
		var categoryName sql.NullString

		if err := rows.Scan(
			&id,
			&partID,
			&quantity,
			&unitPrice,
			&subtotal,
			&discountType,
			&discountValue,
			&discountAmount,
			&finalAmount,
			&marginType,
			&marginValue,
			&marginAmount,
			&normalUnitPrice,
			&promoDiscountType,
			&promoDiscountValue,
			&promoDiscountAmount,
			&sellingPrice,
			&relatedPartID,
			&partName,
			&partNumber,
			&categoryID,
			&categoryName,
		); err != nil {
			return nil, err
		}

		item := response{
			"id":                    id,
			"part_id":               nullInt(partID),
			"quantity":              int64OrZero(quantity),
			"unit_price":            int64OrZero(unitPrice),
			"subtotal":              int64OrZero(subtotal),
			"discount_type":         nullStringValue(discountType),
			"discount_value":        partPurchaseShowFloat64OrZero(discountValue),
			"discount_amount":       int64OrZero(discountAmount),
			"final_amount":          int64OrZero(finalAmount),
			"margin_type":           nullStringValue(marginType),
			"margin_value":          partPurchaseShowFloat64OrZero(marginValue),
			"margin_amount":         int64OrZero(marginAmount),
			"normal_unit_price":     int64OrZero(normalUnitPrice),
			"promo_discount_type":   nullStringValue(promoDiscountType),
			"promo_discount_value":  partPurchaseShowFloat64OrZero(promoDiscountValue),
			"promo_discount_amount": int64OrZero(promoDiscountAmount),
			"selling_price":         int64OrZero(sellingPrice),
			"part":                  nil,
		}

		if relatedPartID.Valid {
			part := response{
				"id":          relatedPartID.Int64,
				"name":        nullString(partName),
				"part_number": nullString(partNumber),
				"category":    nil,
			}

			if categoryID.Valid {
				part["category"] = response{
					"id":   categoryID.Int64,
					"name": nullString(categoryName),
				}
			}

			item["part"] = part
		}

		items = append(items, item)
	}

	return items, rows.Err()
}

func partPurchaseShowFloat64OrZero(value sql.NullFloat64) float64 {
	if !value.Valid {
		return 0
	}

	return value.Float64
}