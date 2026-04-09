package httpserver

import (
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestServiceOrderEditHandlerWithoutDB(t *testing.T) {
	req := httptest.NewRequest(http.MethodGet, "/api/v1/service-orders/1/edit", nil)
	req.SetPathValue("id", "1")
	rr := httptest.NewRecorder()

	handler := serviceOrderEditHandler(nil)
	handler.ServeHTTP(rr, req)

	if rr.Code != http.StatusServiceUnavailable {
		t.Fatalf("expected %d, got %d", http.StatusServiceUnavailable, rr.Code)
	}
}
