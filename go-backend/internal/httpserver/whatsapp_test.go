package httpserver

import (
	"bytes"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"posbengkel/go-backend/internal/config"
)

func TestHealthCheck_MissingDashboardURL(t *testing.T) {
	req := httptest.NewRequest(http.MethodGet, "/api/v1/whatsapp/health/check", nil)
	rr := httptest.NewRecorder()

	handler := whatsappHealthCheckHandler(config.Config{})
	handler.ServeHTTP(rr, req)

	if rr.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", rr.Code)
	}

	var got map[string]any
	if err := json.Unmarshal(rr.Body.Bytes(), &got); err != nil {
		t.Fatalf("unexpected json error: %v", err)
	}

	if got["status"] != "down" {
		t.Fatalf("expected status down, got %#v", got["status"])
	}
}

func TestWebhookSignature_Valid(t *testing.T) {
	payload := []byte(`{"event":"test"}`)
	secret := "secret"

	sig := signSHA256(payload, secret)
	req := httptest.NewRequest(http.MethodPost, "/api/v1/webhooks/whatsapp", bytes.NewReader(payload))
	req.Header.Set("X-Hub-Signature-256", "sha256="+sig)

	rr := httptest.NewRecorder()
	handler := whatsappWebhookHandler(config.Config{
		WhatsAppWebhookSecret:  secret,
		VerifyWebhookSignature: true,
	})
	handler.ServeHTTP(rr, req)

	if rr.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", rr.Code)
	}

	var got map[string]any
	if err := json.Unmarshal(rr.Body.Bytes(), &got); err != nil {
		t.Fatalf("unexpected json error: %v", err)
	}

	if got["status"] != "ok" {
		t.Fatalf("expected status ok, got %#v", got["status"])
	}
}

func TestWebhookSignature_Invalid(t *testing.T) {
	payload := []byte(`{"event":"test"}`)

	req := httptest.NewRequest(http.MethodPost, "/api/v1/webhooks/whatsapp", bytes.NewReader(payload))
	req.Header.Set("X-Hub-Signature-256", "sha256=deadbeef")

	rr := httptest.NewRecorder()
	handler := whatsappWebhookHandler(config.Config{
		WhatsAppWebhookSecret:  "secret",
		VerifyWebhookSignature: true,
	})
	handler.ServeHTTP(rr, req)

	if rr.Code != http.StatusUnauthorized {
		t.Fatalf("expected 401, got %d", rr.Code)
	}
}

func signSHA256(body []byte, secret string) string {
	mac := hmac.New(sha256.New, []byte(secret))
	_, _ = mac.Write(body)
	return hex.EncodeToString(mac.Sum(nil))
}
