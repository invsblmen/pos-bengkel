package httpserver

import (
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestPartSaleClaimWarranty_DBNotConfigured(t *testing.T) {
	req := httptest.NewRequest(http.MethodPost, "/api/v1/part-sales/1/details/1/claim-warranty", nil)
	req.SetPathValue("partSale", "1")
	req.SetPathValue("detail", "1")
	rr := httptest.NewRecorder()

	handler := partSaleClaimWarrantyHandler(nil)
	handler.ServeHTTP(rr, req)

	if rr.Code != http.StatusServiceUnavailable {
		t.Fatalf("expected 503, got %d", rr.Code)
	}
}
