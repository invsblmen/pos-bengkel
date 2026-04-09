package httpserver

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestPartPurchaseStore_DBNotConfigured(t *testing.T) {
	handler := partPurchaseStoreHandler(nil)

	req := httptest.NewRequest(http.MethodPost, "/api/v1/part-purchases", strings.NewReader(`{"supplier_id":1,"purchase_date":"2026-04-08","items":[{"part_id":1,"quantity":1,"unit_price":10000,"margin_type":"percent","margin_value":10}]}`))
	rr := httptest.NewRecorder()

	handler.ServeHTTP(rr, req)

	if rr.Code != http.StatusServiceUnavailable {
		t.Fatalf("expected status %d, got %d", http.StatusServiceUnavailable, rr.Code)
	}
}
