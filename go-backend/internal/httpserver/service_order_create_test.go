package httpserver

import (
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestServiceOrderCreateHandlerWithoutDB(t *testing.T) {
	req := httptest.NewRequest(http.MethodGet, "/api/v1/service-orders/create", nil)
	rr := httptest.NewRecorder()

	handler := serviceOrderCreateHandler(nil)
	handler.ServeHTTP(rr, req)

	if rr.Code != http.StatusServiceUnavailable {
		t.Fatalf("expected %d, got %d", http.StatusServiceUnavailable, rr.Code)
	}
}
