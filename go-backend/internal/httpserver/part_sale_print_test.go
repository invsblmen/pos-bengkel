package httpserver

import (
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestPartSalePrintHandlerWithoutDB(t *testing.T) {
	req := httptest.NewRequest(http.MethodGet, "/api/v1/part-sales/1/print", nil)
	req.SetPathValue("id", "1")
	rr := httptest.NewRecorder()

	handler := partSalePrintHandler(nil)
	handler.ServeHTTP(rr, req)

	if rr.Code != http.StatusServiceUnavailable {
		t.Fatalf("expected %d, got %d", http.StatusServiceUnavailable, rr.Code)
	}
}
