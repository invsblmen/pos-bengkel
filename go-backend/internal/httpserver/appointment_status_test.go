package httpserver

import (
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestAppointmentStatus_DBNotConfigured(t *testing.T) {
	req := httptest.NewRequest(http.MethodPatch, "/api/v1/appointments/1/status", nil)
	req.SetPathValue("id", "1")
	rr := httptest.NewRecorder()

	handler := appointmentStatusHandler(nil)
	handler.ServeHTTP(rr, req)

	if rr.Code != http.StatusServiceUnavailable {
		t.Fatalf("expected 503, got %d", rr.Code)
	}
}
