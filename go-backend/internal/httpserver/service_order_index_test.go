package httpserver

import (
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestServiceOrderIndexHandlerWithoutDB(t *testing.T) {
	req := httptest.NewRequest(http.MethodGet, "/api/v1/service-orders", nil)
	rr := httptest.NewRecorder()

	handler := serviceOrderIndexHandler(nil)
	handler.ServeHTTP(rr, req)

	if rr.Code != http.StatusServiceUnavailable {
		t.Fatalf("expected %d, got %d", http.StatusServiceUnavailable, rr.Code)
	}
}
