package httpserver

import (
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestServiceOrderShowHandlerWithoutDB(t *testing.T) {
	req := httptest.NewRequest(http.MethodGet, "/api/v1/service-orders/1", nil)
	req.SetPathValue("id", "1")
	rr := httptest.NewRecorder()

	handler := serviceOrderShowHandler(nil)
	handler.ServeHTTP(rr, req)

	if rr.Code != http.StatusServiceUnavailable {
		t.Fatalf("expected %d, got %d", http.StatusServiceUnavailable, rr.Code)
	}
}
