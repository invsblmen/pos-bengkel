package httpserver

import (
	"crypto/rand"
	"database/sql"
	"encoding/json"
	"encoding/hex"
	"net/http"
	"strings"
	"time"
)

type serviceOrderStoreQuickIntakeRequest struct {
	CustomerName  string `json:"customer_name"`
	CustomerPhone string `json:"customer_phone"`
	PlateNumber   string `json:"plate_number"`
	VehicleBrand  string `json:"vehicle_brand"`
	VehicleModel  string `json:"vehicle_model"`
	OdometerKM    *int64 `json:"odometer_km"`
	Complaint     string `json:"complaint"`
	MechanicID    *int64 `json:"mechanic_id"`
	SubmitMode    string `json:"submit_mode"`
}

func serviceOrderStoreQuickIntakeHandler(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if db == nil {
			writeJSON(w, http.StatusServiceUnavailable, response{"message": "database is not configured"})
			return
		}

		var payload serviceOrderStoreQuickIntakeRequest
		if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
			writeJSON(w, http.StatusBadRequest, response{"message": "invalid json payload"})
			return
		}

		customerName := strings.TrimSpace(payload.CustomerName)
		customerPhone := strings.TrimSpace(payload.CustomerPhone)
		plateRaw := strings.TrimSpace(payload.PlateNumber)
		normalizedPlate := strings.ToUpper(strings.ReplaceAll(plateRaw, " ", ""))
		submitMode := strings.TrimSpace(payload.SubmitMode)
		if submitMode == "" {
			submitMode = "view_detail"
		}

		errors := response{}
		if customerName == "" {
			errors["customer_name"] = []string{"Nama pelanggan wajib diisi."}
		}
		if customerPhone == "" {
			errors["customer_phone"] = []string{"Nomor telepon pelanggan wajib diisi."}
		}
		if normalizedPlate == "" {
			errors["plate_number"] = []string{"Nomor polisi wajib diisi."}
		}
		if payload.OdometerKM == nil || *payload.OdometerKM < 0 {
			errors["odometer_km"] = []string{"Odometer (km) wajib diisi dengan nilai valid."}
		}
		if submitMode != "view_detail" && submitMode != "create_again" {
			errors["submit_mode"] = []string{"Mode submit tidak valid."}
		}
		if payload.MechanicID != nil && *payload.MechanicID > 0 {
			if ok, err := recordExists(db, "mechanics", *payload.MechanicID); err != nil {
				writeJSON(w, http.StatusInternalServerError, response{"message": "failed to validate mechanic"})
				return
			} else if !ok {
				errors["mechanic_id"] = []string{"Mekanik tidak ditemukan."}
			}
		}

		if len(errors) > 0 {
			writeJSON(w, http.StatusUnprocessableEntity, response{
				"message": "The given data was invalid.",
				"errors":  errors,
			})
			return
		}

		tx, err := db.BeginTx(r.Context(), nil)
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, response{"message": "failed to start transaction"})
			return
		}
		defer func() { _ = tx.Rollback() }()

		var (
			vehicleID         int64
			vehicleCustomerID sql.NullInt64
			vehicleBrand      sql.NullString
			vehicleModel      sql.NullString
		)

		err = tx.QueryRow(`
			SELECT id, customer_id, brand, model
			FROM vehicles
			WHERE REPLACE(UPPER(plate_number), ' ', '') = ?
			LIMIT 1
		`, normalizedPlate).Scan(&vehicleID, &vehicleCustomerID, &vehicleBrand, &vehicleModel)

		if err != nil && err != sql.ErrNoRows {
			writeJSON(w, http.StatusInternalServerError, response{"message": "failed to read vehicle"})
			return
		}

		var customerID int64
		if err == sql.ErrNoRows {
			insertCustomer, err := tx.Exec(`
				INSERT INTO customers (name, phone, created_at, updated_at)
				VALUES (?, ?, ?, ?)
			`, customerName, customerPhone, time.Now(), time.Now())
			if err != nil {
				writeJSON(w, http.StatusInternalServerError, response{"message": "failed to create customer"})
				return
			}

			customerID, err = insertCustomer.LastInsertId()
			if err != nil {
				writeJSON(w, http.StatusInternalServerError, response{"message": "failed to read customer id"})
				return
			}

			insertVehicle, err := tx.Exec(`
				INSERT INTO vehicles (customer_id, plate_number, brand, model, created_at, updated_at)
				VALUES (?, ?, ?, ?, ?, ?)
			`, customerID, normalizedPlate, serviceOrderQuickIntakeStringOrNil(payload.VehicleBrand), serviceOrderQuickIntakeStringOrNil(payload.VehicleModel), time.Now(), time.Now())
			if err != nil {
				writeJSON(w, http.StatusInternalServerError, response{"message": "failed to create vehicle"})
				return
			}

			vehicleID, err = insertVehicle.LastInsertId()
			if err != nil {
				writeJSON(w, http.StatusInternalServerError, response{"message": "failed to read vehicle id"})
				return
			}
		} else {
			if vehicleCustomerID.Valid && vehicleCustomerID.Int64 > 0 {
				customerID = vehicleCustomerID.Int64
				if _, err := tx.Exec(`
					UPDATE customers
					SET name = ?, phone = ?, updated_at = ?
					WHERE id = ?
				`, customerName, customerPhone, time.Now(), customerID); err != nil {
					writeJSON(w, http.StatusInternalServerError, response{"message": "failed to update customer"})
					return
				}
			} else {
				insertCustomer, err := tx.Exec(`
					INSERT INTO customers (name, phone, created_at, updated_at)
					VALUES (?, ?, ?, ?)
				`, customerName, customerPhone, time.Now(), time.Now())
				if err != nil {
					writeJSON(w, http.StatusInternalServerError, response{"message": "failed to create customer"})
					return
				}

				customerID, err = insertCustomer.LastInsertId()
				if err != nil {
					writeJSON(w, http.StatusInternalServerError, response{"message": "failed to read customer id"})
					return
				}

				if _, err := tx.Exec(`UPDATE vehicles SET customer_id = ?, updated_at = ? WHERE id = ?`, customerID, time.Now(), vehicleID); err != nil {
					writeJSON(w, http.StatusInternalServerError, response{"message": "failed to attach customer to vehicle"})
					return
				}
			}

			if strings.TrimSpace(payload.VehicleBrand) != "" || strings.TrimSpace(payload.VehicleModel) != "" {
				brandValue := vehicleBrand.String
				if strings.TrimSpace(payload.VehicleBrand) != "" {
					brandValue = strings.TrimSpace(payload.VehicleBrand)
				}
				modelValue := vehicleModel.String
				if strings.TrimSpace(payload.VehicleModel) != "" {
					modelValue = strings.TrimSpace(payload.VehicleModel)
				}

				if _, err := tx.Exec(`
					UPDATE vehicles
					SET brand = ?, model = ?, updated_at = ?
					WHERE id = ?
				`, serviceOrderQuickIntakeStringOrNil(brandValue), serviceOrderQuickIntakeStringOrNil(modelValue), time.Now(), vehicleID); err != nil {
					writeJSON(w, http.StatusInternalServerError, response{"message": "failed to update vehicle"})
					return
				}
			}
		}

		orderNumber := "SO-" + strings.ToUpper(randomHex8())
		insertOrder, err := tx.Exec(`
			INSERT INTO service_orders (
				order_number, customer_id, vehicle_id, mechanic_id,
				status, odometer_km, estimated_start_at, estimated_finish_at,
				notes, total,
				discount_type, discount_value,
				tax_type, tax_value,
				voucher_id, voucher_code, voucher_discount_amount,
				labor_cost, material_cost, grand_total,
				created_at, updated_at
			)
			VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
		`, orderNumber, customerID, vehicleID, payload.MechanicID, "pending", payload.OdometerKM, time.Now(), time.Now(), serviceOrderQuickIntakeStringOrNil(payload.Complaint), 0, "none", 0, "none", 0, nil, nil, 0, 0, 0, 0, time.Now(), time.Now())
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, response{"message": "failed to create service order"})
			return
		}

		orderID, err := insertOrder.LastInsertId()
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, response{"message": "failed to read order id"})
			return
		}

		if err := tx.Commit(); err != nil {
			writeJSON(w, http.StatusInternalServerError, response{"message": "failed to commit quick intake"})
			return
		}

		writeJSON(w, http.StatusOK, response{
			"message":     "Penerimaan konsumen berhasil dibuat.",
			"order_id":    orderID,
			"submit_mode": submitMode,
			"order": response{
				"id":          orderID,
				"order_number": orderNumber,
				"status":      "pending",
				"customer_id": customerID,
				"vehicle_id":  vehicleID,
			},
		})
	}
}

func serviceOrderQuickIntakeStringOrNil(value string) any {
	trimmed := strings.TrimSpace(value)
	if trimmed == "" {
		return nil
	}
	return trimmed
}

func randomHex8() string {
	buf := make([]byte, 4)
	if _, err := rand.Read(buf); err != nil {
		return strings.ToUpper(time.Now().Format("150405"))
	}
	return strings.ToUpper(hex.EncodeToString(buf))
}
