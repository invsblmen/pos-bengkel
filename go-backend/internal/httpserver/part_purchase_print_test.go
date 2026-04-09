package httpserver

import (
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestPartPurchasePrintHandlerWithoutDB(t *testing.T) {
	req := httptest.NewRequest(http.MethodGet, "/api/v1/part-purchases/1/print", nil)
	req.SetPathValue("id", "1")
	rr := httptest.NewRecorder()

	handler := partPurchasePrintHandler(nil)
	handler.ServeHTTP(rr, req)

	if rr.Code != http.StatusServiceUnavailable {
		t.Fatalf("expected %d, got %d", http.StatusServiceUnavailable, rr.Code)
	}
}