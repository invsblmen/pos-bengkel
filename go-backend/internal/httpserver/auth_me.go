package httpserver

import (
	"net/http"

	"posbengkel/go-backend/internal/middleware"
	"posbengkel/go-backend/internal/services"
)

func authMeHandler(authService *services.AuthService) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodGet {
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

		user, err := authService.GetCurrentUser(claims)
		if err != nil {
			writeJSON(w, http.StatusNotFound, response{"message": "user not found", "error": err.Error()})
			return
		}

		writeJSON(w, http.StatusOK, response{
			"user": user,
		})
	}
}
