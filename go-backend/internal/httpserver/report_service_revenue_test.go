package httpserver

import (
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestServiceRevenueReport_DBNotConfigured(t *testing.T) {
	req := httptest.NewRequest(http.MethodGet, "/api/v1/reports/service-revenue", nil)
	rr := httptest.NewRecorder()

	handler := serviceRevenueReportHandler(nil)
	handler.ServeHTTP(rr, req)

	if rr.Code != http.StatusServiceUnavailable {
		t.Fatalf("expected 503, got %d", rr.Code)
	}
}
