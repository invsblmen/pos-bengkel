package httpserver

import (
	"database/sql"
	"encoding/json"
	"net/http"
	"strings"
	"time"
)

type vehicleUpdateRequest struct {
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

func vehicleUpdateHandler(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if db == nil {
			writeJSON(w, http.StatusServiceUnavailable, response{"message": "database is not configured"})
			return
		}

		id := strings.TrimSpace(r.PathValue("id"))
		if id == "" {
			writeJSON(w, http.StatusBadRequest, response{"message": "vehicle id is required"})
			return
		}

		vehicleID := parseInt64WithDefault(id)
		if vehicleID <= 0 {
			writeJSON(w, http.StatusBadRequest, response{"message": "vehicle id is required"})
			return
		}

		if ok, err := recordExists(db, "vehicles", vehicleID); err != nil {
			writeJSON(w, http.StatusInternalServerError, response{"message": "failed to read vehicle"})
			return
		} else if !ok {
			writeJSON(w, http.StatusNotFound, response{"message": "vehicle not found"})
			return
		}

		var payload vehicleUpdateRequest
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
				"errors":  response{"customer_id": []string{"Pelanggan wajib diisi."}},
			})
			return
		}

		if plateNumber == "" || !vehicleStorePlateRegexp.MatchString(plateNumber) {
			writeJSON(w, http.StatusUnprocessableEntity, response{
				"message": "The given data was invalid.",
				"errors":  response{"plate_number": []string{"Nomor plat hanya boleh berisi huruf dan angka (tanpa spasi)."}},
			})
			return
		}

		if brand == "" {
			writeJSON(w, http.StatusUnprocessableEntity, response{
				"message": "The given data was invalid.",
				"errors":  response{"brand": []string{"Merek wajib diisi."}},
			})
			return
		}

		if model == "" {
			writeJSON(w, http.StatusUnprocessableEntity, response{
				"message": "The given data was invalid.",
				"errors":  response{"model": []string{"Model wajib diisi."}},
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
				"errors":  response{"customer_id": []string{"Pelanggan tidak ditemukan."}},
			})
			return
		}

		isPlateUsed, err := vehicleUpdatePlateExistsByOther(db, vehicleID, plateNumber)
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, response{"message": "failed to validate plate number"})
			return
		}
		if isPlateUsed {
			writeJSON(w, http.StatusUnprocessableEntity, response{
				"message": "The given data was invalid.",
				"errors":  response{"plate_number": []string{"Nomor plat sudah digunakan."}},
			})
			return
		}

		featuresJSON, err := json.Marshal(payload.Features)
		if err != nil {
			writeJSON(w, http.StatusUnprocessableEntity, response{
				"message": "The given data was invalid.",
				"errors":  response{"features": []string{"Format fitur tidak valid."}},
			})
			return
		}

		_, err = db.Exec(`
			UPDATE vehicles
			SET customer_id = ?, plate_number = ?, brand = ?, model = ?, year = ?, color = ?, engine_type = ?, transmission_type = ?,
				cylinder_volume = ?, features = ?, notes = ?, chassis_number = ?, engine_number = ?, manufacture_year = ?,
				registration_number = ?, registration_date = ?, stnk_expiry_date = ?, previous_owner = ?, updated_at = ?
			WHERE id = ?
		`,
			payload.CustomerID,
			plateNumber,
			brand,
			model,
			vehicleUpdateNullableInt(payload.Year),
			vehicleUpdateNullableString(payload.Color),
			vehicleUpdateNullableString(payload.EngineType),
			vehicleUpdateNullableString(payload.TransmissionType),
			vehicleUpdateNullableInt(payload.CylinderVolume),
			vehicleUpdateNullableJSON(featuresJSON),
			vehicleUpdateNullableString(payload.Notes),
			vehicleUpdateNullableString(payload.ChassisNumber),
			vehicleUpdateNullableString(payload.EngineNumber),
			vehicleUpdateNullableInt(payload.ManufactureYear),
			vehicleUpdateNullableString(payload.RegistrationNo),
			vehicleUpdateNullableDate(payload.RegistrationDate),
			vehicleUpdateNullableDate(payload.StnkExpiryDate),
			vehicleUpdateNullableString(payload.PreviousOwner),
			time.Now(),
			vehicleID,
		)
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, response{"message": "failed to update vehicle"})
			return
		}

		writeJSON(w, http.StatusOK, response{
			"message": "Kendaraan berhasil diperbarui!",
			"vehicle": response{
				"id":                vehicleID,
				"customer_id":       payload.CustomerID,
				"plate_number":      plateNumber,
				"brand":             brand,
				"model":             model,
				"year":              vehicleUpdateNullableInt(payload.Year),
				"color":             vehicleUpdateNullableString(payload.Color),
				"engine_type":       vehicleUpdateNullableString(payload.EngineType),
				"transmission_type": vehicleUpdateNullableString(payload.TransmissionType),
				"cylinder_volume":   vehicleUpdateNullableInt(payload.CylinderVolume),
				"features":          payload.Features,
				"notes":             vehicleUpdateNullableString(payload.Notes),
			},
		})
	}
}

func vehicleUpdatePlateExistsByOther(db *sql.DB, vehicleID int64, plateNumber string) (bool, error) {
	var id int64
	err := db.QueryRow(`SELECT id FROM vehicles WHERE plate_number = ? AND id <> ? LIMIT 1`, plateNumber, vehicleID).Scan(&id)
	if err == sql.ErrNoRows {
		return false, nil
	}
	if err != nil {
		return false, err
	}
	return true, nil
}

func vehicleUpdateNullableString(value string) any {
	trimmed := strings.TrimSpace(value)
	if trimmed == "" {
		return nil
	}
	return trimmed
}

func vehicleUpdateNullableInt(value *int64) any {
	if value == nil {
		return nil
	}
	return *value
}

func vehicleUpdateNullableDate(value *vehicleGoDate) any {
	if value == nil || value.Time.IsZero() {
		return nil
	}
	return value.Time.Format("2006-01-02")
}

func vehicleUpdateNullableJSON(raw []byte) any {
	if len(raw) == 0 || string(raw) == "null" {
		return nil
	}
	return string(raw)
}
