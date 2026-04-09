package httpserver

import (
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestPartSaleWarrantiesExportHandlerWithoutDB(t *testing.T) {
	req := httptest.NewRequest(http.MethodGet, "/api/v1/part-sales/warranties/export", nil)
	rr := httptest.NewRecorder()

	handler := partSaleWarrantiesExportHandler(nil)
	handler.ServeHTTP(rr, req)

	if rr.Code != http.StatusServiceUnavailable {
		t.Fatalf("expected %d, got %d", http.StatusServiceUnavailable, rr.Code)
	}
}
