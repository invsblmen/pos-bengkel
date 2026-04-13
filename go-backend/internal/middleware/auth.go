package middleware

import (
	"context"
	"errors"
	"net/http"
	"strconv"
	"strings"

	"posbengkel/go-backend/internal/services"
)

const (
	// ContextUserKey is the key for storing user claims in context
	ContextUserKey = "user_claims"
)

var (
	ErrUnauthorized = errors.New("unauthorized")
)

// AuthMiddleware is a middleware function that validates JWT tokens for http.HandlerFunc
func AuthMiddleware(tokenService *services.TokenService, next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if tokenService == nil {
			respondError(w, http.StatusInternalServerError, "auth service not configured")
			return
		}

		// Extract token from Authorization header
		token, err := extractToken(r)
		if err != nil {
			respondError(w, http.StatusUnauthorized, "missing or invalid authorization header")
			return
		}

		// Verify token
		claims, err := tokenService.VerifyToken(token)
		if err != nil {
			respondError(w, http.StatusUnauthorized, "invalid or expired token")
			return
		}

		// Store claims in context for later use
		ctx := context.WithValue(r.Context(), ContextUserKey, claims)
		next(w, r.WithContext(ctx))
	}
}

// Authenticator is the middleware that validates JWT tokens
type Authenticator struct {
	tokenService *services.TokenService
}

// NewAuthenticator creates a new authenticator middleware
func NewAuthenticator(tokenService *services.TokenService) *Authenticator {
	return &Authenticator{
		tokenService: tokenService,
	}
}

// Middleware is the auth middleware handler
func (a *Authenticator) Middleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// Extract token from Authorization header
		token, err := extractToken(r)
		if err != nil {
			respondError(w, http.StatusUnauthorized, "missing or invalid authorization header")
			return
		}

		// Verify token
		claims, err := a.tokenService.VerifyToken(token)
		if err != nil {
			respondError(w, http.StatusUnauthorized, "invalid or expired token")
			return
		}

		// Store claims in context for later use
		ctx := context.WithValue(r.Context(), ContextUserKey, claims)
		next.ServeHTTP(w, r.WithContext(ctx))
	})
}

// RequireRole is a middleware that checks if user has at least one of the required roles
func (a *Authenticator) RequireRole(requiredRoles ...string) func(next http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			// Get claims from context
			claims, ok := r.Context().Value(ContextUserKey).(*services.TokenClaims)
			if !ok {
				respondError(w, http.StatusUnauthorized, "no user context found")
				return
			}

			// Check if user has required role
			hasRequiredRole := false
			for _, required := range requiredRoles {
				for _, userRole := range claims.Roles {
					if userRole == required {
						hasRequiredRole = true
						break
					}
				}
				if hasRequiredRole {
					break
				}
			}

			if !hasRequiredRole {
				respondError(w, http.StatusForbidden, "insufficient permissions")
				return
			}

			next.ServeHTTP(w, r)
		})
	}
}

// GetClaimsFromContext extracts token claims from request context
func GetClaimsFromContext(r *http.Request) *services.TokenClaims {
	claims, ok := r.Context().Value(ContextUserKey).(*services.TokenClaims)
	if !ok {
		return nil
	}
	return claims
}

// Helper functions

// extractToken extracts the Bearer token from the Authorization header
func extractToken(r *http.Request) (string, error) {
	authHeader := r.Header.Get("Authorization")
	if authHeader == "" {
		return "", ErrUnauthorized
	}

	// Bearer token format: "Bearer <token>"
	parts := strings.SplitN(authHeader, " ", 2)
	if len(parts) != 2 || parts[0] != "Bearer" {
		return "", ErrUnauthorized
	}

	return parts[1], nil
}

// respondError writes an error response
func respondError(w http.ResponseWriter, status int, message string) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	w.Write([]byte(`{"error":"` + message + `"}`))
}

// CORSMiddleware adds CORS headers to responses
func CORSMiddleware(allowedOrigins []string) func(next http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			origin := r.Header.Get("Origin")

			// Check if origin is allowed
			allowed := false
			for _, allowedOrigin := range allowedOrigins {
				if origin == allowedOrigin || allowedOrigin == "*" {
					allowed = true
					break
				}
			}

			if allowed {
				w.Header().Set("Access-Control-Allow-Origin", origin)
				w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS")
				w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Request-ID")
				w.Header().Set("Access-Control-Max-Age", "86400")
				w.Header().Set("Access-Control-Allow-Credentials", "true")
			}

			// Handle preflight requests
			if r.Method == http.MethodOptions {
				w.WriteHeader(http.StatusNoContent)
				return
			}

			next.ServeHTTP(w, r)
		})
	}
}

// LoggingMiddleware logs HTTP requests
func LoggingMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// Get user ID from context if available
		userID := "guest"
		if claims, ok := r.Context().Value(ContextUserKey).(*services.TokenClaims); ok {
			userID = strconv.FormatInt(claims.UserID, 10)
		}

		// Log request (in production, use a proper logger)
		_ = userID // Remove unused variable warning

		next.ServeHTTP(w, r)
	})
}
