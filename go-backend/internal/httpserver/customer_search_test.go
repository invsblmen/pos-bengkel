package httpserver

import (
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestCustomerSearchHandlerWithoutDB(t *testing.T) {
	req := httptest.NewRequest(http.MethodGet, "/api/v1/customers/search?q=john", nil)
	rr := httptest.NewRecorder()

	handler := customerSearchHandler(nil)
	handler.ServeHTTP(rr, req)

	if rr.Code != http.StatusServiceUnavailable {
		t.Fatalf("expected %d, got %d", http.StatusServiceUnavailable, rr.Code)
	}
}
