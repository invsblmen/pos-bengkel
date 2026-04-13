package httpserver

import (
	"net/http"

	"posbengkel/go-backend/internal/middleware"
	"posbengkel/go-backend/internal/services"
)

func authRefreshHandler(tokenService *services.TokenService) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			writeJSON(w, http.StatusMethodNotAllowed, response{"message": "method not allowed"})
			return
		}

		if tokenService == nil {
			writeJSON(w, http.StatusInternalServerError, response{"message": "token service not configured"})
			return
		}

		claims := middleware.GetClaimsFromContext(r)
		if claims == nil {
			writeJSON(w, http.StatusUnauthorized, response{"message": "not authenticated"})
			return
		}

		// Generate new token with the same claims
		newToken, err := tokenService.GenerateToken(claims.UserID, claims.Email, claims.Roles)
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, response{"message": "failed to refresh token", "error": err.Error()})
			return
		}

		writeJSON(w, http.StatusOK, response{
			"token": newToken,
		})
	}
}
