package httpserver

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"

	"posbengkel/go-backend/internal/config"
)

func whatsappHealthCheckHandler(cfg config.Config) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		targetURL := strings.TrimSpace(cfg.WhatsAppDashboardURL)
		if targetURL == "" {
			writeJSON(w, http.StatusOK, response{
				"ok":          false,
				"status":      "down",
				"message":     "WHATSAPP_GO_DASHBOARD_URL belum dikonfigurasi.",
				"http_status": nil,
				"latency_ms":  nil,
				"target_url":  nil,
			})
			return
		}

		startedAt := time.Now()
		client := &http.Client{
			Timeout: 5 * time.Second,
			CheckRedirect: func(req *http.Request, via []*http.Request) error {
				return http.ErrUseLastResponse
			},
		}

		req, err := http.NewRequest(http.MethodGet, targetURL, nil)
		if err != nil {
			writeJSON(w, http.StatusOK, response{
				"ok":          false,
				"status":      "down",
				"message":     "Service WhatsApp Go tidak bisa diakses: " + err.Error(),
				"http_status": nil,
				"latency_ms":  elapsedMillis(startedAt),
				"target_url":  targetURL,
			})
			return
		}

		if cfg.WhatsAppAPIUsername != "" && cfg.WhatsAppAPIPassword != "" {
			req.SetBasicAuth(cfg.WhatsAppAPIUsername, cfg.WhatsAppAPIPassword)
		}

		resp, err := client.Do(req)
		if err != nil {
			writeJSON(w, http.StatusOK, response{
				"ok":          false,
				"status":      "down",
				"message":     "Service WhatsApp Go tidak bisa diakses: " + err.Error(),
				"http_status": nil,
				"latency_ms":  elapsedMillis(startedAt),
				"target_url":  targetURL,
			})
			return
		}
		defer resp.Body.Close()

		httpStatus := resp.StatusCode
		latencyMs := elapsedMillis(startedAt)

		if httpStatus == http.StatusUnauthorized && (cfg.WhatsAppAPIUsername == "" || cfg.WhatsAppAPIPassword == "") {
			writeJSON(w, http.StatusOK, response{
				"ok":          false,
				"status":      "auth_required",
				"message":     "Service WhatsApp Go aktif, tetapi butuh Basic Auth. Isi WHATSAPP_API_USERNAME dan WHATSAPP_API_PASSWORD agar akses dashboard tidak 401.",
				"http_status": httpStatus,
				"latency_ms":  latencyMs,
				"target_url":  targetURL,
			})
			return
		}

		isUp := httpStatus >= 200 && httpStatus < 500
		message := fmt.Sprintf("Service WhatsApp Go merespons HTTP %d.", httpStatus)
		if isUp {
			message = fmt.Sprintf("Service WhatsApp Go reachable (HTTP %d).", httpStatus)
		}

		writeJSON(w, http.StatusOK, response{
			"ok":          isUp,
			"status":      map[bool]string{true: "up", false: "down"}[isUp],
			"message":     message,
			"http_status": httpStatus,
			"latency_ms":  latencyMs,
			"target_url":  targetURL,
		})
	}
}

func whatsappWebhookHandler(cfg config.Config) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		body, err := io.ReadAll(r.Body)
		if err != nil {
			writeJSON(w, http.StatusBadRequest, response{"message": "Unable to read request body."})
			return
		}
		defer r.Body.Close()

		signature := r.Header.Get("X-Hub-Signature-256")
		signatureValid := isValidSignature(body, signature, cfg.WhatsAppWebhookSecret)

		if cfg.VerifyWebhookSignature && !signatureValid {
			writeJSON(w, http.StatusUnauthorized, response{
				"message": "Invalid webhook signature.",
			})
			return
		}

		var payload map[string]any
		if len(body) > 0 {
			if err := json.Unmarshal(body, &payload); err != nil {
				writeJSON(w, http.StatusBadRequest, response{"message": "Invalid JSON payload."})
				return
			}
		}

		// TODO: persist event and dispatch internal event bus once storage layer is added.
		writeJSON(w, http.StatusOK, response{"status": "ok"})
	}
}

func isValidSignature(rawBody []byte, header string, secret string) bool {
	if !strings.HasPrefix(header, "sha256=") || strings.TrimSpace(secret) == "" {
		return false
	}

	actualHex := strings.TrimPrefix(header, "sha256=")
	actual, err := hex.DecodeString(actualHex)
	if err != nil {
		return false
	}

	mac := hmac.New(sha256.New, []byte(secret))
	_, _ = mac.Write(rawBody)
	expected := mac.Sum(nil)

	return hmac.Equal(expected, actual)
}

func elapsedMillis(start time.Time) int {
	return int(time.Since(start).Milliseconds())
}
