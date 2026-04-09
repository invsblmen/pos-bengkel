package httpserver

import (
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestPartSaleIndex_DBNotConfigured(t *testing.T) {
	req := httptest.NewRequest(http.MethodGet, "/api/v1/part-sales", nil)
	rr := httptest.NewRecorder()

	handler := partSaleIndexHandler(nil)
	handler.ServeHTTP(rr, req)

	if rr.Code != http.StatusServiceUnavailable {
		t.Fatalf("expected 503, got %d", rr.Code)
	}
}
