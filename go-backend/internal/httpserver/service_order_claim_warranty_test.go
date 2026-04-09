package httpserver

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestServiceOrderClaimWarrantyHandlerWithoutDB(t *testing.T) {
	req := httptest.NewRequest(http.MethodPost, "/api/v1/service-orders/1/details/1/claim-warranty", strings.NewReader(`{"claim_notes":"ok"}`))
	req.SetPathValue("id", "1")
	req.SetPathValue("detailId", "1")
	rr := httptest.NewRecorder()

	handler := serviceOrderClaimWarrantyHandler(nil)
	handler.ServeHTTP(rr, req)

	if rr.Code != http.StatusServiceUnavailable {
		t.Fatalf("expected %d, got %d", http.StatusServiceUnavailable, rr.Code)
	}
}