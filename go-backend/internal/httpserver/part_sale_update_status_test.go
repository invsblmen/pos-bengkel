package httpserver

import (
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestPartSaleUpdateStatus_DBNotConfigured(t *testing.T) {
	req := httptest.NewRequest(http.MethodPost, "/api/v1/part-sales/1/update-status", nil)
	req.SetPathValue("id", "1")
	rr := httptest.NewRecorder()

	handler := partSaleUpdateStatusHandler(nil)
	handler.ServeHTTP(rr, req)

	if rr.Code != http.StatusServiceUnavailable {
		t.Fatalf("expected 503, got %d", rr.Code)
	}
}
