package httpserver

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestServiceOrderStoreQuickIntakeHandlerWithoutDB(t *testing.T) {
	req := httptest.NewRequest(http.MethodPost, "/api/v1/service-orders/quick-intake", strings.NewReader(`{"customer_name":"A","customer_phone":"0812","plate_number":"B1CD","odometer_km":100}`))
	rr := httptest.NewRecorder()

	handler := serviceOrderStoreQuickIntakeHandler(nil)
	handler.ServeHTTP(rr, req)

	if rr.Code != http.StatusServiceUnavailable {
		t.Fatalf("expected %d, got %d", http.StatusServiceUnavailable, rr.Code)
	}
}
