package httpserver

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestServiceOrderUpdateStatusHandlerWithoutDB(t *testing.T) {
	req := httptest.NewRequest(http.MethodPost, "/api/v1/service-orders/1/status", strings.NewReader(`{"status":"completed"}`))
	req.SetPathValue("id", "1")
	rr := httptest.NewRecorder()

	handler := serviceOrderUpdateStatusHandler(nil)
	handler.ServeHTTP(rr, req)

	if rr.Code != http.StatusServiceUnavailable {
		t.Fatalf("expected %d, got %d", http.StatusServiceUnavailable, rr.Code)
	}
}