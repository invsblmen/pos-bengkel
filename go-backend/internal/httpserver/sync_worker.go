package httpserver

import (
	"database/sql"
	"log"
	"time"

	"posbengkel/go-backend/internal/config"
)

var syncWorkerSendBatch = syncSendBatchByID

// startSyncWorker is a lightweight background runner for pending sync batches.
// It is intentionally simple so we can harden retry/dead-letter/reconciliation in follow-up phases.
func startSyncWorker(db *sql.DB, cfg config.Config) {
	if db == nil {
		return
	}

	if !cfg.SyncEnabled || !cfg.SyncWorkerEnabled {
		return
	}

	interval := cfg.SyncWorkerInterval
	if interval < 5*time.Second {
		interval = 5 * time.Second
	}

	limit := cfg.SyncWorkerLimit
	if limit <= 0 {
		limit = 1
	}

	log.Printf("sync worker started: interval=%s limit=%d", interval, limit)

	go func() {
		runSyncWorkerTick(db, cfg, limit)

		ticker := time.NewTicker(interval)
		defer ticker.Stop()

		for range ticker.C {
			runSyncWorkerTick(db, cfg, limit)
		}
	}()
}

func runSyncWorkerTick(db *sql.DB, cfg config.Config, limit int) {
	batchIDs, err := selectPendingSyncBatchIDs(db, limit)
	if err != nil {
		log.Printf("sync worker tick failed to load batches: %v", err)
		return
	}

	if len(batchIDs) == 0 {
		return
	}

	for _, batchID := range batchIDs {
		if _, err := syncWorkerSendBatch(db, cfg, batchID); err != nil {
			log.Printf("sync worker failed batch %s: %v", batchID, err)
		}
	}
}

func selectPendingSyncBatchIDs(db *sql.DB, limit int) ([]string, error) {
	rows, err := db.Query(`
		SELECT sync_batch_id
		FROM sync_batches
		WHERE status IN ('pending', 'retrying', 'failed')
		ORDER BY created_at ASC
		LIMIT ?
	`, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	batchIDs := make([]string, 0, limit)
	for rows.Next() {
		var batchID string
		if err := rows.Scan(&batchID); err != nil {
			return nil, err
		}
		batchIDs = append(batchIDs, batchID)
	}

	if err := rows.Err(); err != nil {
		return nil, err
	}

	return batchIDs, nil
}
