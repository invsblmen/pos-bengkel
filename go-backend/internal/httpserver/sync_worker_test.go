package httpserver

import (
	"database/sql"
	"errors"
	"reflect"
	"testing"
	"time"

	"posbengkel/go-backend/internal/config"

	sqlmock "github.com/DATA-DOG/go-sqlmock"
)

func setupSyncWorkerMockDB(t *testing.T) (sqlmock.Sqlmock, *sql.DB) {
	t.Helper()

	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("create sqlmock db: %v", err)
	}

	t.Cleanup(func() {
		_ = db.Close()
	})

	return mock, db
}

func TestSelectPendingSyncBatchIDsRespectsStatusAndLimit(t *testing.T) {
	mock, db := setupSyncWorkerMockDB(t)

	rows := sqlmock.NewRows([]string{"sync_batch_id"})
	rows.AddRow("b1")
	rows.AddRow("b2")

	mock.ExpectQuery("SELECT sync_batch_id").WithArgs(2).WillReturnRows(rows)

	got, err := selectPendingSyncBatchIDs(db, 2)
	if err != nil {
		t.Fatalf("selectPendingSyncBatchIDs: %v", err)
	}

	want := []string{"b1", "b2"}
	if !reflect.DeepEqual(got, want) {
		t.Fatalf("unexpected batch ids, want=%v got=%v", want, got)
	}

	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("unmet sql expectations: %v", err)
	}
}

func TestRunSyncWorkerTickCallsSenderForSelectedBatches(t *testing.T) {
	mock, db := setupSyncWorkerMockDB(t)

	rows := sqlmock.NewRows([]string{"sync_batch_id"})
	rows.AddRow("b1")
	rows.AddRow("b2")
	rows.AddRow("b3")

	mock.ExpectQuery("SELECT sync_batch_id").WithArgs(3).WillReturnRows(rows)

	orig := syncWorkerSendBatch
	t.Cleanup(func() {
		syncWorkerSendBatch = orig
	})

	called := make([]string, 0)
	syncWorkerSendBatch = func(db *sql.DB, cfg config.Config, batchID string) (response, error) {
		called = append(called, batchID)
		if batchID == "b2" {
			return nil, errors.New("synthetic send failure")
		}
		return response{"ok": true}, nil
	}

	runSyncWorkerTick(db, config.Config{}, 3)

	want := []string{"b1", "b2", "b3"}
	if !reflect.DeepEqual(called, want) {
		t.Fatalf("unexpected call order, want=%v got=%v", want, called)
	}

	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("unmet sql expectations: %v", err)
	}
}

func TestStartSyncWorkerNoopWhenDisabled(t *testing.T) {
	_, db := setupSyncWorkerMockDB(t)

	orig := syncWorkerSendBatch
	t.Cleanup(func() {
		syncWorkerSendBatch = orig
	})

	called := false
	syncWorkerSendBatch = func(db *sql.DB, cfg config.Config, batchID string) (response, error) {
		called = true
		return response{"ok": true}, nil
	}

	startSyncWorker(db, config.Config{
		SyncEnabled:       true,
		SyncWorkerEnabled: false,
	})

	if called {
		t.Fatalf("sync worker sender should not be called when worker is disabled")
	}
}

func TestStartSyncWorkerEnabledTriggersInitialSend(t *testing.T) {
	mock, db := setupSyncWorkerMockDB(t)

	rows := sqlmock.NewRows([]string{"sync_batch_id"})
	rows.AddRow("batch-initial")
	mock.ExpectQuery("SELECT sync_batch_id").WithArgs(1).WillReturnRows(rows)

	orig := syncWorkerSendBatch
	t.Cleanup(func() {
		syncWorkerSendBatch = orig
	})

	called := make(chan string, 1)
	syncWorkerSendBatch = func(db *sql.DB, cfg config.Config, batchID string) (response, error) {
		called <- batchID
		return response{"ok": true}, nil
	}

	startSyncWorker(db, config.Config{
		SyncEnabled:        true,
		SyncWorkerEnabled:  true,
		SyncWorkerInterval: 10 * time.Second,
		SyncWorkerLimit:    1,
	})

	select {
	case got := <-called:
		if got != "batch-initial" {
			t.Fatalf("unexpected batch sent, want=batch-initial got=%s", got)
		}
	case <-time.After(300 * time.Millisecond):
		t.Fatalf("expected initial sync worker send but timed out")
	}

	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("unmet sql expectations: %v", err)
	}
}
