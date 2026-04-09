package httpserver

import (
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestServiceOrderCreateQuickIntakeHandlerWithoutDB(t *testing.T) {
	req := httptest.NewRequest(http.MethodGet, "/api/v1/service-orders/quick-intake", nil)
	rr := httptest.NewRecorder()

	handler := serviceOrderCreateQuickIntakeHandler(nil)
	handler.ServeHTTP(rr, req)

	if rr.Code != http.StatusServiceUnavailable {
		t.Fatalf("expected %d, got %d", http.StatusServiceUnavailable, rr.Code)
	}
}
