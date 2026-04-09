package httpserver

import (
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestVehicleServiceHistory_DBNotConfigured(t *testing.T) {
	req := httptest.NewRequest(http.MethodGet, "/api/v1/vehicles/1/service-history", nil)
	req.SetPathValue("id", "1")
	rr := httptest.NewRecorder()

	handler := vehicleServiceHistoryHandler(nil)
	handler.ServeHTTP(rr, req)

	if rr.Code != http.StatusServiceUnavailable {
		t.Fatalf("expected 503, got %d", rr.Code)
	}
}

func TestVehicleWithHistory_DBNotConfigured(t *testing.T) {
	req := httptest.NewRequest(http.MethodGet, "/api/v1/vehicles/1/with-history", nil)
	req.SetPathValue("id", "1")
	rr := httptest.NewRecorder()

	handler := vehicleWithHistoryHandler(nil)
	handler.ServeHTTP(rr, req)

	if rr.Code != http.StatusServiceUnavailable {
		t.Fatalf("expected 503, got %d", rr.Code)
	}
}

func TestVehicleDetail_DBNotConfigured(t *testing.T) {
	req := httptest.NewRequest(http.MethodGet, "/api/v1/vehicles/1", nil)
	req.SetPathValue("id", "1")
	rr := httptest.NewRecorder()

	handler := vehicleDetailHandler(nil)
	handler.ServeHTTP(rr, req)

	if rr.Code != http.StatusServiceUnavailable {
		t.Fatalf("expected 503, got %d", rr.Code)
	}
}

func TestVehicleStore_DBNotConfigured(t *testing.T) {
	req := httptest.NewRequest(http.MethodPost, "/api/v1/vehicles", nil)
	rr := httptest.NewRecorder()

	handler := vehicleStoreHandler(nil)
	handler.ServeHTTP(rr, req)

	if rr.Code != http.StatusServiceUnavailable {
		t.Fatalf("expected 503, got %d", rr.Code)
	}
}

func TestVehicleUpdate_DBNotConfigured(t *testing.T) {
	req := httptest.NewRequest(http.MethodPut, "/api/v1/vehicles/1", nil)
	req.SetPathValue("id", "1")
	rr := httptest.NewRecorder()

	handler := vehicleUpdateHandler(nil)
	handler.ServeHTTP(rr, req)

	if rr.Code != http.StatusServiceUnavailable {
		t.Fatalf("expected 503, got %d", rr.Code)
	}
}

func TestVehicleDestroy_DBNotConfigured(t *testing.T) {
	req := httptest.NewRequest(http.MethodDelete, "/api/v1/vehicles/1", nil)
	req.SetPathValue("id", "1")
	rr := httptest.NewRecorder()

	handler := vehicleDestroyHandler(nil)
	handler.ServeHTTP(rr, req)

	if rr.Code != http.StatusServiceUnavailable {
		t.Fatalf("expected 503, got %d", rr.Code)
	}
}
