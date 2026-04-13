package httpserver

import (
	"net/http"

	"posbengkel/go-backend/internal/middleware"
)

func authLogoutHandler() http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			writeJSON(w, http.StatusMethodNotAllowed, response{"message": "method not allowed"})
			return
		}

		claims := middleware.GetClaimsFromContext(r)
		if claims == nil {
			writeJSON(w, http.StatusUnauthorized, response{"message": "not authenticated"})
			return
		}

		// In JWT-based auth, logout is handled on the client side (token deletion)
		// We can optionally invalidate tokens on the server side using a blacklist, but for MVP we'll keep it simple
		writeJSON(w, http.StatusOK, response{
			"message": "logout successful",
		})
	}
}
