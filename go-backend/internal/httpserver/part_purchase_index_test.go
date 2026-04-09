package httpserver

import (
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestPartPurchaseIndex_DBNotConfigured(t *testing.T) {
	req := httptest.NewRequest(http.MethodGet, "/api/v1/part-purchases", nil)
	rr := httptest.NewRecorder()

	handler := partPurchaseIndexHandler(nil)
	handler.ServeHTTP(rr, req)

	if rr.Code != http.StatusServiceUnavailable {
		t.Fatalf("expected 503, got %d", rr.Code)
	}
}
