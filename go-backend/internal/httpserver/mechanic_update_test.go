package httpserver

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestMechanicUpdateHandlerWithoutDB(t *testing.T) {
	req := httptest.NewRequest(http.MethodPut, "/api/v1/mechanics/1", strings.NewReader(`{"name":"Budi"}`))
	req.SetPathValue("id", "1")
	rr := httptest.NewRecorder()

	handler := mechanicUpdateHandler(nil)
	handler.ServeHTTP(rr, req)

	if rr.Code != http.StatusServiceUnavailable {
		t.Fatalf("expected %d, got %d", http.StatusServiceUnavailable, rr.Code)
	}
}
