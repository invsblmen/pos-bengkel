package httpserver

import (
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestCustomerShowHandlerWithoutDB(t *testing.T) {
	req := httptest.NewRequest(http.MethodGet, "/api/v1/customers/1", nil)
	req.SetPathValue("id", "1")
	rr := httptest.NewRecorder()

	handler := customerShowHandler(nil)
	handler.ServeHTTP(rr, req)

	if rr.Code != http.StatusServiceUnavailable {
		t.Fatalf("expected %d, got %d", http.StatusServiceUnavailable, rr.Code)
	}
}
