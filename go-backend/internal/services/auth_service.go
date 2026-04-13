package services

import (
	"database/sql"
	"errors"
	"strings"
	"time"
)

// AuthService handles authentication operations
type AuthService struct {
	db              *sql.DB
	tokenService    *TokenService
	passwordService *PasswordService
}

// LoginRequest contains login credentials
type LoginRequest struct {
	Email    string `json:"email" binding:"required,email"`
	Password string `json:"password" binding:"required"`
}

// LoginResponse contains the response after successful login
type LoginResponse struct {
	Token     string        `json:"token"`
	ExpiresAt int64         `json:"expires_at"`
	User      *UserResponse `json:"user"`
}

// UserResponse contains user information
type UserResponse struct {
	ID          int64    `json:"id"`
	Email       string   `json:"email"`
	Name        string   `json:"name"`
	Phone       string   `json:"phone"`
	Avatar      string   `json:"avatar,omitempty"`
	Roles       []string `json:"roles"`
	Permissions []string `json:"permissions"`
}

// User represents a user from the database
type User struct {
	ID           int64
	Email        string
	PasswordHash string
	Name         string
	Phone        string
	Avatar       string
	IsActive     bool
	LastLoginAt  *time.Time
	CreatedAt    time.Time
	UpdatedAt    time.Time
}

// NewAuthService creates a new auth service
func NewAuthService(db *sql.DB, tokenService *TokenService, passwordService *PasswordService) *AuthService {
	return &AuthService{
		db:              db,
		tokenService:    tokenService,
		passwordService: passwordService,
	}
}

// Login authenticates a user and returns a token
func (as *AuthService) Login(req LoginRequest) (*LoginResponse, error) {
	// Fetch user by email
	user, err := as.getUserByEmail(req.Email)
	if err != nil {
		// Log failed attempt
		as.logLoginAttempt(req.Email, false, "user not found")
		return nil, errors.New("invalid email or password")
	}

	// Check if account is active
	if !user.IsActive {
		as.logLoginAttempt(req.Email, false, "account disabled")
		return nil, errors.New("account is disabled")
	}

	// Verify password
	if !as.passwordService.VerifyPassword(user.PasswordHash, req.Password) {
		as.logLoginAttempt(req.Email, false, "password mismatch")
		return nil, errors.New("invalid email or password")
	}

	// Get user roles
	roles, err := as.getUserRoles(user.ID)
	if err != nil {
		return nil, errors.New("failed to retrieve user roles")
	}

	permissions, err := as.getUserPermissions(user.ID)
	if err != nil {
		return nil, errors.New("failed to retrieve user permissions")
	}

	// Generate token
	token, err := as.tokenService.GenerateToken(user.ID, user.Email, roles)
	if err != nil {
		return nil, errors.New("failed to generate token")
	}

	// Update last login time
	_ = as.updateLastLogin(user.ID)

	// Log successful login
	as.logLoginAttempt(user.Email, true, "")

	// Get token expiry time
	expiresAt := time.Now().Add(24 * time.Hour).Unix() // Default 24 hours

	return &LoginResponse{
		Token:     token,
		ExpiresAt: expiresAt,
		User: &UserResponse{
			ID:          user.ID,
			Email:       user.Email,
			Name:        user.Name,
			Phone:       user.Phone,
			Avatar:      user.Avatar,
			Roles:       roles,
			Permissions: permissions,
		},
	}, nil
}

// ChangePassword changes a user's password
func (as *AuthService) ChangePassword(userID int64, oldPassword, newPassword string) error {
	if newPassword == "" {
		return errors.New("new password cannot be empty")
	}

	// Fetch user
	user, err := as.getUserByID(userID)
	if err != nil {
		return errors.New("user not found")
	}

	// Verify old password
	if !as.passwordService.VerifyPassword(user.PasswordHash, oldPassword) {
		return errors.New("current password is incorrect")
	}

	// Validate new password
	if err := as.passwordService.ValidatePassword(newPassword); err != nil {
		return err
	}

	// Hash new password
	hashedPassword, err := as.passwordService.HashPassword(newPassword)
	if err != nil {
		return errors.New("failed to hash new password")
	}

	// Update password in database
	_, err = as.db.Exec(
		"UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?",
		hashedPassword,
		time.Now(),
		userID,
	)
	if err != nil && strings.Contains(strings.ToLower(err.Error()), "unknown column") {
		_, err = as.db.Exec(
			"UPDATE users SET password = ?, updated_at = ? WHERE id = ?",
			hashedPassword,
			time.Now(),
			userID,
		)
	}

	return err
}

// ResetPassword resets a user's password (admin/recovery flow)
func (as *AuthService) ResetPassword(userID int64, newPassword string) error {
	if newPassword == "" {
		return errors.New("new password cannot be empty")
	}

	// Validate password
	if err := as.passwordService.ValidatePassword(newPassword); err != nil {
		return err
	}

	// Hash password
	hashedPassword, err := as.passwordService.HashPassword(newPassword)
	if err != nil {
		return errors.New("failed to hash password")
	}

	// Update password
	_, err = as.db.Exec(
		"UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?",
		hashedPassword,
		time.Now(),
		userID,
	)
	if err != nil && strings.Contains(strings.ToLower(err.Error()), "unknown column") {
		_, err = as.db.Exec(
			"UPDATE users SET password = ?, updated_at = ? WHERE id = ?",
			hashedPassword,
			time.Now(),
			userID,
		)
	}

	return err
}

// GetCurrentUser retrieves the current user from token claims
func (as *AuthService) GetCurrentUser(claims *TokenClaims) (*UserResponse, error) {
	user, err := as.getUserByID(claims.UserID)
	if err != nil {
		return nil, err
	}

	roles, err := as.getUserRoles(user.ID)
	if err != nil {
		return nil, err
	}

	permissions, err := as.getUserPermissions(user.ID)
	if err != nil {
		return nil, err
	}

	return &UserResponse{
		ID:          user.ID,
		Email:       user.Email,
		Name:        user.Name,
		Phone:       user.Phone,
		Avatar:      user.Avatar,
		Roles:       roles,
		Permissions: permissions,
	}, nil
}

// RefreshToken issues a new token from an existing valid token.
func (as *AuthService) RefreshToken(oldToken string) (string, error) {
	return as.tokenService.RefreshToken(oldToken)
}

// Helper methods (private)

func (as *AuthService) getUserByEmail(email string) (*User, error) {
	user := &User{}
	err := as.db.QueryRow(
		`SELECT id, email, password_hash, name, COALESCE(phone, ''), COALESCE(avatar, ''), COALESCE(is_active, 1), last_login_at, created_at, updated_at
		 FROM users WHERE email = ?`,
		email,
	).Scan(
		&user.ID, &user.Email, &user.PasswordHash, &user.Name, &user.Phone,
		&user.Avatar, &user.IsActive, &user.LastLoginAt, &user.CreatedAt, &user.UpdatedAt,
	)

	if err != nil && strings.Contains(strings.ToLower(err.Error()), "unknown column") {
		err = as.db.QueryRow(
			`SELECT id, email, password, name, '' AS phone, '' AS avatar, 1 AS is_active, NULL AS last_login_at, created_at, updated_at
			 FROM users WHERE email = ?`,
			email,
		).Scan(
			&user.ID, &user.Email, &user.PasswordHash, &user.Name, &user.Phone,
			&user.Avatar, &user.IsActive, &user.LastLoginAt, &user.CreatedAt, &user.UpdatedAt,
		)
	}

	if err != nil {
		if err == sql.ErrNoRows {
			return nil, errors.New("user not found")
		}
		return nil, err
	}

	return user, nil
}

func (as *AuthService) getUserByID(userID int64) (*User, error) {
	user := &User{}
	err := as.db.QueryRow(
		`SELECT id, email, password_hash, name, COALESCE(phone, ''), COALESCE(avatar, ''), COALESCE(is_active, 1), last_login_at, created_at, updated_at
		 FROM users WHERE id = ?`,
		userID,
	).Scan(
		&user.ID, &user.Email, &user.PasswordHash, &user.Name, &user.Phone,
		&user.Avatar, &user.IsActive, &user.LastLoginAt, &user.CreatedAt, &user.UpdatedAt,
	)

	if err != nil && strings.Contains(strings.ToLower(err.Error()), "unknown column") {
		err = as.db.QueryRow(
			`SELECT id, email, password, name, '' AS phone, '' AS avatar, 1 AS is_active, NULL AS last_login_at, created_at, updated_at
			 FROM users WHERE id = ?`,
			userID,
		).Scan(
			&user.ID, &user.Email, &user.PasswordHash, &user.Name, &user.Phone,
			&user.Avatar, &user.IsActive, &user.LastLoginAt, &user.CreatedAt, &user.UpdatedAt,
		)
	}

	if err != nil {
		if err == sql.ErrNoRows {
			return nil, errors.New("user not found")
		}
		return nil, err
	}

	return user, nil
}

func (as *AuthService) getUserRoles(userID int64) ([]string, error) {
	rows, err := as.db.Query(
		"SELECT role FROM user_roles WHERE user_id = ? ORDER BY role",
		userID,
	)
	if err != nil {
		errLower := strings.ToLower(err.Error())
		if strings.Contains(errLower, "doesn't exist") || strings.Contains(errLower, "no such table") {
			return as.getUserRolesFromSpatie(userID)
		}
		return []string{}, err
	}
	defer rows.Close()

	var roles []string
	for rows.Next() {
		var role string
		if err := rows.Scan(&role); err != nil {
			return []string{}, err
		}
		roles = append(roles, role)
	}

	if len(roles) == 0 {
		// Default role if none assigned
		roles = []string{"customer"}
	}

	return roles, rows.Err()
}

func (as *AuthService) getUserRolesFromSpatie(userID int64) ([]string, error) {
	rows, err := as.db.Query(
		`SELECT r.name
		 FROM model_has_roles mhr
		 JOIN roles r ON r.id = mhr.role_id
		 WHERE mhr.model_id = ?
		   AND mhr.model_type = 'App\\Models\\User'
		 ORDER BY r.name`,
		userID,
	)
	if err != nil {
		errLower := strings.ToLower(err.Error())
		if strings.Contains(errLower, "unknown column") || strings.Contains(errLower, "no such column") {
			rows, err = as.db.Query(
				`SELECT r.name
			 FROM model_has_roles mhr
			 JOIN roles r ON r.id = mhr.role_id
			 WHERE mhr.model_id = ?
			 ORDER BY r.name`,
				userID,
			)
		}
	}
	if err != nil {
		errLower := strings.ToLower(err.Error())
		if strings.Contains(errLower, "doesn't exist") || strings.Contains(errLower, "no such table") {
			return []string{"customer"}, nil
		}
		return []string{}, err
	}
	defer rows.Close()

	var roles []string
	for rows.Next() {
		var role string
		if err := rows.Scan(&role); err != nil {
			return []string{}, err
		}
		roles = append(roles, role)
	}

	if len(roles) == 0 {
		roles = []string{"customer"}
	}

	return roles, rows.Err()
}

func (as *AuthService) getUserPermissions(userID int64) ([]string, error) {
	rows, err := as.db.Query(
		`SELECT DISTINCT p.name
		 FROM model_has_permissions mhp
		 JOIN permissions p ON p.id = mhp.permission_id
		 WHERE mhp.model_id = ?
		   AND mhp.model_type = 'App\\Models\\User'
		 UNION
		 SELECT DISTINCT p.name
		 FROM model_has_roles mhr
		 JOIN role_has_permissions rhp ON rhp.role_id = mhr.role_id
		 JOIN permissions p ON p.id = rhp.permission_id
		 WHERE mhr.model_id = ?
		   AND mhr.model_type = 'App\\Models\\User'
		 ORDER BY name`,
		userID,
		userID,
	)
	if err != nil {
		errLower := strings.ToLower(err.Error())
		if strings.Contains(errLower, "unknown column") || strings.Contains(errLower, "no such column") {
			rows, err = as.db.Query(
				`SELECT DISTINCT p.name
			 FROM model_has_permissions mhp
			 JOIN permissions p ON p.id = mhp.permission_id
			 WHERE mhp.model_id = ?
			 UNION
			 SELECT DISTINCT p.name
			 FROM model_has_roles mhr
			 JOIN role_has_permissions rhp ON rhp.role_id = mhr.role_id
			 JOIN permissions p ON p.id = rhp.permission_id
			 WHERE mhr.model_id = ?
			 ORDER BY name`,
				userID,
				userID,
			)
		}
	}
	if err != nil {
		errLower := strings.ToLower(err.Error())
		if strings.Contains(errLower, "doesn't exist") || strings.Contains(errLower, "no such table") {
			return []string{}, nil
		}
		return []string{}, err
	}
	defer rows.Close()

	permissions := []string{}
	for rows.Next() {
		var permission string
		if err := rows.Scan(&permission); err != nil {
			return []string{}, err
		}
		permissions = append(permissions, permission)
	}

	return permissions, rows.Err()
}

func (as *AuthService) updateLastLogin(userID int64) error {
	_, err := as.db.Exec(
		"UPDATE users SET last_login_at = ?, updated_at = ? WHERE id = ?",
		time.Now(),
		time.Now(),
		userID,
	)
	if err != nil && strings.Contains(strings.ToLower(err.Error()), "unknown column") {
		_, err = as.db.Exec(
			"UPDATE users SET updated_at = ? WHERE id = ?",
			time.Now(),
			userID,
		)
	}
	return err
}

func (as *AuthService) logLoginAttempt(email string, success bool, reason string) error {
	statusStr := "failed"
	if success {
		statusStr = "success"
	}

	var userID *int64
	if user, err := as.getUserByEmail(email); err == nil {
		userID = &user.ID
	}

	_, err := as.db.Exec(
		`INSERT INTO login_audits (user_id, email, status, reason, attempted_at) 
		 VALUES (?, ?, ?, ?, ?)`,
		userID, email, statusStr, reason, time.Now(),
	)
	if err != nil {
		errLower := strings.ToLower(err.Error())
		if strings.Contains(errLower, "doesn't exist") || strings.Contains(errLower, "no such table") {
			return nil
		}
	}
	return err
}
