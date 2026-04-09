package httpserver

import (
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestReportExportCSV_DBNotConfigured(t *testing.T) {
	req := httptest.NewRequest(http.MethodGet, "/api/v1/reports/export?type=overall", nil)
	rr := httptest.NewRecorder()

	handler := reportExportCSVHandler(nil)
	handler.ServeHTTP(rr, req)

	if rr.Code != http.StatusServiceUnavailable {
		t.Fatalf("expected 503, got %d", rr.Code)
	}
}
