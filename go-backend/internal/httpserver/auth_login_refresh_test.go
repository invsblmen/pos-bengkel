package httpserver

import (
	"context"
	"database/sql"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"posbengkel/go-backend/internal/middleware"
	"posbengkel/go-backend/internal/services"

	_ "github.com/mattn/go-sqlite3"
)

func setupAuthLoginRefreshTestDB(t *testing.T) *sql.DB {
	t.Helper()

	db, err := sql.Open("sqlite3", ":memory:")
	if err != nil {
		t.Fatalf("open sqlite: %v", err)
	}

	t.Cleanup(func() {
		_ = db.Close()
	})

	return db
}

func execAuthLoginRefreshStatements(t *testing.T, db *sql.DB, statements []string) {
	t.Helper()

	for _, stmt := range statements {
		if _, err := db.Exec(stmt); err != nil {
			t.Fatalf("exec statement failed: %v\nstatement: %s", err, stmt)
		}
	}
}

func TestAuthLoginHandlerSuccessReturnsPermissions(t *testing.T) {
	db := setupAuthLoginRefreshTestDB(t)
	passwordSvc := services.NewPasswordService(8, false, false, false)
	hash, err := passwordSvc.HashPassword("password123")
	if err != nil {
		t.Fatalf("hash password failed: %v", err)
	}

	execAuthLoginRefreshStatements(t, db, []string{
		`CREATE TABLE users (id INTEGER PRIMARY KEY, email TEXT NOT NULL, password_hash TEXT NOT NULL, name TEXT NOT NULL, phone TEXT, avatar TEXT, is_active INTEGER, last_login_at DATETIME, created_at DATETIME, updated_at DATETIME);`,
		`CREATE TABLE roles (id INTEGER PRIMARY KEY, name TEXT NOT NULL);`,
		`CREATE TABLE permissions (id INTEGER PRIMARY KEY, name TEXT NOT NULL);`,
		`CREATE TABLE model_has_roles (role_id INTEGER NOT NULL, model_id INTEGER NOT NULL, model_type TEXT NOT NULL);`,
		`CREATE TABLE role_has_permissions (permission_id INTEGER NOT NULL, role_id INTEGER NOT NULL);`,
		`CREATE TABLE model_has_permissions (permission_id INTEGER NOT NULL, model_id INTEGER NOT NULL, model_type TEXT NOT NULL);`,
		`INSERT INTO users (id, email, password_hash, name, phone, avatar, is_active, created_at, updated_at) VALUES (1, 'admin@test.local', '` + hash + `', 'Admin', '', '', 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);`,
		`INSERT INTO roles (id, name) VALUES (10, 'admin');`,
		`INSERT INTO permissions (id, name) VALUES (2, 'reports-access');`,
		`INSERT INTO model_has_roles (role_id, model_id, model_type) VALUES (10, 1, 'App\\Models\\User');`,
		`INSERT INTO role_has_permissions (permission_id, role_id) VALUES (2, 10);`,
	})

	tokenSvc := services.NewTokenService("secret", "issuer", "audience", time.Hour)
	authSvc := services.NewAuthService(db, tokenSvc, passwordSvc)

	req := httptest.NewRequest(http.MethodPost, "/api/v1/auth/login", strings.NewReader(`{"email":"admin@test.local","password":"password123"}`))
	rr := httptest.NewRecorder()

	handler := authLoginHandler(authSvc)
	handler.ServeHTTP(rr, req)

	if rr.Code != http.StatusOK {
		t.Fatalf("expected %d, got %d", http.StatusOK, rr.Code)
	}

	body := rr.Body.String()
	if !strings.Contains(body, `"token":`) {
		t.Fatalf("expected token in response body, got: %s", body)
	}

	if !strings.Contains(body, `"permissions":["reports-access"]`) {
		t.Fatalf("expected permissions in response body, got: %s", body)
	}
}

func TestAuthLoginHandlerUnauthorizedOnInvalidPassword(t *testing.T) {
	db := setupAuthLoginRefreshTestDB(t)
	passwordSvc := services.NewPasswordService(8, false, false, false)
	hash, err := passwordSvc.HashPassword("password123")
	if err != nil {
		t.Fatalf("hash password failed: %v", err)
	}

	execAuthLoginRefreshStatements(t, db, []string{
		`CREATE TABLE users (id INTEGER PRIMARY KEY, email TEXT NOT NULL, password_hash TEXT NOT NULL, name TEXT NOT NULL, phone TEXT, avatar TEXT, is_active INTEGER, last_login_at DATETIME, created_at DATETIME, updated_at DATETIME);`,
		`INSERT INTO users (id, email, password_hash, name, phone, avatar, is_active, created_at, updated_at) VALUES (1, 'admin@test.local', '` + hash + `', 'Admin', '', '', 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);`,
	})

	tokenSvc := services.NewTokenService("secret", "issuer", "audience", time.Hour)
	authSvc := services.NewAuthService(db, tokenSvc, passwordSvc)

	req := httptest.NewRequest(http.MethodPost, "/api/v1/auth/login", strings.NewReader(`{"email":"admin@test.local","password":"wrong"}`))
	rr := httptest.NewRecorder()

	handler := authLoginHandler(authSvc)
	handler.ServeHTTP(rr, req)

	if rr.Code != http.StatusUnauthorized {
		t.Fatalf("expected %d, got %d", http.StatusUnauthorized, rr.Code)
	}
}

func TestAuthRefreshHandlerReturnsNewToken(t *testing.T) {
	tokenSvc := services.NewTokenService("secret", "issuer", "audience", time.Hour)
	req := httptest.NewRequest(http.MethodPost, "/api/v1/auth/refresh", nil)
	req = req.WithContext(context.WithValue(req.Context(), middleware.ContextUserKey, &services.TokenClaims{
		UserID: 1,
		Email:  "admin@test.local",
		Roles:  []string{"admin"},
	}))
	rr := httptest.NewRecorder()

	handler := authRefreshHandler(tokenSvc)
	handler.ServeHTTP(rr, req)

	if rr.Code != http.StatusOK {
		t.Fatalf("expected %d, got %d", http.StatusOK, rr.Code)
	}

	if !strings.Contains(rr.Body.String(), `"token":`) {
		t.Fatalf("expected token in response body, got: %s", rr.Body.String())
	}
}

func TestAuthRefreshHandlerUnauthorizedWhenClaimsMissing(t *testing.T) {
	tokenSvc := services.NewTokenService("secret", "issuer", "audience", time.Hour)
	req := httptest.NewRequest(http.MethodPost, "/api/v1/auth/refresh", nil)
	rr := httptest.NewRecorder()

	handler := authRefreshHandler(tokenSvc)
	handler.ServeHTTP(rr, req)

	if rr.Code != http.StatusUnauthorized {
		t.Fatalf("expected %d, got %d", http.StatusUnauthorized, rr.Code)
	}
}
