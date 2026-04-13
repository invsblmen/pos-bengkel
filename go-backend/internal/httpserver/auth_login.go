package httpserver

import (
	"encoding/json"
	"net/http"

	"posbengkel/go-backend/internal/services"
)

type authLoginRequest struct {
	Email    string `json:"email"`
	Password string `json:"password"`
}

func authLoginHandler(authService *services.AuthService) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			writeJSON(w, http.StatusMethodNotAllowed, response{"message": "method not allowed"})
			return
		}

		if authService == nil {
			writeJSON(w, http.StatusInternalServerError, response{"message": "auth service not configured"})
			return
		}

		var req authLoginRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			writeJSON(w, http.StatusBadRequest, response{"message": "invalid request body"})
			return
		}

		if req.Email == "" || req.Password == "" {
			writeJSON(w, http.StatusBadRequest, response{"message": "email and password are required"})
			return
		}

		loginResp, err := authService.Login(services.LoginRequest{
			Email:    req.Email,
			Password: req.Password,
		})
		if err != nil {
			writeJSON(w, http.StatusUnauthorized, response{"message": "authentication failed", "error": err.Error()})
			return
		}

		writeJSON(w, http.StatusOK, response{
			"token":      loginResp.Token,
			"expires_at": loginResp.ExpiresAt,
			"user":       loginResp.User,
		})
	}
}
