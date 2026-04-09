package httpserver

import (
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestMechanicIndexHandlerWithoutDB(t *testing.T) {
	req := httptest.NewRequest(http.MethodGet, "/api/v1/mechanics", nil)
	rr := httptest.NewRecorder()

	handler := mechanicIndexHandler(nil)
	handler.ServeHTTP(rr, req)

	if rr.Code != http.StatusServiceUnavailable {
		t.Fatalf("expected %d, got %d", http.StatusServiceUnavailable, rr.Code)
	}
}