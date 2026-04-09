package httpserver

import (
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestPartSalesProfit_DBNotConfigured(t *testing.T) {
	req := httptest.NewRequest(http.MethodGet, "/api/v1/reports/part-sales-profit", nil)
	rr := httptest.NewRecorder()

	handler := partSalesProfitHandler(nil)
	handler.ServeHTTP(rr, req)

	if rr.Code != http.StatusServiceUnavailable {
		t.Fatalf("expected 503, got %d", rr.Code)
	}
}

func TestPartSalesProfitBySupplier_DBNotConfigured(t *testing.T) {
	req := httptest.NewRequest(http.MethodGet, "/api/v1/reports/part-sales-profit/by-supplier", nil)
	rr := httptest.NewRecorder()

	handler := partSalesProfitBySupplierHandler(nil)
	handler.ServeHTTP(rr, req)

	if rr.Code != http.StatusServiceUnavailable {
		t.Fatalf("expected 503, got %d", rr.Code)
	}
}
