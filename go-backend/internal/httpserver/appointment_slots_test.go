package httpserver

import (
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestAppointmentSlots_DBNotConfigured(t *testing.T) {
	req := httptest.NewRequest(http.MethodGet, "/api/v1/appointments/slots?mechanic_id=1&date=2026-04-08", nil)
	rr := httptest.NewRecorder()

	handler := appointmentSlotsHandler(nil)
	handler.ServeHTTP(rr, req)

	if rr.Code != http.StatusServiceUnavailable {
		t.Fatalf("expected 503, got %d", rr.Code)
	}
}
