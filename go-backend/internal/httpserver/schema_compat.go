package httpserver

import (
	"database/sql"
	"fmt"
)

func tableColumnExists(db *sql.DB, table, column string) (bool, error) {
	if db == nil {
		return false, nil
	}

	if isSQLiteDB(db) {
		rows, err := db.Query(fmt.Sprintf("PRAGMA table_info(`%s`)", table))
		if err != nil {
			return false, err
		}
		defer rows.Close()

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
				return false, err
			}
			if name == column {
				return true, nil
			}
		}

		return false, rows.Err()
	}

	var count int
	err := db.QueryRow(`
		SELECT COUNT(*)
		FROM information_schema.columns
		WHERE table_schema = DATABASE()
		  AND table_name = ?
		  AND column_name = ?
	`, table, column).Scan(&count)
	if err != nil {
		return false, err
	}

	return count > 0, nil
}

type appointmentSchema struct {
	scheduledColumn string
	scheduledExpr   string
	scheduledDate   string
	specialtyExpr   string
	hasScheduledAt  bool
	hasStartAt      bool
	hasScheduledEnd bool
	hasServiceType  bool
}

func detectAppointmentSchema(db *sql.DB) (appointmentSchema, error) {
	schema := appointmentSchema{
		scheduledColumn: "scheduled_at",
		scheduledExpr:   "a.scheduled_at",
		scheduledDate:   "DATE(a.scheduled_at)",
		specialtyExpr:   "m.specialty",
	}

	hasScheduledAt, err := tableColumnExists(db, "appointments", "scheduled_at")
	if err != nil {
		return schema, err
	}
	hasScheduledStartAt, err := tableColumnExists(db, "appointments", "scheduled_start_at")
	if err != nil {
		return schema, err
	}
	hasScheduledEndAt, err := tableColumnExists(db, "appointments", "scheduled_end_at")
	if err != nil {
		return schema, err
	}
	hasServiceType, err := tableColumnExists(db, "appointments", "service_type")
	if err != nil {
		return schema, err
	}
	hasSpecialty, err := tableColumnExists(db, "mechanics", "specialty")
	if err != nil {
		return schema, err
	}
	hasSpecialization, err := tableColumnExists(db, "mechanics", "specialization")
	if err != nil {
		return schema, err
	}

	switch {
	case hasScheduledAt && hasScheduledStartAt:
		schema.scheduledExpr = "COALESCE(a.scheduled_at, a.scheduled_start_at)"
		schema.scheduledDate = "DATE(COALESCE(a.scheduled_at, a.scheduled_start_at))"
	case hasScheduledStartAt:
		schema.scheduledColumn = "scheduled_start_at"
		schema.scheduledExpr = "a.scheduled_start_at"
		schema.scheduledDate = "DATE(a.scheduled_start_at)"
	default:
		schema.scheduledColumn = "scheduled_at"
		schema.scheduledExpr = "a.scheduled_at"
		schema.scheduledDate = "DATE(a.scheduled_at)"
	}

	if hasSpecialization && !hasSpecialty {
		schema.specialtyExpr = "m.specialization"
	}

	schema.hasScheduledEnd = hasScheduledEndAt
	schema.hasServiceType = hasServiceType
	schema.hasScheduledAt = hasScheduledAt
	schema.hasStartAt = hasScheduledStartAt

	return schema, nil
}

func formatDateTimeExpr(db *sql.DB, expr string) string {
	if isSQLiteDB(db) {
		return fmt.Sprintf("STRFTIME('%%Y-%%m-%%d %%H:%%M:%%S', %s)", expr)
	}
	return fmt.Sprintf("DATE_FORMAT(%s, '%%Y-%%m-%%d %%H:%%i:%%s')", expr)
}
