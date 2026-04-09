package httpserver

import (
	"database/sql"
	"encoding/json"
	"net/http"
	"regexp"
	"strings"
	"time"
)

var vehicleStorePlateRegexp = regexp.MustCompile(`^[A-Z0-9]{1,20}$`)

type vehicleStoreRequest struct {
	CustomerID       int64          `json:"customer_id"`
	PlateNumber      string         `json:"plate_number"`
	Brand            string         `json:"brand"`
	Model            string         `json:"model"`
	Year             *int64         `json:"year"`
	Color            string         `json:"color"`
	EngineType       string         `json:"engine_type"`
	TransmissionType string         `json:"transmission_type"`
	CylinderVolume   *int64         `json:"cylinder_volume"`
	Features         []any          `json:"features"`
	Notes            string         `json:"notes"`
	ChassisNumber    string         `json:"chassis_number"`
	EngineNumber     string         `json:"engine_number"`
	ManufactureYear  *int64         `json:"manufacture_year"`
	RegistrationNo   string         `json:"registration_number"`
	RegistrationDate *vehicleGoDate `json:"registration_date"`
	StnkExpiryDate   *vehicleGoDate `json:"stnk_expiry_date"`
	PreviousOwner    string         `json:"previous_owner"`
}

type vehicleGoDate struct {
	time.Time
}

func (d *vehicleGoDate) UnmarshalJSON(data []byte) error {
	value := strings.TrimSpace(string(data))
	if value == "null" || value == `""` || value == "" {
		return nil
	}

	parsed, err := time.Parse(`"2006-01-02"`, value)
	if err != nil {
		return err
	}

	d.Time = parsed
	return nil
}

func vehicleStoreHandler(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if db == nil {
			writeJSON(w, http.StatusServiceUnavailable, response{"message": "database is not configured"})
			return
		}

		var payload vehicleStoreRequest
		if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
			writeJSON(w, http.StatusBadRequest, response{"message": "invalid json payload"})
			return
		}

		plateNumber := strings.ToUpper(strings.ReplaceAll(strings.TrimSpace(payload.PlateNumber), " ", ""))
		brand := strings.TrimSpace(payload.Brand)
		model := strings.TrimSpace(payload.Model)

		if payload.CustomerID <= 0 {
			writeJSON(w, http.StatusUnprocessableEntity, response{
				"message": "The given data was invalid.",
				"errors": response{
					"customer_id": []string{"Pelanggan wajib diisi."},
				},
			})
			return
		}

		if plateNumber == "" || !vehicleStorePlateRegexp.MatchString(plateNumber) {
			writeJSON(w, http.StatusUnprocessableEntity, response{
				"message": "The given data was invalid.",
				"errors": response{
					"plate_number": []string{"Nomor plat hanya boleh berisi huruf dan angka (tanpa spasi)."},
				},
			})
			return
		}

		if brand == "" || model == "" {
			writeJSON(w, http.StatusUnprocessableEntity, response{
				"message": "The given data was invalid.",
				"errors": response{
					"brand": []string{"Merek dan model wajib diisi."},
				},
			})
			return
		}

		customerExists, err := recordExists(db, "customers", payload.CustomerID)
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, response{"message": "failed to read customer"})
			return
		}
		if !customerExists {
			writeJSON(w, http.StatusUnprocessableEntity, response{
				"message": "The given data was invalid.",
				"errors": response{
					"customer_id": []string{"Pelanggan tidak ditemukan."},
				},
			})
			return
		}

		isPlateUsed, err := vehicleStorePlateExists(db, plateNumber)
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, response{"message": "failed to validate plate number"})
			return
		}
		if isPlateUsed {
			writeJSON(w, http.StatusUnprocessableEntity, response{
				"message": "The given data was invalid.",
				"errors": response{
					"plate_number": []string{"Nomor plat sudah digunakan."},
				},
			})
			return
		}

		featuresJSON, err := json.Marshal(payload.Features)
		if err != nil {
			writeJSON(w, http.StatusUnprocessableEntity, response{
				"message": "The given data was invalid.",
				"errors": response{
					"features": []string{"Format fitur tidak valid."},
				},
			})
			return
		}

		now := time.Now()
		res, err := db.Exec(`
			INSERT INTO vehicles (
				customer_id, plate_number, brand, model, year, color, engine_type, transmission_type,
				cylinder_volume, features, notes, chassis_number, engine_number, manufacture_year,
				registration_number, registration_date, stnk_expiry_date, previous_owner, created_at, updated_at
			) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
		`,
			payload.CustomerID,
			plateNumber,
			brand,
			model,
			vehicleStoreNullableInt(payload.Year),
			vehicleStoreNullableString(payload.Color),
			vehicleStoreNullableString(payload.EngineType),
			vehicleStoreNullableString(payload.TransmissionType),
			vehicleStoreNullableInt(payload.CylinderVolume),
			vehicleStoreNullableJSON(featuresJSON),
			vehicleStoreNullableString(payload.Notes),
			vehicleStoreNullableString(payload.ChassisNumber),
			vehicleStoreNullableString(payload.EngineNumber),
			vehicleStoreNullableInt(payload.ManufactureYear),
			vehicleStoreNullableString(payload.RegistrationNo),
			vehicleStoreNullableDate(payload.RegistrationDate),
			vehicleStoreNullableDate(payload.StnkExpiryDate),
			vehicleStoreNullableString(payload.PreviousOwner),
			now,
			now,
		)
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, response{"message": "failed to create vehicle"})
			return
		}

		id, err := res.LastInsertId()
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, response{"message": "failed to read created vehicle id"})
			return
		}

		writeJSON(w, http.StatusOK, response{
			"message": "Kendaraan berhasil ditambahkan!",
			"vehicle": response{
				"id":                id,
				"customer_id":       payload.CustomerID,
				"plate_number":      plateNumber,
				"brand":             brand,
				"model":             model,
				"year":              vehicleStoreNullableInt(payload.Year),
				"color":             vehicleStoreNullableString(payload.Color),
				"engine_type":       vehicleStoreNullableString(payload.EngineType),
				"transmission_type": vehicleStoreNullableString(payload.TransmissionType),
				"cylinder_volume":   vehicleStoreNullableInt(payload.CylinderVolume),
				"features":          payload.Features,
				"notes":             vehicleStoreNullableString(payload.Notes),
			},
		})
	}
}

func vehicleStorePlateExists(db *sql.DB, plateNumber string) (bool, error) {
	var id int64
	err := db.QueryRow(`SELECT id FROM vehicles WHERE plate_number = ? LIMIT 1`, plateNumber).Scan(&id)
	if err == sql.ErrNoRows {
		return false, nil
	}
	if err != nil {
		return false, err
	}
	return true, nil
}

func vehicleStoreNullableString(value string) any {
	trimmed := strings.TrimSpace(value)
	if trimmed == "" {
		return nil
	}
	return trimmed
}

func vehicleStoreNullableInt(value *int64) any {
	if value == nil {
		return nil
	}
	return *value
}

func vehicleStoreNullableDate(value *vehicleGoDate) any {
	if value == nil || value.Time.IsZero() {
		return nil
	}
	return value.Time.Format("2006-01-02")
}

func vehicleStoreNullableJSON(raw []byte) any {
	if len(raw) == 0 || string(raw) == "null" {
		return nil
	}
	return string(raw)
}
