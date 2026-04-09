package httpserver

import (
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestOutstandingPaymentsReport_DBNotConfigured(t *testing.T) {
	req := httptest.NewRequest(http.MethodGet, "/api/v1/reports/outstanding-payments", nil)
	rr := httptest.NewRecorder()

	handler := outstandingPaymentsReportHandler(nil)
	handler.ServeHTTP(rr, req)

	if rr.Code != http.StatusServiceUnavailable {
		t.Fatalf("expected 503, got %d", rr.Code)
	}
}
