package httpserver

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestPartSaleStoreHandlerWithoutDB(t *testing.T) {
	handler := partSaleStoreHandler(nil)
	req := httptest.NewRequest(http.MethodPost, "/api/v1/part-sales", strings.NewReader(`{"customer_id":1,"sale_date":"2026-04-08","items":[{"part_id":1,"quantity":1,"unit_price":1000}]}`))
	rr := httptest.NewRecorder()

	handler.ServeHTTP(rr, req)

	if rr.Code != http.StatusServiceUnavailable {
		t.Fatalf("expected status %d, got %d", http.StatusServiceUnavailable, rr.Code)
	}
}
