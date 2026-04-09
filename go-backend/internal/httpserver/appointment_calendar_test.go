package httpserver

import (
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestAppointmentCalendar_DBNotConfigured(t *testing.T) {
	req := httptest.NewRequest(http.MethodGet, "/api/v1/appointments/calendar", nil)
	rr := httptest.NewRecorder()

	handler := appointmentCalendarHandler(nil)
	handler.ServeHTTP(rr, req)

	if rr.Code != http.StatusServiceUnavailable {
		t.Fatalf("expected 503, got %d", rr.Code)
	}
}
