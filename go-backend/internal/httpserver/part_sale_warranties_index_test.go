package httpserver

import (
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestPartSaleWarrantiesIndexHandlerWithoutDB(t *testing.T) {
	req := httptest.NewRequest(http.MethodGet, "/api/v1/part-sales/warranties", nil)
	rr := httptest.NewRecorder()

	handler := partSaleWarrantiesIndexHandler(nil)
	handler.ServeHTTP(rr, req)

	if rr.Code != http.StatusServiceUnavailable {
		t.Fatalf("expected %d, got %d", http.StatusServiceUnavailable, rr.Code)
	}
}
