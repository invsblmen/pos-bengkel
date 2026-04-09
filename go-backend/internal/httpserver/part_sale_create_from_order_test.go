package httpserver

import (
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestPartSaleCreateFromOrder_DBNotConfigured(t *testing.T) {
	req := httptest.NewRequest(http.MethodPost, "/api/v1/part-sales/create-from-order", nil)
	rr := httptest.NewRecorder()

	handler := partSaleCreateFromOrderHandler(nil)
	handler.ServeHTTP(rr, req)

	if rr.Code != http.StatusServiceUnavailable {
		t.Fatalf("expected 503, got %d", rr.Code)
	}
}
