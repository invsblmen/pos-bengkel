package httpserver

import (
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestAppointmentDetail_DBNotConfigured(t *testing.T) {
	req := httptest.NewRequest(http.MethodGet, "/api/v1/appointments/1", nil)
	req.SetPathValue("id", "1")
	rr := httptest.NewRecorder()

	handler := appointmentDetailHandler(nil)
	handler.ServeHTTP(rr, req)

	if rr.Code != http.StatusServiceUnavailable {
		t.Fatalf("expected 503, got %d", rr.Code)
	}
}
