package httpserver

import (
	"encoding/json"
	"net/http"

	"posbengkel/go-backend/internal/middleware"
	"posbengkel/go-backend/internal/services"
)

type authChangePasswordRequest struct {
	OldPassword     string `json:"old_password"`
	NewPassword     string `json:"new_password"`
	ConfirmPassword string `json:"confirm_password"`
}

func authChangePasswordHandler(authService *services.AuthService) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			writeJSON(w, http.StatusMethodNotAllowed, response{"message": "method not allowed"})
			return
		}

		if authService == nil {
			writeJSON(w, http.StatusInternalServerError, response{"message": "auth service not configured"})
			return
		}

		claims := middleware.GetClaimsFromContext(r)
		if claims == nil {
			writeJSON(w, http.StatusUnauthorized, response{"message": "not authenticated"})
			return
		}

		var req authChangePasswordRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			writeJSON(w, http.StatusBadRequest, response{"message": "invalid request body"})
			return
		}

		if req.OldPassword == "" || req.NewPassword == "" {
			writeJSON(w, http.StatusBadRequest, response{"message": "old password and new password are required"})
			return
		}

		if req.NewPassword != req.ConfirmPassword {
			writeJSON(w, http.StatusBadRequest, response{"message": "new password and confirmation do not match"})
			return
		}

		if err := authService.ChangePassword(claims.UserID, req.OldPassword, req.NewPassword); err != nil {
			writeJSON(w, http.StatusBadRequest, response{"message": "failed to change password", "error": err.Error()})
			return
		}

		writeJSON(w, http.StatusOK, response{
			"message": "password changed successfully",
		})
	}
}
