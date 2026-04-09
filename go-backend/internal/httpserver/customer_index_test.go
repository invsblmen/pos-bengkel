package httpserver

import (
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestCustomerIndexHandlerWithoutDB(t *testing.T) {
	req := httptest.NewRequest(http.MethodGet, "/api/v1/customers", nil)
	rr := httptest.NewRecorder()

	handler := customerIndexHandler(nil)
	handler.ServeHTTP(rr, req)

	if rr.Code != http.StatusServiceUnavailable {
		t.Fatalf("expected %d, got %d", http.StatusServiceUnavailable, rr.Code)
	}
}
