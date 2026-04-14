package main

import (
	"database/sql"
	"flag"
	"fmt"
	"io/ioutil"
	"log"
	"os"
	"path/filepath"

	_ "github.com/go-sql-driver/mysql"
	_ "github.com/mattn/go-sqlite3"
	"golang.org/x/crypto/bcrypt"
)

func main() {
	dbDriver := flag.String("driver", "sqlite", "Database driver: sqlite or mysql")
	dbPath := flag.String("path", "./data/posbengkel.db", "SQLite database path")
	dbHost := flag.String("host", "127.0.0.1", "MySQL host")
	dbPort := flag.String("port", "3306", "MySQL port")
	dbName := flag.String("database", "pos_bengkel_go_local", "MySQL database name")
	dbUser := flag.String("user", "root", "MySQL user")
	dbPassword := flag.String("password", "root", "MySQL password")
	password := flag.String("password-plain", "password123", "Password for admin user")
	email := flag.String("email", "admin@bengkel.local", "Email for admin user")
	flag.Parse()

	var db *sql.DB
	var err error

	if *dbDriver == "sqlite" {
		// Create data directory for SQLite
		dir := filepath.Dir(*dbPath)
		if err := createDir(dir); err != nil {
			log.Fatalf("Failed to create directory: %v", err)
		}

		// Connect to SQLite
		db, err = sql.Open("sqlite3", *dbPath)
		if err != nil {
			log.Fatalf("Failed to open SQLite database: %v", err)
		}
		defer db.Close()

		// Load schema migration
		schema, err := ioutil.ReadFile("migrations/001_init_sqlite.sql")
		if err != nil {
			log.Fatalf("Failed to read migration file: %v", err)
		}

		if _, err := db.Exec(string(schema)); err != nil {
			log.Printf("⚠ Schema might already exist (that's OK): %v", err)
		} else {
			log.Println("✓ Schema loaded successfully")
		}

		// Enable foreign keys in SQLite
		if _, err := db.Exec("PRAGMA foreign_keys = ON"); err != nil {
			log.Fatalf("Failed to enable foreign keys: %v", err)
		}
		log.Println("✓ Foreign keys enabled")
	} else {
		// Connect to MySQL
		dsn := fmt.Sprintf("%s:%s@tcp(%s:%s)/%s?parseTime=true&loc=Local",
			*dbUser, *dbPassword, *dbHost, *dbPort, *dbName)

		db, err = sql.Open("mysql", dsn)
		if err != nil {
			log.Fatalf("Failed to connect to MySQL: %v", err)
		}
		defer db.Close()
	}

	if err := db.Ping(); err != nil {
		log.Fatalf("Failed to ping database: %v", err)
	}
	log.Println("✓ Connected to database")

	// Hash password
	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(*password), bcrypt.DefaultCost)
	if err != nil {
		log.Fatalf("Failed to hash password: %v", err)
	}

	// Insert admin user (ignore if already exists)
	insertUserSQL := `INSERT OR IGNORE INTO users (id, email, password_hash, name, phone, avatar, is_active, created_at, updated_at) 
		VALUES (1, ?, ?, 'Admin User', '08123456789', '', 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`

	if *dbDriver == "mysql" {
		insertUserSQL = `INSERT IGNORE INTO users (id, email, password_hash, name, phone, avatar, is_active, created_at, updated_at) 
			VALUES (1, ?, ?, 'Admin User', '08123456789', '', 1, NOW(), NOW())`
	}

	result, err := db.Exec(insertUserSQL, *email, string(hashedPassword))
	if err != nil {
		log.Fatalf("Failed to insert admin user: %v", err)
	}

	rowsAffected, _ := result.RowsAffected()
	if rowsAffected > 0 {
		log.Printf("✓ Created admin user: %s (password: %s)", *email, *password)
	} else {
		log.Printf("⚠ Admin user already exists: %s", *email)
	}

	// Insert admin role (ignore if already exists)
	// Schema uses direct role field in user_roles table, not separate roles table
	insertRoleSQL := `INSERT OR IGNORE INTO user_roles (user_id, role) VALUES (1, 'admin')`
	if *dbDriver == "mysql" {
		insertRoleSQL = `INSERT IGNORE INTO user_roles (user_id, role) VALUES (1, 'admin')`
	}

	_, err = db.Exec(insertRoleSQL)
	if err != nil {
		log.Fatalf("Failed to assign admin role: %v", err)
	}
	log.Println("✓ Admin role assigned")

	// Note: No need for separate user_roles assignment as we already assigned the role above

	log.Println("\n✓ Setup complete!")
	log.Printf("\nLogin with:\n  Email: %s\n  Password: %s\n", *email, *password)
	if *dbDriver == "sqlite" {
		log.Printf("Database: %s\n", *dbPath)
	}
}

func createDir(dir string) error {
	if dir == "" || dir == "." {
		return nil
	}
	return os.MkdirAll(dir, 0755)
}
