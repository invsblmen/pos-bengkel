package httpserver

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestCustomerStoreHandlerWithoutDB(t *testing.T) {
	req := httptest.NewRequest(http.MethodPost, "/api/v1/customers", strings.NewReader(`{"name":"John","phone":"0812"}`))
	rr := httptest.NewRecorder()

	handler := customerStoreHandler(nil)
	handler.ServeHTTP(rr, req)

	if rr.Code != http.StatusServiceUnavailable {
		t.Fatalf("expected %d, got %d", http.StatusServiceUnavailable, rr.Code)
	}
}
