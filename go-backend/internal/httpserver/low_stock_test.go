package httpserver

import (
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestLowStockIndex_DBNotConfigured(t *testing.T) {
	req := httptest.NewRequest(http.MethodGet, "/api/v1/parts/low-stock", nil)
	rr := httptest.NewRecorder()

	handler := lowStockIndexHandler(nil)
	handler.ServeHTTP(rr, req)

	if rr.Code != http.StatusServiceUnavailable {
		t.Fatalf("expected 503, got %d", rr.Code)
	}
}
