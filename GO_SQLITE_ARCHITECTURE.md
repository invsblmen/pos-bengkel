# SQLite Configuration for GO Backend

> **Local-First Architecture**: GO backend uses SQLite for local-first, offline-capable workshop operations.

## Overview

GO backend supports **two database drivers**:
1. **MariaDB** (default) - Shared instance for sync with Laravel
2. **SQLite** (local) - Standalone instance for offline workstations

### Use Cases

| Scenario | Database | Path | Backend |
|----------|----------|------|---------|
| Cloud/Management center (online) | MariaDB | Laravel | PHP |
| Workshop local/offline | SQLite | GO | Go |
| Sync/Testing parity | Both | Dual | Both |

---

## Environment Configuration

### 1. GO Backend - Switch to SQLite

Edit `.env` in project root:

```env
# Option 1: Use SQLite (local-first)
GO_DATABASE_DRIVER=sqlite
GO_DATABASE_SQLITE_PATH=./data/posbengkel.db

# Option 2: Use MariaDB (shared, online)
GO_DATABASE_DRIVER=mysql
GO_DATABASE_HOST=127.0.0.1
GO_DATABASE_PORT=3306
GO_DATABASE_NAME=laravel12_pos_bengkel
GO_DATABASE_USER=root
GO_DATABASE_PASSWORD=root
```

### 2. GO Backend Code - Database Initialization

In `go-backend/internal/config/database.go`:

```go
package config

import (
    "database/sql"
    _ "github.com/mattn/go-sqlite3"
    _ "github.com/go-sql-driver/mysql"
)

func InitDatabase(cfg Config) (*sql.DB, error) {
    driver := cfg.DatabaseDriver // "sqlite" or "mysql"
    
    var dsn string
    switch driver {
    case "sqlite":
        dsn = cfg.DatabaseSQLitePath // "./data/posbengkel.db"
    case "mysql":
        dsn = fmt.Sprintf("%s:%s@tcp(%s:%s)/%s?parseTime=true",
            cfg.DatabaseUser,
            cfg.DatabasePassword,
            cfg.DatabaseHost,
            cfg.DatabasePort,
            cfg.DatabaseName,
        )
    default:
        return nil, fmt.Errorf("unsupported database driver: %s", driver)
    }
    
    db, err := sql.Open(driver, dsn)
    if err != nil {
        return nil, err
    }
    
    if err := db.Ping(); err != nil {
        return nil, err
    }
    
    return db, nil
}
```

### 3. Add Dependencies to go.mod

```bash
cd go-backend
go get github.com/mattn/go-sqlite3
go mod tidy
```

---

## Database Schema Migration

### From MariaDB → SQLite

SQLite has similar but slightly different DDL. Key differences:

| Feature | MariaDB | SQLite | Note |
|---------|---------|--------|------|
| Auto-increment | `AUTO_INCREMENT` | `AUTOINCREMENT` | Different keyword |
| Datetime | `DATETIME` | `TEXT` (RFC3339) | Store as ISO string |
| JSON | `JSON` | `TEXT` | Store as JSON string |
| ENUM | `ENUM('a','b')` | `TEXT` | Use CHECK constraint |
| Default timestamp | `DEFAULT CURRENT_TIMESTAMP` | `DEFAULT CURRENT_TIMESTAMP` | Same |
| Foreign keys | `FOREIGN KEY` | Need `PRAGMA foreign_keys=ON` | Enable explicitly |

### Migration Script Example

Create `go-backend/migrations/001_init_sqlite.sql`:

```sql
-- Enable foreign keys (SQLite)
PRAGMA foreign_keys = ON;

-- Customers table
CREATE TABLE IF NOT EXISTS customers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    phone TEXT,
    email TEXT,
    address TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- Vehicles table
-- NOTE: `km` is not stored on the vehicles table in the current schema.
-- Vehicle odometer (km) is computed from latest completed `service_orders.odometer_km`.
CREATE TABLE IF NOT EXISTS vehicles (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    customer_id INTEGER NOT NULL,
    plate_number TEXT UNIQUE NOT NULL,
    brand TEXT,
    model TEXT,
    year INTEGER,
    color TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE
);

-- Service Orders table
CREATE TABLE IF NOT EXISTS service_orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_number TEXT UNIQUE NOT NULL,
    customer_id INTEGER NOT NULL,
    vehicle_id INTEGER,
    mechanic_id INTEGER,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'paid', 'cancelled')),
    estimated_start_at TEXT,
    estimated_finish_at TEXT,
    actual_start_at TEXT,
    actual_finish_at TEXT,
    labor_cost REAL DEFAULT 0,
    material_cost REAL DEFAULT 0,
    discount_amount REAL DEFAULT 0,
    tax_amount REAL DEFAULT 0,
    total REAL DEFAULT 0,
    notes TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (customer_id) REFERENCES customers(id),
    FOREIGN KEY (vehicle_id) REFERENCES vehicles(id),
    FOREIGN KEY (mechanic_id) REFERENCES mechanics(id)
);

-- Create indexes for performance
CREATE INDEX idx_service_orders_customer_id ON service_orders(customer_id);
CREATE INDEX idx_service_orders_status ON service_orders(status);
CREATE INDEX idx_vehicles_customer_id ON vehicles(customer_id);
```

### Load Schema into SQLite

```bash
# Run migration
sqlite3 data/posbengkel.db < go-backend/migrations/001_init_sqlite.sql

# Verify
sqlite3 data/posbengkel.db ".tables"
sqlite3 data/posbengkel.db ".schema customers"
```

---

## Data Sync Strategy

### Scenario 1: Standalone GO (No Sync)

✅ **Best for**: Single workshop location, offline workstation

```
GO SQLite
   ↓
React Standalone SPA
   ↓
User (workshop mechanic)

No sync with Laravel/MariaDB
```

**Setup**:
1. Initialize GO SQLite with schema
2. Run `npm run dev` in go-frontend
3. Access `http://localhost:5174`
4. All data stored locally in SQLite

### Scenario 2: Hybrid (Periodic Sync)

✅ **Best for**: Multi-workshop, sync central database

```
GO SQLite ←→ Laravel MariaDB
   ↓            ↓
React SPA   Inertia React
   ↓            ↓
Local ops  Central mgmt
```

**Implementation** (TODO add sync service):
- Export endpoint: `/api/v1/sync/export` - GO → Laravel
- Import endpoint: `/api/v1/sync/import` - Laravel → GO (pull)
- Conflict resolution: Last-write-wins or custom logic

Example sync flow:
```bash
# Daily sync (midnight)
POST /api/v1/sync/export
→ Sends: new orders, updated status, new customers
→ Laravel receives: builds unified view

GET /api/v1/sync/import
→ Pulls: central policy updates, new mechanics, approved vouchers
→ GO stores: updated SQLite for next session
```

---

## Development Workflow

### 1. Start Full Stack (MySQL + Laravel + GO)

```bash
# Terminal 1: Laravel (port 8000)
php artisan serve --host=127.0.0.1 --port=8000

# Terminal 2: GO (port 8081 with MySQL)
cd go-backend
$env:GO_DATABASE_DRIVER='mysql'
$env:GO_DATABASE_HOST='127.0.0.1'
go run ./cmd/api

# Terminal 3: Laravel Frontend (port 5173)
npm run dev

# Result: Inertia React UI → Laravel/GO backend → MariaDB
```

### 2. Start Standalone GO (SQLite + React)

```bash
# Terminal 1: GO (port 8081 with SQLite)
cd go-backend
$env:GO_DATABASE_DRIVER='sqlite'
$env:GO_DATABASE_SQLITE_PATH='./data/posbengkel.db'
go run ./cmd/api

# Terminal 2: GO Frontend (port 5174)
cd go-frontend
npm run dev

# Result: React SPA → GO backend → SQLite
```

### 3. Run Tests

```bash
# Test with SQLite (isolated, no database cleanup needed)
cd go-backend
$env:GO_DATABASE_DRIVER='sqlite'
$env:GO_DATABASE_SQLITE_PATH=':memory:'  # In-memory for fast tests
go test ./...
```

---

## Troubleshooting

### SQLite: "database is locked"

**Cause**: Multiple processes writing simultaneously.

**Fix**:
```go
// In db connection pool config
db.SetMaxOpenConns(1)  // Single writer for SQLite
db.SetMaxIdleConns(1)
```

### SQLite: Foreign key constraint failed

**Fix**: Enable FK pragma in connection:
```sql
PRAGMA foreign_keys = ON;
```

### Data file too large

**Cleanup** (if unused):
```bash
rm data/posbengkel.db
```

---

## Performance Notes

### SQLite vs MariaDB

| Metric | SQLite | MariaDB | Best For |
|--------|--------|---------|----------|
| **Startup** | <100ms | 500ms+ | SQLite |
| **Queries** | Local disk | Network latency | SQLite |
| **Concurrency** | Low (1 writer) | High | MariaDB |
| **Storage** | File (portable) | Server (central) | SQLite for local |
| **Backups** | File copy | DB dump | SQLite |

**Recommendation**:
- ✅ Use **SQLite** for local development, offline workshops
- ✅ Use **MariaDB** for cloud/central management
- ⚠️ **Don't** use SQLite for high-concurrency scenarios

---

## Related Docs

- [GO Backend README](../go-backend/README.md)
- [GO Frontend README](../go-frontend/README.md)
- [Frontend Parity Matrix](../FRONTEND_PARITY_MATRIX.md)

