package httpserver

import (
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestPartPurchaseUpdateStatus_DBNotConfigured(t *testing.T) {
	req := httptest.NewRequest(http.MethodPost, "/api/v1/part-purchases/1/update-status", nil)
	req.SetPathValue("id", "1")
	rr := httptest.NewRecorder()

	handler := partPurchaseUpdateStatusHandler(nil)
	handler.ServeHTTP(rr, req)

	if rr.Code != http.StatusServiceUnavailable {
		t.Fatalf("expected 503, got %d", rr.Code)
	}
}

func TestPartPurchaseUpdate_DBNotConfigured(t *testing.T) {
	req := httptest.NewRequest(http.MethodPut, "/api/v1/part-purchases/1", nil)
	req.SetPathValue("id", "1")
	rr := httptest.NewRecorder()

	handler := partPurchaseUpdateHandler(nil)
	handler.ServeHTTP(rr, req)

	if rr.Code != http.StatusServiceUnavailable {
		t.Fatalf("expected 503, got %d", rr.Code)
	}
}
