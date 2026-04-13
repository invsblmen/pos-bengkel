package httpserver

import "database/sql"

func isSQLiteDB(db *sql.DB) bool {
	if db == nil {
		return false
	}

	var version string
	return db.QueryRow("SELECT sqlite_version()").Scan(&version) == nil
}

func isSQLiteTx(tx *sql.Tx) bool {
	if tx == nil {
		return false
	}

	var version string
	return tx.QueryRow("SELECT sqlite_version()").Scan(&version) == nil
}
