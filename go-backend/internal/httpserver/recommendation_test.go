package httpserver

import (
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestVehicleRecommendations_DBNotConfigured(t *testing.T) {
	req := httptest.NewRequest(http.MethodGet, "/api/v1/vehicles/1/recommendations", nil)
	req.SetPathValue("id", "1")
	rr := httptest.NewRecorder()

	handler := vehicleRecommendationsHandler(nil)
	handler.ServeHTTP(rr, req)

	if rr.Code != http.StatusServiceUnavailable {
		t.Fatalf("expected 503, got %d", rr.Code)
	}
}

func TestVehicleMaintenanceSchedule_DBNotConfigured(t *testing.T) {
	req := httptest.NewRequest(http.MethodGet, "/api/v1/vehicles/1/maintenance-schedule", nil)
	req.SetPathValue("id", "1")
	rr := httptest.NewRecorder()

	handler := vehicleMaintenanceScheduleHandler(nil)
	handler.ServeHTTP(rr, req)

	if rr.Code != http.StatusServiceUnavailable {
		t.Fatalf("expected 503, got %d", rr.Code)
	}
}
