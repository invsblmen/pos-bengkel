package httpserver

import (
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestSupplierIndexHandlerWithoutDB(t *testing.T) {
	req := httptest.NewRequest(http.MethodGet, "/api/v1/suppliers", nil)
	rr := httptest.NewRecorder()

	handler := supplierIndexHandler(nil)
	handler.ServeHTTP(rr, req)

	if rr.Code != http.StatusServiceUnavailable {
		t.Fatalf("expected %d, got %d", http.StatusServiceUnavailable, rr.Code)
	}
}
