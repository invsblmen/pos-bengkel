package httpserver

import (
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestCashChangeSuggest_DBNotConfigured(t *testing.T) {
	req := httptest.NewRequest(http.MethodPost, "/api/v1/cash-management/change/suggest", nil)
	rr := httptest.NewRecorder()

	handler := cashChangeSuggestHandler(nil)
	handler.ServeHTTP(rr, req)

	if rr.Code != http.StatusServiceUnavailable {
		t.Fatalf("expected 503, got %d", rr.Code)
	}
}
