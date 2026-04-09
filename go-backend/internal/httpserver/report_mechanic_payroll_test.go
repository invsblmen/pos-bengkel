package httpserver

import (
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestMechanicPayrollReport_DBNotConfigured(t *testing.T) {
	req := httptest.NewRequest(http.MethodGet, "/api/v1/reports/mechanic-payroll", nil)
	rr := httptest.NewRecorder()

	handler := mechanicPayrollReportHandler(nil)
	handler.ServeHTTP(rr, req)

	if rr.Code != http.StatusServiceUnavailable {
		t.Fatalf("expected 503, got %d", rr.Code)
	}
}
