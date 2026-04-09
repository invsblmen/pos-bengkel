package httpserver

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestServiceOrderStoreHandlerWithoutDB(t *testing.T) {
	req := httptest.NewRequest(http.MethodPost, "/api/v1/service-orders", strings.NewReader(`{"submission_token":"abc","odometer_km":1200,"items":[{"parts":[{"qty":1,"price":10000}]}]}`))
	rr := httptest.NewRecorder()

	handler := serviceOrderStoreHandler(nil)
	handler.ServeHTTP(rr, req)

	if rr.Code != http.StatusServiceUnavailable {
		t.Fatalf("expected %d, got %d", http.StatusServiceUnavailable, rr.Code)
	}
}