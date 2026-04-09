package httpserver

import (
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestPartPurchaseCreateHandlerWithoutDB(t *testing.T) {
	req := httptest.NewRequest(http.MethodGet, "/api/v1/part-purchases/create", nil)
	rr := httptest.NewRecorder()

	handler := partPurchaseCreateHandler(nil)
	handler.ServeHTTP(rr, req)

	if rr.Code != http.StatusServiceUnavailable {
		t.Fatalf("expected %d, got %d", http.StatusServiceUnavailable, rr.Code)
	}
}