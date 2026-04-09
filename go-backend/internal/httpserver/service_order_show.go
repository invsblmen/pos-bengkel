package httpserver

import (
	"database/sql"
	"net/http"
)

func serviceOrderShowHandler(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if db == nil {
			writeJSON(w, http.StatusServiceUnavailable, response{
				"error": "database not available",
			})
			return
		}

		id := r.PathValue("id")
		if id == "" {
			writeJSON(w, http.StatusBadRequest, response{"error": "id is required"})
			return
		}

		// Query order with all relationships
		order, err := queryServiceOrderShowOrder(db, id)
		if err != nil && err != sql.ErrNoRows {
			writeJSON(w, http.StatusInternalServerError, response{"error": "failed to fetch order"})
			return
		}

		if order == nil {
			writeJSON(w, http.StatusNotFound, response{"error": "order not found"})
			return
		}

		// Query warranty registrations for this order
		warrantyMap, err := queryServiceOrderShowWarrantyRegistrations(db, order["id"].(int64))
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, response{"error": "failed to fetch warranty registrations"})
			return
		}

		// Permissions are computed on client side or can be assumed for API consumers
		permissions := map[string]any{
			"can_view_customers": true,
			"can_view_vehicles":  true,
			"can_view_mechanics": true,
		}

		writeJSON(w, http.StatusOK, response{
			"order":                 order,
			"warrantyRegistrations": warrantyMap,
			"permissions":           permissions,
		})
	}
}

func queryServiceOrderShowOrder(db *sql.DB, id string) (map[string]any, error) {
	query := `
		SELECT
			so.id, so.order_number, so.customer_id, so.vehicle_id, so.mechanic_id,
			so.status, so.total, so.labor_cost, so.material_cost, so.created_at,
			so.odometer_km, so.estimated_start_at, so.estimated_finish_at,
			so.actual_start_at, so.actual_finish_at, so.warranty_period, so.notes,
			so.maintenance_type, so.next_service_km, so.next_service_date,
			so.discount_type, so.discount_value, so.discount_amount,
			so.voucher_id, so.voucher_code, so.voucher_discount_amount,
			so.tax_type, so.tax_value, so.tax_amount, so.grand_total,
			c.id as customer_id, c.name as customer_name, c.phone as customer_phone,
			v.id as vehicle_id, v.plate_number, v.brand, v.model, v.year, v.km,
			m.id as mechanic_id, m.name as mechanic_name
		FROM service_orders so
		LEFT JOIN customers c ON so.customer_id = c.id
		LEFT JOIN vehicles v ON so.vehicle_id = v.id
		LEFT JOIN mechanics m ON so.mechanic_id = m.id
		WHERE so.id = ? AND so.deleted_at IS NULL
	`

	var orderID int64
	var orderNumber, status, maintenanceType sql.NullString
	var totalVal, laborCost, materialCost, discountAmount, voucherID, voucherDiscAmount, taxAmount, grandTotal sql.NullInt64
	var createdAt, estimatedStart, estimatedFinish, actualStart, actualFinish, nextServiceDate sql.NullTime
	var odometerKM, warrantyPeriod, nextServiceKM sql.NullInt64
	var discountType, taxType, voucherCode, notes sql.NullString
	var discountValue, taxValue sql.NullFloat64

	var customerID, customerPhone sql.NullString
	var customerName sql.NullString
	var vehicleID sql.NullInt64
	var platNumber, brand, model, year, km sql.NullString
	var mechanicID sql.NullInt64
	var mechanicName sql.NullString

	err := db.QueryRow(query, id).Scan(
		&orderID, &orderNumber, &customerID, &vehicleID, &mechanicID,
		&status, &totalVal, &laborCost, &materialCost, &createdAt,
		&odometerKM, &estimatedStart, &estimatedFinish,
		&actualStart, &actualFinish, &warrantyPeriod, &notes,
		&maintenanceType, &nextServiceKM, &nextServiceDate,
		&discountType, &discountValue, &discountAmount,
		&voucherID, &voucherCode, &voucherDiscAmount,
		&taxType, &taxValue, &taxAmount, &grandTotal,
		&customerID, &customerName, &customerPhone,
		&vehicleID, &platNumber, &brand, &model, &year, &km,
		&mechanicID, &mechanicName,
	)

	if err == sql.ErrNoRows {
		return nil, nil
	}

	if err != nil {
		return nil, err
	}

	// Load details
	details, err := queryServiceOrderShowDetails(db, orderID)
	if err != nil {
		return nil, err
	}

	// Build order response
	order := map[string]any{
		"id":               orderID,
		"order_number":     orderNumber.String,
		"status":           status.String,
		"total":            totalVal.Int64,
		"labor_cost":       laborCost.Int64,
		"material_cost":    materialCost.Int64,
		"odometer_km":      odometerKM.Int64,
		"warranty_period":  warrantyPeriod.Int64,
		"notes":            notes.String,
		"maintenance_type": maintenanceType.String,
		"next_service_km":  nextServiceKM.Int64,
		"next_service_date": func() string {
			if nextServiceDate.Valid {
				return nextServiceDate.Time.Format("2006-01-02")
			}
			return ""
		}(),
		"discount_type":           discountType.String,
		"discount_value":          discountValue.Float64,
		"discount_amount":         discountAmount.Int64,
		"voucher_id":              voucherID.Int64,
		"voucher_code":            voucherCode.String,
		"voucher_discount_amount": voucherDiscAmount.Int64,
		"tax_type":                taxType.String,
		"tax_value":               taxValue.Float64,
		"tax_amount":              taxAmount.Int64,
		"grand_total":             grandTotal.Int64,
		"created_at": func() string {
			if createdAt.Valid {
				return createdAt.Time.Format("2006-01-02T15:04:05-07:00")
			}
			return ""
		}(),
		"estimated_start_at": func() string {
			if estimatedStart.Valid {
				return estimatedStart.Time.Format("2006-01-02T15:04:05-07:00")
			}
			return ""
		}(),
		"estimated_finish_at": func() string {
			if estimatedFinish.Valid {
				return estimatedFinish.Time.Format("2006-01-02T15:04:05-07:00")
			}
			return ""
		}(),
		"actual_start_at": func() string {
			if actualStart.Valid {
				return actualStart.Time.Format("2006-01-02T15:04:05-07:00")
			}
			return ""
		}(),
		"actual_finish_at": func() string {
			if actualFinish.Valid {
				return actualFinish.Time.Format("2006-01-02T15:04:05-07:00")
			}
			return ""
		}(),
		"customer": func() map[string]any {
			if customerID.Valid {
				return map[string]any{
					"id":    customerID.String,
					"name":  customerName.String,
					"phone": customerPhone.String,
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
					"year":         year.String,
					"km":           km.String,
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
	}

	return order, nil
}

func queryServiceOrderShowDetails(db *sql.DB, orderID int64) ([]map[string]any, error) {
	var details []map[string]any

	query := `
		SELECT
			sod.id, sod.service_id, sod.part_id, sod.qty, sod.price, sod.amount, sod.final_amount,
			s.id as service_id, s.name as service_name, s.description as service_desc, s.price as service_price,
			p.id as part_id, p.name as part_name, p.part_number
		FROM service_order_details sod
		LEFT JOIN services s ON sod.service_id = s.id
		LEFT JOIN parts p ON sod.part_id = p.id
		WHERE sod.service_order_id = ?
		ORDER BY sod.id ASC
	`

	rows, err := db.Query(query, orderID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	for rows.Next() {
		var id, qty, price, amount, finalAmount sql.NullInt64
		var serviceID, servicePrice, partID sql.NullInt64
		var serviceName, serviceDesc, partName, partNumber sql.NullString

		if err := rows.Scan(
			&id, &serviceID, &partID, &qty, &price, &amount, &finalAmount,
			&serviceID, &serviceName, &serviceDesc, &servicePrice,
			&partID, &partName, &partNumber,
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

		if serviceID.Valid {
			detail["service"] = map[string]any{
				"id":          serviceID.Int64,
				"name":        serviceName.String,
				"description": serviceDesc.String,
				"price":       servicePrice.Int64,
			}
		}

		if partID.Valid {
			detail["part"] = map[string]any{
				"id":          partID.Int64,
				"name":        partName.String,
				"part_number": partNumber.String,
			}
		}

		details = append(details, detail)
	}

	if details == nil {
		details = []map[string]any{}
	}

	return details, rows.Err()
}

func queryServiceOrderShowWarrantyRegistrations(db *sql.DB, orderID int64) (map[int64]map[string]any, error) {
	warrantyMap := make(map[int64]map[string]any)

	query := `
		SELECT
			id, source_detail_id, warranty_period_days,
			warranty_start_date, warranty_end_date, status, claimed_at, claim_notes
		FROM warranty_registrations
		WHERE source_type = ? AND source_id = ?
		ORDER BY source_detail_id ASC
	`

	rows, err := db.Query(query, "App\\Models\\ServiceOrder", orderID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	for rows.Next() {
		var id, sourceDetailID, periodDays sql.NullInt64
		var warrantyStart, warrantyEnd, claimedAt sql.NullTime
		var status, claimNotes sql.NullString

		if err := rows.Scan(
			&id, &sourceDetailID, &periodDays,
			&warrantyStart, &warrantyEnd, &status, &claimedAt, &claimNotes,
		); err != nil {
			return nil, err
		}

		warranty := map[string]any{
			"id":                   id.Int64,
			"status":               status.String,
			"warranty_period_days": periodDays.Int64,
			"warranty_start_date": func() string {
				if warrantyStart.Valid {
					return warrantyStart.Time.Format("2006-01-02")
				}
				return ""
			}(),
			"warranty_end_date": func() string {
				if warrantyEnd.Valid {
					return warrantyEnd.Time.Format("2006-01-02")
				}
				return ""
			}(),
			"claimed_at": func() string {
				if claimedAt.Valid {
					return claimedAt.Time.Format("2006-01-02T15:04:05-07:00")
				}
				return ""
			}(),
			"claim_notes": claimNotes.String,
		}

		if sourceDetailID.Valid {
			warrantyMap[sourceDetailID.Int64] = warranty
		}
	}

	return warrantyMap, rows.Err()
}
