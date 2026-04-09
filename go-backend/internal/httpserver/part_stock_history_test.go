package httpserver

import (
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestPartStockHistoryIndex_DBNotConfigured(t *testing.T) {
	req := httptest.NewRequest(http.MethodGet, "/api/v1/part-stock-history", nil)
	rr := httptest.NewRecorder()

	handler := partStockHistoryIndexHandler(nil)
	handler.ServeHTTP(rr, req)

	if rr.Code != http.StatusServiceUnavailable {
		t.Fatalf("expected 503, got %d", rr.Code)
	}
}

func TestPartStockHistoryExport_DBNotConfigured(t *testing.T) {
	req := httptest.NewRequest(http.MethodGet, "/api/v1/part-stock-history/export", nil)
	rr := httptest.NewRecorder()

	handler := partStockHistoryExportHandler(nil)
	handler.ServeHTTP(rr, req)

	if rr.Code != http.StatusServiceUnavailable {
		t.Fatalf("expected 503, got %d", rr.Code)
	}
}
