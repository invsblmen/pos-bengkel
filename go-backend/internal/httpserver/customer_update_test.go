package httpserver

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestCustomerUpdateHandlerWithoutDB(t *testing.T) {
	req := httptest.NewRequest(http.MethodPut, "/api/v1/customers/1", strings.NewReader(`{"name":"John","phone":"0812"}`))
	req.SetPathValue("id", "1")
	rr := httptest.NewRecorder()

	handler := customerUpdateHandler(nil)
	handler.ServeHTTP(rr, req)

	if rr.Code != http.StatusServiceUnavailable {
		t.Fatalf("expected %d, got %d", http.StatusServiceUnavailable, rr.Code)
	}
}
