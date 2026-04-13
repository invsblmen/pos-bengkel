package handlers

import (
	"encoding/json"
	"net/http"

	"posbengkel/go-backend/internal/middleware"
	"posbengkel/go-backend/internal/services"
)

// AuthHandler handles authentication endpoints
type AuthHandler struct {
	authService *services.AuthService
}

// NewAuthHandler creates a new auth handler
func NewAuthHandler(authService *services.AuthService) *AuthHandler {
	return &AuthHandler{
		authService: authService,
	}
}

// LoginRequest contains login credentials
type LoginRequest struct {
	Email    string `json:"email" binding:"required"`
	Password string `json:"password" binding:"required"`
}

// ChangePasswordRequest contains password change data
type ChangePasswordRequest struct {
	OldPassword     string `json:"old_password" binding:"required"`
	NewPassword     string `json:"new_password" binding:"required"`
	ConfirmPassword string `json:"confirm_password" binding:"required"`
}

// ErrorResponse is a generic error response
type ErrorResponse struct {
	Error      string `json:"error"`
	Message    string `json:"message,omitempty"`
	StatusCode int    `json:"status_code"`
}

// SuccessResponse is a generic success response
type SuccessResponse struct {
	Success bool        `json:"success"`
	Data    interface{} `json:"data"`
	Message string      `json:"message,omitempty"`
}

// Login handles user login
// POST /api/v1/auth/login
func (h *AuthHandler) Login(w http.ResponseWriter, r *http.Request) {
	var req LoginRequest

	// Parse request body
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondJSON(w, http.StatusBadRequest, ErrorResponse{
			Error:      "Invalid request body",
			StatusCode: http.StatusBadRequest,
		})
		return
	}

	// Validate input
	if req.Email == "" || req.Password == "" {
		respondJSON(w, http.StatusBadRequest, ErrorResponse{
			Error:      "Email and password are required",
			StatusCode: http.StatusBadRequest,
		})
		return
	}

	// Authenticate
	loginResp, err := h.authService.Login(services.LoginRequest{
		Email:    req.Email,
		Password: req.Password,
	})
	if err != nil {
		respondJSON(w, http.StatusUnauthorized, ErrorResponse{
			Error:      "Authentication failed",
			Message:    err.Error(),
			StatusCode: http.StatusUnauthorized,
		})
		return
	}

	respondJSON(w, http.StatusOK, SuccessResponse{
		Success: true,
		Data:    loginResp,
		Message: "Login successful",
	})
}

// GetCurrentUser returns the current authenticated user
// GET /api/v1/auth/me
func (h *AuthHandler) GetCurrentUser(w http.ResponseWriter, r *http.Request) {
	// Get claims from context
	claims := middleware.GetClaimsFromContext(r)
	if claims == nil {
		respondJSON(w, http.StatusUnauthorized, ErrorResponse{
			Error:      "Not authenticated",
			StatusCode: http.StatusUnauthorized,
		})
		return
	}

	// Get user from service
	user, err := h.authService.GetCurrentUser(claims)
	if err != nil {
		respondJSON(w, http.StatusNotFound, ErrorResponse{
			Error:      "User not found",
			Message:    err.Error(),
			StatusCode: http.StatusNotFound,
		})
		return
	}

	respondJSON(w, http.StatusOK, SuccessResponse{
		Success: true,
		Data:    user,
	})
}

// Logout handles user logout
// POST /api/v1/auth/logout
func (h *AuthHandler) Logout(w http.ResponseWriter, r *http.Request) {
	// Get claims from context
	claims := middleware.GetClaimsFromContext(r)
	if claims == nil {
		respondJSON(w, http.StatusUnauthorized, ErrorResponse{
			Error:      "Not authenticated",
			StatusCode: http.StatusUnauthorized,
		})
		return
	}

	// In JWT-based auth, logout is handled on the client side (token deletion)
	// We can optionally invalidate tokens on the server side using a blacklist, but for MVP we'll keep it simple
	respondJSON(w, http.StatusOK, SuccessResponse{
		Success: true,
		Message: "Logout successful",
	})
}

// RefreshToken refreshes the user's JWT token
// POST /api/v1/auth/refresh
func (h *AuthHandler) RefreshToken(w http.ResponseWriter, r *http.Request) {
	// Get claims from context
	claims := middleware.GetClaimsFromContext(r)
	if claims == nil {
		respondJSON(w, http.StatusUnauthorized, ErrorResponse{
			Error:      "Not authenticated",
			StatusCode: http.StatusUnauthorized,
		})
		return
	}

	// Get the old token from Authorization header
	oldToken := r.Header.Get("Authorization")
	if oldToken == "" {
		respondJSON(w, http.StatusUnauthorized, ErrorResponse{
			Error:      "No token found",
			StatusCode: http.StatusUnauthorized,
		})
		return
	}

	// Extract token (remove "Bearer " prefix)
	if len(oldToken) > 7 {
		oldToken = oldToken[7:]
	}

	// Generate new token through auth service
	newToken, err := h.authService.RefreshToken(oldToken)
	if err != nil {
		respondJSON(w, http.StatusUnauthorized, ErrorResponse{
			Error:      "Failed to refresh token",
			Message:    err.Error(),
			StatusCode: http.StatusUnauthorized,
		})
		return
	}

	respondJSON(w, http.StatusOK, SuccessResponse{
		Success: true,
		Data: map[string]interface{}{
			"token": newToken,
		},
		Message: "Token refreshed",
	})
}

// ChangePassword handles password change
// POST /api/v1/auth/change-password
func (h *AuthHandler) ChangePassword(w http.ResponseWriter, r *http.Request) {
	var req ChangePasswordRequest

	// Get claims from context
	claims := middleware.GetClaimsFromContext(r)
	if claims == nil {
		respondJSON(w, http.StatusUnauthorized, ErrorResponse{
			Error:      "Not authenticated",
			StatusCode: http.StatusUnauthorized,
		})
		return
	}

	// Parse request body
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondJSON(w, http.StatusBadRequest, ErrorResponse{
			Error:      "Invalid request body",
			StatusCode: http.StatusBadRequest,
		})
		return
	}

	// Validate input
	if req.OldPassword == "" || req.NewPassword == "" {
		respondJSON(w, http.StatusBadRequest, ErrorResponse{
			Error:      "Old password and new password are required",
			StatusCode: http.StatusBadRequest,
		})
		return
	}

	// Validate password confirmation
	if req.NewPassword != req.ConfirmPassword {
		respondJSON(w, http.StatusBadRequest, ErrorResponse{
			Error:      "New password and confirmation do not match",
			StatusCode: http.StatusBadRequest,
		})
		return
	}

	// Change password
	if err := h.authService.ChangePassword(claims.UserID, req.OldPassword, req.NewPassword); err != nil {
		respondJSON(w, http.StatusBadRequest, ErrorResponse{
			Error:      "Failed to change password",
			Message:    err.Error(),
			StatusCode: http.StatusBadRequest,
		})
		return
	}

	respondJSON(w, http.StatusOK, SuccessResponse{
		Success: true,
		Message: "Password changed successfully",
	})
}

// Helper functions

// respondJSON writes a JSON response
func respondJSON(w http.ResponseWriter, status int, data interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(data)
}
