package httpserver

import (
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestMechanicDestroyHandlerWithoutDB(t *testing.T) {
	req := httptest.NewRequest(http.MethodDelete, "/api/v1/mechanics/1", nil)
	req.SetPathValue("id", "1")
	rr := httptest.NewRecorder()

	handler := mechanicDestroyHandler(nil)
	handler.ServeHTTP(rr, req)

	if rr.Code != http.StatusServiceUnavailable {
		t.Fatalf("expected %d, got %d", http.StatusServiceUnavailable, rr.Code)
	}
}
