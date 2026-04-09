package httpserver

import (
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestPartSaleUpdatePayment_DBNotConfigured(t *testing.T) {
	req := httptest.NewRequest(http.MethodPost, "/api/v1/part-sales/1/update-payment", nil)
	req.SetPathValue("id", "1")
	rr := httptest.NewRecorder()

	handler := partSaleUpdatePaymentHandler(nil)
	handler.ServeHTTP(rr, req)

	if rr.Code != http.StatusServiceUnavailable {
		t.Fatalf("expected 503, got %d", rr.Code)
	}
}
