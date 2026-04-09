package httpserver

import (
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestServiceOrderDestroy_DBNotConfigured(t *testing.T) {
	req := httptest.NewRequest(http.MethodDelete, "/api/v1/service-orders/1", nil)
	req.SetPathValue("id", "1")
	rr := httptest.NewRecorder()

	handler := serviceOrderDestroyHandler(nil)
	handler.ServeHTTP(rr, req)

	if rr.Code != http.StatusServiceUnavailable {
		t.Fatalf("expected 503, got %d", rr.Code)
	}
}
