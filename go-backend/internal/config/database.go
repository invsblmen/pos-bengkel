package config

import (
	"database/sql"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"time"

	_ "github.com/mattn/go-sqlite3"
)

// DatabaseConfig holds database connection settings
type DatabaseConfig struct {
	Driver          string // sqlite
	SQLitePath      string
	MaxOpenConns    int
	MaxIdleConns    int
	ConnMaxLifetime time.Duration
	ConnMaxIdleTime time.Duration
}

// NewDatabaseConfig creates DatabaseConfig from environment
func NewDatabaseConfig() DatabaseConfig {
	driver := os.Getenv("GO_DATABASE_DRIVER")
	if driver == "" {
		driver = "sqlite"
	}

	return DatabaseConfig{
		Driver:          driver,
		SQLitePath:      resolveSQLitePath(os.Getenv("GO_DATABASE_SQLITE_PATH")),
		MaxOpenConns:    5,
		MaxIdleConns:    2,
		ConnMaxLifetime: time.Hour,
		ConnMaxIdleTime: time.Minute * 10,
	}
}

func resolveSQLitePath(rawPath string) string {
	path := strings.TrimSpace(rawPath)
	if path == "" {
		path = "./data/posbengkel.db"
	}

	if filepath.IsAbs(path) {
		return filepath.Clean(path)
	}

	// Prefer existing file in current cwd, then fallback to workspace-root style path.
	candidates := []string{
		filepath.Clean(path),
		filepath.Clean(filepath.Join("go-backend", path)),
	}

	for _, candidate := range candidates {
		if _, err := os.Stat(candidate); err == nil {
			return candidate
		}
	}

	return candidates[0]
}

// BuildDSN constructs the database connection string
func (c DatabaseConfig) BuildDSN() (string, error) {
	if c.Driver != "sqlite" {
		return "", fmt.Errorf("unsupported database driver: %s", c.Driver)
	}

	if c.SQLitePath == "" {
		c.SQLitePath = "./data/posbengkel.db"
	}

	return c.SQLitePath, nil
}

// InitDatabase opens database connection and validates it
func (c DatabaseConfig) InitDatabase() (*sql.DB, error) {
	dsn, err := c.BuildDSN()
	if err != nil {
		return nil, err
	}

	if err := os.MkdirAll(filepath.Dir(dsn), 0755); err != nil && filepath.Dir(dsn) != "." {
		return nil, fmt.Errorf("failed to create sqlite directory: %w", err)
	}

	db, err := sql.Open("sqlite3", dsn)
	if err != nil {
		return nil, fmt.Errorf("failed to open database: %w", err)
	}

	// SQLite performs better and more predictably with a single writer connection.
	db.SetMaxOpenConns(1)
	db.SetMaxIdleConns(1)

	db.SetConnMaxLifetime(c.ConnMaxLifetime)
	db.SetConnMaxIdleTime(c.ConnMaxIdleTime)

	// Test connection
	if err := db.Ping(); err != nil {
		return nil, fmt.Errorf("failed to ping database: %w", err)
	}

	// SQLite pragmas for integrity and local performance.
	pragmas := []string{
		"PRAGMA foreign_keys = ON",
		"PRAGMA journal_mode = WAL",
		"PRAGMA synchronous = NORMAL",
		"PRAGMA temp_store = MEMORY",
		"PRAGMA busy_timeout = 5000",
	}
	for _, pragma := range pragmas {
		if _, err := db.Exec(pragma); err != nil {
			return nil, fmt.Errorf("failed to apply sqlite pragma %q: %w", pragma, err)
		}
	}

	return db, nil
}

// MustInitDatabase wraps InitDatabase and panics on error
func (c DatabaseConfig) MustInitDatabase() *sql.DB {
	db, err := c.InitDatabase()
	if err != nil {
		panic(fmt.Sprintf("Failed to initialize database: %v", err))
	}
	return db
}
