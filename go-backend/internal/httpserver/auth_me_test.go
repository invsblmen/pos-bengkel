package httpserver

import (
	"context"
	"database/sql"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"posbengkel/go-backend/internal/middleware"
	"posbengkel/go-backend/internal/services"

	_ "github.com/mattn/go-sqlite3"
)

func setupAuthMeHandlerTestDB(t *testing.T) *sql.DB {
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

func execAuthMeStatements(t *testing.T, db *sql.DB, statements []string) {
	t.Helper()

	for _, stmt := range statements {
		if _, err := db.Exec(stmt); err != nil {
			t.Fatalf("exec statement failed: %v\nstatement: %s", err, stmt)
		}
	}
}

func TestAuthMeHandlerUnauthorizedWhenClaimsMissing(t *testing.T) {
	req := httptest.NewRequest(http.MethodGet, "/api/v1/auth/me", nil)
	rr := httptest.NewRecorder()

	handler := authMeHandler(nil)
	handler.ServeHTTP(rr, req)

	if rr.Code != http.StatusInternalServerError {
		t.Fatalf("expected %d, got %d", http.StatusInternalServerError, rr.Code)
	}
}

func TestAuthMeHandlerMethodNotAllowed(t *testing.T) {
	req := httptest.NewRequest(http.MethodPost, "/api/v1/auth/me", nil)
	rr := httptest.NewRecorder()

	handler := authMeHandler(nil)
	handler.ServeHTTP(rr, req)

	if rr.Code != http.StatusMethodNotAllowed {
		t.Fatalf("expected %d, got %d", http.StatusMethodNotAllowed, rr.Code)
	}
}

func TestAuthMeHandlerReturnsUserWithPermissions(t *testing.T) {
	db := setupAuthMeHandlerTestDB(t)
	execAuthMeStatements(t, db, []string{
		`CREATE TABLE users (id INTEGER PRIMARY KEY, email TEXT NOT NULL, password_hash TEXT NOT NULL, name TEXT NOT NULL, phone TEXT, avatar TEXT, is_active INTEGER, last_login_at DATETIME, created_at DATETIME, updated_at DATETIME);`,
		`CREATE TABLE roles (id INTEGER PRIMARY KEY, name TEXT NOT NULL);`,
		`CREATE TABLE permissions (id INTEGER PRIMARY KEY, name TEXT NOT NULL);`,
		`CREATE TABLE model_has_roles (role_id INTEGER NOT NULL, model_id INTEGER NOT NULL, model_type TEXT NOT NULL);`,
		`CREATE TABLE role_has_permissions (permission_id INTEGER NOT NULL, role_id INTEGER NOT NULL);`,
		`CREATE TABLE model_has_permissions (permission_id INTEGER NOT NULL, model_id INTEGER NOT NULL, model_type TEXT NOT NULL);`,
		`INSERT INTO users (id, email, password_hash, name, phone, avatar, is_active, created_at, updated_at) VALUES (7, 'cashier@test.local', 'hashed', 'Cashier', '08123', '', 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);`,
		`INSERT INTO roles (id, name) VALUES (11, 'cashier');`,
		`INSERT INTO permissions (id, name) VALUES (3, 'part-sales-access');`,
		`INSERT INTO model_has_roles (role_id, model_id, model_type) VALUES (11, 7, 'App\\Models\\User');`,
		`INSERT INTO role_has_permissions (permission_id, role_id) VALUES (3, 11);`,
	})

	authSvc := services.NewAuthService(db, nil, nil)
	req := httptest.NewRequest(http.MethodGet, "/api/v1/auth/me", nil)
	req = req.WithContext(context.WithValue(req.Context(), middleware.ContextUserKey, &services.TokenClaims{UserID: 7}))
	rr := httptest.NewRecorder()

	handler := authMeHandler(authSvc)
	handler.ServeHTTP(rr, req)

	if rr.Code != http.StatusOK {
		t.Fatalf("expected %d, got %d", http.StatusOK, rr.Code)
	}

	body := rr.Body.String()
	if !strings.Contains(body, `"roles":["cashier"]`) {
		t.Fatalf("expected roles in response body, got: %s", body)
	}

	if !strings.Contains(body, `"permissions":["part-sales-access"]`) {
		t.Fatalf("expected permissions in response body, got: %s", body)
	}
}
