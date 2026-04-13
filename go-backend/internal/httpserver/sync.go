package httpserver

import (
	"bytes"
	"crypto/rand"
	"crypto/sha256"
	"database/sql"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"sort"
	"strings"
	"time"

	"posbengkel/go-backend/internal/config"
	"posbengkel/go-backend/internal/events"
)

var syncSnapshotTables = []string{
	"customers",
	"vehicles",
	"mechanics",
	"suppliers",
	"parts",
	"part_categories",
	"part_sales_orders",
	"appointments",
}

var syncDeltaTables = []string{
	"service_orders",
	"service_order_details",
	"part_purchases",
	"part_purchase_details",
	"part_sales",
	"part_sale_details",
	"part_stock_movements",
	"cash_transactions",
	"appointments",
}

var syncAllowedTables = func() map[string]struct{} {
	allowed := make(map[string]struct{}, len(syncSnapshotTables)+len(syncDeltaTables))
	for _, table := range syncSnapshotTables {
		allowed[table] = struct{}{}
	}
	for _, table := range syncDeltaTables {
		allowed[table] = struct{}{}
	}
	return allowed
}()

type syncCreateRequest struct {
	Scope      string   `json:"scope"`
	SourceDate string   `json:"source_date"`
	Tables     []string `json:"tables"`
}

type syncBatchRecord struct {
	ID               int64           `json:"id"`
	SyncBatchID      string          `json:"sync_batch_id"`
	Scope            string          `json:"scope"`
	PayloadType      string          `json:"payload_type"`
	SourceDate       sql.NullString  `json:"-"`
	SourceWorkshopID sql.NullString  `json:"-"`
	PayloadHash      string          `json:"payload_hash"`
	Status           string          `json:"status"`
	AttemptCount     int             `json:"attempt_count"`
	LastAttemptAt    sql.NullTime    `json:"-"`
	AcknowledgedAt   sql.NullTime    `json:"-"`
	SentAt           sql.NullTime    `json:"-"`
	LastError        sql.NullString  `json:"-"`
	ItemsCount       int             `json:"items_count"`
	PayloadJSON      json.RawMessage `json:"payload_json,omitempty"`
	ResponseJSON     json.RawMessage `json:"response_json,omitempty"`
	CreatedAt        time.Time       `json:"created_at"`
	UpdatedAt        time.Time       `json:"updated_at"`
}

type syncItemRecord struct {
	ID           int64           `json:"id"`
	SyncBatchID  string          `json:"sync_batch_id"`
	EntityType   string          `json:"entity_type"`
	EntityID     string          `json:"entity_id"`
	EventType    string          `json:"event_type"`
	PayloadHash  string          `json:"payload_hash"`
	Status       string          `json:"status"`
	AttemptCount int             `json:"attempt_count"`
	LastError    sql.NullString  `json:"-"`
	PayloadJSON  json.RawMessage `json:"payload_json"`
	CreatedAt    time.Time       `json:"created_at"`
	UpdatedAt    time.Time       `json:"updated_at"`
}

func ensureSyncSchema(db *sql.DB, driver string) error {
	statements := mysqlSyncSchemaStatements()
	if driver == "sqlite" {
		statements = sqliteSyncSchemaStatements()
	}

	for _, statement := range statements {
		if _, err := db.Exec(statement); err != nil {
			return err
		}
	}

	return nil
}

func mysqlSyncSchemaStatements() []string {
	return []string{
		`CREATE TABLE IF NOT EXISTS sync_batches (
			id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
			sync_batch_id CHAR(36) NOT NULL UNIQUE,
			scope VARCHAR(50) NOT NULL,
			payload_type VARCHAR(100) NOT NULL,
			source_date DATE NULL,
			source_workshop_id VARCHAR(100) NULL,
			payload_hash VARCHAR(255) NOT NULL,
			payload_json JSON NULL,
			response_json JSON NULL,
			status ENUM('pending', 'sent', 'acknowledged', 'failed', 'retrying') NOT NULL DEFAULT 'pending',
			attempt_count INT UNSIGNED NOT NULL DEFAULT 0,
			last_attempt_at DATETIME NULL,
			acknowledged_at DATETIME NULL,
			sent_at DATETIME NULL,
			last_error TEXT NULL,
			created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
			updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
			INDEX sync_batches_scope_date_idx (scope, source_date),
			INDEX sync_batches_status_idx (status)
		) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
		`CREATE TABLE IF NOT EXISTS sync_outbox_items (
			id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
			sync_batch_id CHAR(36) NOT NULL,
			entity_type VARCHAR(100) NOT NULL,
			entity_id VARCHAR(100) NOT NULL,
			event_type VARCHAR(50) NOT NULL,
			payload JSON NOT NULL,
			payload_hash VARCHAR(255) NOT NULL,
			status ENUM('pending', 'locked', 'sent', 'failed') NOT NULL DEFAULT 'pending',
			attempt_count INT UNSIGNED NOT NULL DEFAULT 0,
			last_attempt_at DATETIME NULL,
			last_error TEXT NULL,
			created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
			updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
			INDEX sync_outbox_batch_status_idx (sync_batch_id, status),
			INDEX sync_outbox_entity_idx (entity_type, entity_id),
			INDEX sync_outbox_payload_idx (payload_hash)
		) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
	}
}

func sqliteSyncSchemaStatements() []string {
	return []string{
		`CREATE TABLE IF NOT EXISTS sync_batches (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			sync_batch_id TEXT NOT NULL UNIQUE,
			scope TEXT NOT NULL,
			payload_type TEXT NOT NULL,
			source_date TEXT NULL,
			source_workshop_id TEXT NULL,
			payload_hash TEXT NOT NULL,
			payload_json TEXT NULL,
			response_json TEXT NULL,
			status TEXT NOT NULL DEFAULT 'pending',
			attempt_count INTEGER NOT NULL DEFAULT 0,
			last_attempt_at TEXT NULL,
			acknowledged_at TEXT NULL,
			sent_at TEXT NULL,
			last_error TEXT NULL,
			created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
			updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
		)`,
		`CREATE INDEX IF NOT EXISTS sync_batches_scope_date_idx ON sync_batches(scope, source_date)`,
		`CREATE INDEX IF NOT EXISTS sync_batches_status_idx ON sync_batches(status)`,
		`CREATE TABLE IF NOT EXISTS sync_outbox_items (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			sync_batch_id TEXT NOT NULL,
			entity_type TEXT NOT NULL,
			entity_id TEXT NOT NULL,
			event_type TEXT NOT NULL,
			payload TEXT NOT NULL,
			payload_hash TEXT NOT NULL,
			status TEXT NOT NULL DEFAULT 'pending',
			attempt_count INTEGER NOT NULL DEFAULT 0,
			last_attempt_at TEXT NULL,
			last_error TEXT NULL,
			created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
			updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
		)`,
		`CREATE INDEX IF NOT EXISTS sync_outbox_batch_status_idx ON sync_outbox_items(sync_batch_id, status)`,
		`CREATE INDEX IF NOT EXISTS sync_outbox_entity_idx ON sync_outbox_items(entity_type, entity_id)`,
		`CREATE INDEX IF NOT EXISTS sync_outbox_payload_idx ON sync_outbox_items(payload_hash)`,
	}
}

func syncStatusHandler(db *sql.DB, cfg config.Config) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if db == nil {
			writeJSON(w, http.StatusServiceUnavailable, response{"message": "database is not configured"})
			return
		}

		batchCount, pendingCount, failedCount, acknowledgedCount, err := syncStatusCounts(db)
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, response{"message": "failed to read sync status", "error": err.Error()})
			return
		}

		lastBatch, err := syncLatestBatch(db)
		if err != nil && !errors.Is(err, sql.ErrNoRows) {
			writeJSON(w, http.StatusInternalServerError, response{"message": "failed to read last sync batch", "error": err.Error()})
			return
		}

		writeJSON(w, http.StatusOK, response{
			"sync_enabled": cfg.SyncEnabled,
			"host_url":     cfg.SyncHostURL,
			"source_id":    cfg.SyncSourceID,
			"schema_ready": true,
			"summary": response{
				"batch_total":        batchCount,
				"pending_total":      pendingCount,
				"failed_total":       failedCount,
				"acknowledged_total": acknowledgedCount,
			},
			"last_batch": lastBatch,
		})
	}
}

func syncBatchesIndexHandler(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if db == nil {
			writeJSON(w, http.StatusServiceUnavailable, response{"message": "database is not configured"})
			return
		}

		rows, err := db.Query(`
			SELECT id, sync_batch_id, scope, payload_type, source_date, source_workshop_id, payload_hash,
				status, attempt_count, last_attempt_at, acknowledged_at, sent_at, last_error,
				payload_json, response_json, created_at, updated_at,
				(SELECT COUNT(*) FROM sync_outbox_items soi WHERE soi.sync_batch_id = sync_batches.sync_batch_id) AS items_count
			FROM sync_batches
			ORDER BY created_at DESC
			LIMIT 50
		`)
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, response{"message": "failed to read sync batches", "error": err.Error()})
			return
		}
		defer rows.Close()

		batches := make([]response, 0)
		for rows.Next() {
			item, err := scanSyncBatchRow(rows)
			if err != nil {
				writeJSON(w, http.StatusInternalServerError, response{"message": "failed to read sync batch row", "error": err.Error()})
				return
			}
			batches = append(batches, item)
		}

		writeJSON(w, http.StatusOK, response{"batches": batches})
	}
}

func syncCreateBatchHandler(db *sql.DB, cfg config.Config) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		sourceDate, scope, tables, err := syncParseCreateRequest(r)
		if err != nil {
			writeJSON(w, http.StatusBadRequest, response{"message": err.Error()})
			return
		}

		batch, err := syncBuildBatch(db, cfg, scope, sourceDate, tables)
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, response{"message": "failed to build sync batch", "error": err.Error()})
			return
		}

		writeJSON(w, http.StatusCreated, response{"batch": batch})
	}
}

func syncRunHandler(db *sql.DB, cfg config.Config) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		sourceDate, scope, tables, err := syncParseCreateRequest(r)
		if err != nil {
			writeJSON(w, http.StatusBadRequest, response{"message": err.Error()})
			return
		}

		batch, err := syncBuildBatch(db, cfg, scope, sourceDate, tables)
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, response{"message": "failed to build sync batch", "error": err.Error()})
			return
		}

		result, err := syncSendBatchByID(db, cfg, batch["sync_batch_id"].(string))
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, response{"message": "failed to send sync batch", "error": err.Error(), "batch": batch})
			EmitEvent(events.NewEvent(events.EventSyncBatchFailed, events.DomainSync).
				WithID(fmt.Sprint(batch["sync_batch_id"])).
				WithAction("batch_failed").
				WithData(response{"error": err.Error()}))
			return
		}

		writeJSON(w, http.StatusOK, response{"batch": batch, "send_result": result})
		EmitEvent(events.NewEvent(events.EventSyncBatchCompleted, events.DomainSync).
			WithID(fmt.Sprint(batch["sync_batch_id"])).
			WithAction("batch_completed").
			WithData(response{"result": result}))
	}
}

func syncSendBatchHandler(db *sql.DB, cfg config.Config) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		batchID := strings.TrimSpace(r.PathValue("id"))
		if batchID == "" {
			writeJSON(w, http.StatusBadRequest, response{"message": "sync batch id is required"})
			return
		}

		result, err := syncSendBatchByID(db, cfg, batchID)
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, response{"message": "failed to send sync batch", "error": err.Error()})
			EmitEvent(events.NewEvent(events.EventSyncBatchFailed, events.DomainSync).
				WithID(batchID).
				WithAction("batch_failed").
				WithData(response{"error": err.Error()}))
			return
		}

		writeJSON(w, http.StatusOK, response{"result": result})
		EmitEvent(events.NewEvent(events.EventSyncBatchCompleted, events.DomainSync).
			WithID(batchID).
			WithAction("batch_sent").
			WithData(response{"result": result}))
	}
}

func syncRetryBatchHandler(db *sql.DB, cfg config.Config) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		batchID := strings.TrimSpace(r.PathValue("id"))
		if batchID == "" {
			writeJSON(w, http.StatusBadRequest, response{"message": "sync batch id is required"})
			return
		}

		result, err := syncSendBatchByID(db, cfg, batchID)
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, response{"message": "failed to retry sync batch", "error": err.Error()})
			EmitEvent(events.NewEvent(events.EventSyncBatchFailed, events.DomainSync).
				WithID(batchID).
				WithAction("batch_retry_failed").
				WithData(response{"error": err.Error()}))
			return
		}

		writeJSON(w, http.StatusOK, response{"result": result})
		EmitEvent(events.NewEvent(events.EventSyncBatchCompleted, events.DomainSync).
			WithID(batchID).
			WithAction("batch_retry_completed").
			WithData(response{"result": result}))
	}
}

func syncParseCreateRequest(r *http.Request) (time.Time, string, []string, error) {
	var payload syncCreateRequest
	if r.Body != nil {
		if err := json.NewDecoder(r.Body).Decode(&payload); err != nil && !errors.Is(err, io.EOF) {
			return time.Time{}, "", nil, fmt.Errorf("invalid request body: %w", err)
		}
	}

	scope := strings.TrimSpace(payload.Scope)
	if scope == "" {
		scope = "daily"
	}

	var sourceDate time.Time
	if strings.TrimSpace(payload.SourceDate) == "" {
		sourceDate = time.Now().Local()
	} else {
		parsedDate, err := time.Parse("2006-01-02", payload.SourceDate)
		if err != nil {
			return time.Time{}, "", nil, fmt.Errorf("invalid source_date: %w", err)
		}
		sourceDate = parsedDate
	}

	tables := sanitizeSyncTables(payload.Tables)
	if len(tables) == 0 {
		tables = syncDefaultTables(scope)
	}

	return sourceDate, scope, tables, nil
}

func syncBuildBatch(db *sql.DB, cfg config.Config, scope string, sourceDate time.Time, tables []string) (response, error) {
	if db == nil {
		return nil, errors.New("database is not configured")
	}

	if !cfg.SyncEnabled {
		return nil, errors.New("sync is disabled")
	}

	items := make([]response, 0)
	for _, table := range tables {
		rows, err := syncCollectRows(db, table, sourceDate, scope)
		if err != nil {
			return nil, fmt.Errorf("collect rows for %s: %w", table, err)
		}

		for _, row := range rows {
			entityID := syncResolveEntityID(row)
			payload, err := syncItemPayload(table, scope, sourceDate, row)
			if err != nil {
				return nil, err
			}

			payloadJSON, err := json.Marshal(payload)
			if err != nil {
				return nil, err
			}

			items = append(items, response{
				"entity_type":  table,
				"entity_id":    entityID,
				"event_type":   "upsert",
				"payload":      payload,
				"payload_hash": hashJSON(payloadJSON),
			})
		}
	}

	if len(items) == 0 {
		return nil, errors.New("no rows found for selected sync range")
	}

	batchID := newSyncBatchID()
	batchPayload := response{
		"sync_batch_id":      batchID,
		"source_workshop_id": cfg.SyncSourceID,
		"scope":              scope,
		"payload_type":       "daily_snapshot",
		"source_date":        sourceDate.Format("2006-01-02"),
		"payload_hash":       "",
		"items":              items,
		"generated_at":       time.Now().Format(time.RFC3339),
		"schema_version":     1,
		"source_system":      "go-backend",
		"source_timezone":    time.Now().Format("MST"),
	}

	payloadJSON, err := json.Marshal(batchPayload)
	if err != nil {
		return nil, err
	}
	batchPayload["payload_hash"] = hashJSON(payloadJSON)

	if _, err := db.Exec(`
		INSERT INTO sync_batches (
			sync_batch_id, scope, payload_type, source_date, source_workshop_id, payload_hash,
			payload_json, status, attempt_count, created_at, updated_at
		) VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
	`, batchID, scope, "daily_snapshot", sourceDate.Format("2006-01-02"), cfg.SyncSourceID, batchPayload["payload_hash"], string(payloadJSON)); err != nil {
		return nil, err
	}

	for _, item := range items {
		payloadMap := item["payload"]
		payloadBytes, err := json.Marshal(payloadMap)
		if err != nil {
			return nil, err
		}

		if _, err := db.Exec(`
			INSERT INTO sync_outbox_items (
				sync_batch_id, entity_type, entity_id, event_type, payload, payload_hash,
				status, attempt_count, created_at, updated_at
			) VALUES (?, ?, ?, ?, ?, ?, 'pending', 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
		`, batchID, item["entity_type"], fmt.Sprint(item["entity_id"]), item["event_type"], string(payloadBytes), item["payload_hash"]); err != nil {
			return nil, err
		}
	}

	return response{
		"sync_batch_id":      batchID,
		"source_workshop_id": cfg.SyncSourceID,
		"scope":              scope,
		"payload_type":       "daily_snapshot",
		"source_date":        sourceDate.Format("2006-01-02"),
		"payload_hash":       batchPayload["payload_hash"],
		"items_count":        len(items),
		"items":              items,
	}, nil
}

func syncSendBatchByID(db *sql.DB, cfg config.Config, batchID string) (response, error) {
	if db == nil {
		return nil, errors.New("database is not configured")
	}
	if !cfg.SyncEnabled {
		return nil, errors.New("sync is disabled")
	}
	if strings.TrimSpace(cfg.SyncSharedToken) == "" {
		return nil, errors.New("sync token is not configured")
	}

	batch, err := syncLoadBatch(db, batchID)
	if err != nil {
		return nil, err
	}

	items, err := syncLoadBatchItems(db, batchID)
	if err != nil {
		return nil, err
	}
	if len(items) == 0 {
		return nil, errors.New("batch has no outbox items")
	}

	payload := response{
		"sync_batch_id":      batch["sync_batch_id"],
		"source_workshop_id": cfg.SyncSourceID,
		"scope":              batch["scope"],
		"payload_type":       batch["payload_type"],
		"source_date":        batch["source_date"],
		"payload_hash":       batch["payload_hash"],
		"items":              items,
	}

	payloadBytes, err := json.Marshal(payload)
	if err != nil {
		return nil, err
	}

	now := time.Now()
	if _, err := db.Exec(`
		UPDATE sync_batches
		SET status = 'sent', attempt_count = attempt_count + 1, last_attempt_at = ?, sent_at = ?, last_error = NULL, updated_at = CURRENT_TIMESTAMP
		WHERE sync_batch_id = ?
	`, now, now, batchID); err != nil {
		return nil, err
	}

	client := &http.Client{Timeout: cfg.SyncRequestTimeout}
	hostURL := strings.TrimRight(cfg.SyncHostURL, "/")
	request, err := http.NewRequest(http.MethodPost, hostURL+"/api/sync/batches", bytes.NewReader(payloadBytes))
	if err != nil {
		return nil, err
	}
	request.Header.Set("Content-Type", "application/json")
	request.Header.Set("X-Sync-Token", cfg.SyncSharedToken)

	responseBody, err := client.Do(request)
	if err != nil {
		_, _ = db.Exec(`
			UPDATE sync_batches
			SET status = 'failed', last_error = ?, updated_at = CURRENT_TIMESTAMP
			WHERE sync_batch_id = ?
		`, err.Error(), batchID)
		return nil, err
	}
	defer responseBody.Body.Close()

	bodyBytes, _ := io.ReadAll(responseBody.Body)
	result := response{
		"http_status": responseBody.StatusCode,
		"body":        string(bodyBytes),
	}

	if responseBody.StatusCode < http.StatusOK || responseBody.StatusCode >= http.StatusMultipleChoices {
		_, _ = db.Exec(`
			UPDATE sync_batches
			SET status = 'failed', last_error = ?, response_json = ?, updated_at = CURRENT_TIMESTAMP
			WHERE sync_batch_id = ?
		`, fmt.Sprintf("hosting returned HTTP %d", responseBody.StatusCode), string(bodyBytes), batchID)
		return result, fmt.Errorf("hosting returned HTTP %d", responseBody.StatusCode)
	}

	if _, err := db.Exec(`
		UPDATE sync_batches
		SET status = 'acknowledged', acknowledged_at = ?, response_json = ?, last_error = NULL, updated_at = CURRENT_TIMESTAMP
		WHERE sync_batch_id = ?
	`, now, string(bodyBytes), batchID); err != nil {
		return nil, err
	}
	if _, err := db.Exec(`
		UPDATE sync_outbox_items
		SET status = 'sent', attempt_count = attempt_count + 1, last_attempt_at = ?, last_error = NULL, updated_at = CURRENT_TIMESTAMP
		WHERE sync_batch_id = ?
	`, now, batchID); err != nil {
		return nil, err
	}

	result["status"] = "acknowledged"
	result["batch"] = batch
	return result, nil
}

func syncLoadBatch(db *sql.DB, batchID string) (response, error) {
	row := db.QueryRow(`
		SELECT sync_batch_id, scope, payload_type, source_date, source_workshop_id, payload_hash, status,
			attempt_count, last_attempt_at, acknowledged_at, sent_at, last_error
		FROM sync_batches
		WHERE sync_batch_id = ?
		LIMIT 1
	`, batchID)

	var syncBatchID, scope, payloadType, payloadHash, status string
	var sourceDate, sourceWorkshopID, lastError sql.NullString
	var attemptCount int
	var lastAttemptAt, acknowledgedAt, sentAt sql.NullTime
	if err := row.Scan(&syncBatchID, &scope, &payloadType, &sourceDate, &sourceWorkshopID, &payloadHash, &status, &attemptCount, &lastAttemptAt, &acknowledgedAt, &sentAt, &lastError); err != nil {
		return nil, err
	}

	return response{
		"sync_batch_id":      syncBatchID,
		"scope":              scope,
		"payload_type":       payloadType,
		"source_date":        sourceDate.String,
		"source_workshop_id": sourceWorkshopID.String,
		"payload_hash":       payloadHash,
		"status":             status,
		"attempt_count":      attemptCount,
		"last_error":         lastError.String,
		"last_attempt_at":    nullTimeToString(lastAttemptAt),
		"acknowledged_at":    nullTimeToString(acknowledgedAt),
		"sent_at":            nullTimeToString(sentAt),
	}, nil
}

func syncLoadBatchItems(db *sql.DB, batchID string) ([]response, error) {
	rows, err := db.Query(`
		SELECT entity_type, entity_id, event_type, payload_hash, payload
		FROM sync_outbox_items
		WHERE sync_batch_id = ?
		ORDER BY id ASC
	`, batchID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	items := make([]response, 0)
	for rows.Next() {
		var entityType, entityID, eventType, payloadHash string
		var payloadJSON []byte
		if err := rows.Scan(&entityType, &entityID, &eventType, &payloadHash, &payloadJSON); err != nil {
			return nil, err
		}

		var payload any
		if len(payloadJSON) > 0 {
			if err := json.Unmarshal(payloadJSON, &payload); err != nil {
				return nil, err
			}
		}

		items = append(items, response{
			"entity_type":  entityType,
			"entity_id":    entityID,
			"event_type":   eventType,
			"payload_hash": payloadHash,
			"payload":      payload,
		})
	}

	return items, rows.Err()
}

func syncLatestBatch(db *sql.DB) (response, error) {
	rows, err := db.Query(`
		SELECT id, sync_batch_id, scope, payload_type, source_date, source_workshop_id, payload_hash,
			status, attempt_count, last_attempt_at, acknowledged_at, sent_at, last_error,
				payload_json, response_json, created_at, updated_at,
				(SELECT COUNT(*) FROM sync_outbox_items soi WHERE soi.sync_batch_id = sync_batches.sync_batch_id) AS items_count
		FROM sync_batches
		ORDER BY created_at DESC
		LIMIT 1
	`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	if !rows.Next() {
		return nil, sql.ErrNoRows
	}

	return scanSyncBatchRow(rows)
}

func syncStatusCounts(db *sql.DB) (int, int, int, int, error) {
	var batchTotal, pendingTotal, failedTotal, acknowledgedTotal int
	if err := db.QueryRow(`SELECT COUNT(*) FROM sync_batches`).Scan(&batchTotal); err != nil {
		return 0, 0, 0, 0, err
	}
	if err := db.QueryRow(`SELECT COUNT(*) FROM sync_batches WHERE status IN ('pending', 'retrying')`).Scan(&pendingTotal); err != nil {
		return 0, 0, 0, 0, err
	}
	if err := db.QueryRow(`SELECT COUNT(*) FROM sync_batches WHERE status = 'failed'`).Scan(&failedTotal); err != nil {
		return 0, 0, 0, 0, err
	}
	if err := db.QueryRow(`SELECT COUNT(*) FROM sync_batches WHERE status = 'acknowledged'`).Scan(&acknowledgedTotal); err != nil {
		return 0, 0, 0, 0, err
	}
	return batchTotal, pendingTotal, failedTotal, acknowledgedTotal, nil
}

func scanSyncBatchRow(rows *sql.Rows) (response, error) {
	var (
		id             int64
		syncBatchID    string
		scope          string
		payloadType    string
		sourceDate     sql.NullString
		sourceWorkshop sql.NullString
		payloadHash    string
		status         string
		attemptCount   int
		lastAttemptAt  sql.NullTime
		acknowledgedAt sql.NullTime
		sentAt         sql.NullTime
		lastError      sql.NullString
		payloadJSON    []byte
		responseJSON   []byte
		createdAt      time.Time
		updatedAt      time.Time
		itemsCount     int
	)

	if err := rows.Scan(&id, &syncBatchID, &scope, &payloadType, &sourceDate, &sourceWorkshop, &payloadHash, &status, &attemptCount, &lastAttemptAt, &acknowledgedAt, &sentAt, &lastError, &payloadJSON, &responseJSON, &createdAt, &updatedAt, &itemsCount); err != nil {
		return nil, err
	}

	result := response{
		"id":                 id,
		"sync_batch_id":      syncBatchID,
		"scope":              scope,
		"payload_type":       payloadType,
		"source_date":        sourceDate.String,
		"source_workshop_id": sourceWorkshop.String,
		"payload_hash":       payloadHash,
		"status":             status,
		"attempt_count":      attemptCount,
		"last_attempt_at":    nullTimeToString(lastAttemptAt),
		"acknowledged_at":    nullTimeToString(acknowledgedAt),
		"sent_at":            nullTimeToString(sentAt),
		"last_error":         lastError.String,
		"created_at":         createdAt.Format(time.RFC3339),
		"updated_at":         updatedAt.Format(time.RFC3339),
		"items_count":        itemsCount,
	}

	if len(payloadJSON) > 0 {
		result["payload_json"] = json.RawMessage(payloadJSON)
	}
	if len(responseJSON) > 0 {
		result["response_json"] = json.RawMessage(responseJSON)
	}

	return result, nil
}

func syncCollectRows(db *sql.DB, table string, sourceDate time.Time, scope string) ([]map[string]any, error) {
	if _, ok := syncAllowedTables[table]; !ok {
		return nil, fmt.Errorf("table %s is not allowed for sync", table)
	}

	orderClause := "ORDER BY id ASC"
	var query string
	args := []any{}

	if containsString(syncSnapshotTables, table) {
		query = fmt.Sprintf("SELECT * FROM `%s` %s", table, orderClause)
	} else {
		columnStrategy, err := syncDateColumnStrategy(db, table)
		if err != nil {
			return nil, err
		}

		dateExpr := columnStrategy
		if dateExpr == "" {
			query = fmt.Sprintf("SELECT * FROM `%s` %s", table, orderClause)
		} else {
			query = fmt.Sprintf("SELECT * FROM `%s` WHERE DATE(%s) = ? %s", table, dateExpr, orderClause)
			args = append(args, sourceDate.Format("2006-01-02"))
		}
	}

	rows, err := db.Query(query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	columns, err := rows.Columns()
	if err != nil {
		return nil, err
	}

	items := make([]map[string]any, 0)
	for rows.Next() {
		values := make([]any, len(columns))
		dest := make([]any, len(columns))
		for i := range values {
			dest[i] = &values[i]
		}

		if err := rows.Scan(dest...); err != nil {
			return nil, err
		}

		item := make(map[string]any, len(columns))
		for i, column := range columns {
			item[column] = normalizeDBValue(values[i])
		}
		items = append(items, item)
	}

	return items, rows.Err()
}

func syncDateColumnStrategy(db *sql.DB, table string) (string, error) {
	rows, err := db.Query(`
		SELECT column_name
		FROM information_schema.columns
		WHERE table_schema = DATABASE()
		  AND table_name = ?
		  AND column_name IN ('updated_at', 'created_at')
		ORDER BY FIELD(column_name, 'updated_at', 'created_at')
	`, table)
	if err != nil {
		return syncDateColumnStrategySQLiteFallback(db, table)
	}
	defer rows.Close()

	columns := make([]string, 0, 2)
	for rows.Next() {
		var column string
		if err := rows.Scan(&column); err != nil {
			return "", err
		}
		columns = append(columns, column)
	}

	if len(columns) == 0 {
		return syncDateColumnStrategySQLiteFallback(db, table)
	}
	if containsString(columns, "updated_at") && containsString(columns, "created_at") {
		return "COALESCE(updated_at, created_at)", nil
	}
	return columns[0], nil
}

func syncDateColumnStrategySQLiteFallback(db *sql.DB, table string) (string, error) {
	rows, err := db.Query(fmt.Sprintf("PRAGMA table_info(`%s`)", table))
	if err != nil {
		return "", err
	}
	defer rows.Close()

	columns := make([]string, 0, 2)
	for rows.Next() {
		var (
			cid        int
			name       string
			columnType string
			notNull    int
			defaultVal sql.NullString
			pk         int
		)

		if err := rows.Scan(&cid, &name, &columnType, &notNull, &defaultVal, &pk); err != nil {
			return "", err
		}

		if name == "updated_at" || name == "created_at" {
			columns = append(columns, name)
		}
	}

	if len(columns) == 0 {
		return "", nil
	}
	if containsString(columns, "updated_at") && containsString(columns, "created_at") {
		return "COALESCE(updated_at, created_at)", nil
	}
	return columns[0], nil
}

func syncItemPayload(table string, scope string, sourceDate time.Time, row map[string]any) (map[string]any, error) {
	payload := map[string]any{
		"table":       table,
		"scope":       scope,
		"source_date": sourceDate.Format("2006-01-02"),
		"record":      row,
		"synced_at":   time.Now().Format(time.RFC3339),
	}

	return payload, nil
}

func syncResolveEntityID(row map[string]any) string {
	if value, ok := row["id"]; ok {
		return fmt.Sprint(value)
	}
	for key, value := range row {
		if strings.HasSuffix(strings.ToLower(key), "_id") {
			return fmt.Sprint(value)
		}
	}
	return "0"
}

func sanitizeSyncTables(tables []string) []string {
	if len(tables) == 0 {
		return nil
	}

	filtered := make([]string, 0, len(tables))
	seen := make(map[string]struct{}, len(tables))
	for _, table := range tables {
		table = strings.TrimSpace(strings.ToLower(table))
		if table == "" {
			continue
		}
		if _, ok := syncAllowedTables[table]; !ok {
			continue
		}
		if _, exists := seen[table]; exists {
			continue
		}
		seen[table] = struct{}{}
		filtered = append(filtered, table)
	}

	sort.Strings(filtered)
	return filtered
}

func syncDefaultTables(scope string) []string {
	if strings.EqualFold(scope, "manual") {
		return append([]string{}, syncSnapshotTables...)
	}

	combined := make([]string, 0, len(syncSnapshotTables)+len(syncDeltaTables))
	combined = append(combined, syncSnapshotTables...)
	combined = append(combined, syncDeltaTables...)
	return sanitizeSyncTables(combined)
}

func containsString(values []string, needle string) bool {
	for _, value := range values {
		if value == needle {
			return true
		}
	}
	return false
}

func normalizeDBValue(value any) any {
	switch typed := value.(type) {
	case nil:
		return nil
	case []byte:
		return string(typed)
	case time.Time:
		return typed.Format(time.RFC3339)
	case json.RawMessage:
		return string(typed)
	default:
		return typed
	}
}

func nullTimeToString(value sql.NullTime) string {
	if !value.Valid {
		return ""
	}
	return value.Time.Format(time.RFC3339)
}

func hashJSON(data []byte) string {
	sum := sha256.Sum256(data)
	return hex.EncodeToString(sum[:])
}

func newSyncBatchID() string {
	var raw [16]byte
	if _, err := rand.Read(raw[:]); err != nil {
		return fmt.Sprintf("sync-%d", time.Now().UnixNano())
	}

	raw[6] = (raw[6] & 0x0f) | 0x40
	raw[8] = (raw[8] & 0x3f) | 0x80

	return fmt.Sprintf("%08x-%04x-%04x-%04x-%012x",
		raw[0:4],
		raw[4:6],
		raw[6:8],
		raw[8:10],
		raw[10:16],
	)
}
