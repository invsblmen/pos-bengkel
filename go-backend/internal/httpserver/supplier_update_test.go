package httpserver

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestSupplierUpdateHandlerWithoutDB(t *testing.T) {
	req := httptest.NewRequest(http.MethodPut, "/api/v1/suppliers/1", strings.NewReader(`{"name":"Supplier A"}`))
	req.SetPathValue("id", "1")
	rr := httptest.NewRecorder()

	handler := supplierUpdateHandler(nil)
	handler.ServeHTTP(rr, req)

	if rr.Code != http.StatusServiceUnavailable {
		t.Fatalf("expected %d, got %d", http.StatusServiceUnavailable, rr.Code)
	}
}
