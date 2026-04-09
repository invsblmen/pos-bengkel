package httpserver

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestServiceOrderUpdateHandlerWithoutDB(t *testing.T) {
	req := httptest.NewRequest(http.MethodPut, "/api/v1/service-orders/1", strings.NewReader(`{"items":[{"parts":[{"qty":1,"price":10000}]}]}`))
	req.SetPathValue("id", "1")
	rr := httptest.NewRecorder()

	handler := serviceOrderUpdateHandler(nil)
	handler.ServeHTTP(rr, req)

	if rr.Code != http.StatusServiceUnavailable {
		t.Fatalf("expected %d, got %d", http.StatusServiceUnavailable, rr.Code)
	}
}