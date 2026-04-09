package httpserver

import (
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestAppointmentStore_DBNotConfigured(t *testing.T) {
	req := httptest.NewRequest(http.MethodPost, "/api/v1/appointments", nil)
	rr := httptest.NewRecorder()

	handler := appointmentStoreHandler(nil)
	handler.ServeHTTP(rr, req)

	if rr.Code != http.StatusServiceUnavailable {
		t.Fatalf("expected 503, got %d", rr.Code)
	}
}
