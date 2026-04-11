package httpserver

import (
	"context"
	"database/sql"
	"encoding/json"
	"log"
	"net/http"
	"time"

	"posbengkel/go-backend/internal/config"
	"posbengkel/go-backend/internal/middleware"

	_ "github.com/go-sql-driver/mysql"
)

type response map[string]any

func New(cfg config.Config) (*http.Server, error) {
	var db *sql.DB
	if cfg.DBName != "" && cfg.DBUser != "" {
		dsn := dsnFromConfig(cfg.DBHost, cfg.DBPort, cfg.DBUser, cfg.DBPassword, cfg.DBName, cfg.DBParams)
		openedDB, err := sql.Open("mysql", dsn)
		if err == nil {
			ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
			defer cancel()
			if pingErr := openedDB.PingContext(ctx); pingErr == nil {
				db = openedDB
			} else {
				_ = openedDB.Close()
				log.Printf("database connection is unavailable, running in degraded mode: %v", pingErr)
			}
		} else {
			log.Printf("database open failed, running in degraded mode: %v", err)
		}
	}

	if db != nil {
		if err := ensureSyncSchema(db); err != nil {
			log.Printf("sync schema bootstrap failed, running without database: %v", err)
			_ = db.Close()
			db = nil
		}
	}

	mux := http.NewServeMux()

	mux.HandleFunc("GET /health", func(w http.ResponseWriter, r *http.Request) {
		writeJSON(w, http.StatusOK, response{"status": "ok", "service": cfg.AppName})
	})

	mux.HandleFunc("GET /ready", func(w http.ResponseWriter, r *http.Request) {
		writeJSON(w, http.StatusOK, response{"status": "ready"})
	})

	mux.HandleFunc("GET /live", func(w http.ResponseWriter, r *http.Request) {
		writeJSON(w, http.StatusOK, response{"status": "alive"})
	})

	mux.HandleFunc("GET /api/v1/appointments", appointmentIndexHandler(db))
	mux.HandleFunc("GET /api/v1/appointments/calendar", appointmentCalendarHandler(db))
	mux.HandleFunc("GET /api/v1/appointments/slots", appointmentSlotsHandler(db))
	mux.HandleFunc("POST /api/v1/appointments", appointmentStoreHandler(db))
	mux.HandleFunc("GET /api/v1/appointments/{id}", appointmentDetailHandler(db))
	mux.HandleFunc("GET /api/v1/appointments/{id}/export", appointmentExportHandler(db))
	mux.HandleFunc("GET /api/v1/service-orders", serviceOrderIndexHandler(db))
	mux.HandleFunc("POST /api/v1/service-orders", serviceOrderStoreHandler(db))
	mux.HandleFunc("GET /api/v1/service-orders/quick-intake", serviceOrderCreateQuickIntakeHandler(db))
	mux.HandleFunc("POST /api/v1/service-orders/quick-intake", serviceOrderStoreQuickIntakeHandler(db))
	mux.HandleFunc("PUT /api/v1/service-orders/{id}", serviceOrderUpdateHandler(db))
	mux.HandleFunc("GET /api/v1/service-orders/create", serviceOrderCreateHandler(db))
	mux.HandleFunc("GET /api/v1/service-orders/{id}/edit", serviceOrderEditHandler(db))
	mux.HandleFunc("GET /api/v1/service-orders/{id}/print", serviceOrderPrintHandler(db))
	mux.HandleFunc("GET /api/v1/service-orders/{id}", serviceOrderShowHandler(db))
	mux.HandleFunc("DELETE /api/v1/service-orders/{id}", serviceOrderDestroyHandler(db))
	mux.HandleFunc("POST /api/v1/service-orders/{id}/status", serviceOrderUpdateStatusHandler(db))
	mux.HandleFunc("POST /api/v1/service-orders/{id}/details/{detailId}/claim-warranty", serviceOrderClaimWarrantyHandler(db))
	mux.HandleFunc("GET /api/v1/part-purchases", partPurchaseIndexHandler(db))
	mux.HandleFunc("GET /api/v1/part-purchases/create", partPurchaseCreateHandler(db))
	mux.HandleFunc("POST /api/v1/part-purchases", partPurchaseStoreHandler(db))
	mux.HandleFunc("PUT /api/v1/part-purchases/{id}", partPurchaseUpdateHandler(db))
	mux.HandleFunc("GET /api/v1/part-purchases/{id}", partPurchaseShowHandler(db))
	mux.HandleFunc("GET /api/v1/part-purchases/{id}/edit", partPurchaseEditHandler(db))
	mux.HandleFunc("GET /api/v1/part-purchases/{id}/print", partPurchasePrintHandler(db))
	mux.HandleFunc("POST /api/v1/part-purchases/{id}/update-status", partPurchaseUpdateStatusHandler(db))
	mux.HandleFunc("POST /api/v1/part-sales", partSaleStoreHandler(db))
	mux.HandleFunc("GET /api/v1/part-sales", partSaleIndexHandler(db))
	mux.HandleFunc("GET /api/v1/part-sales/warranties", partSaleWarrantiesIndexHandler(db))
	mux.HandleFunc("GET /api/v1/part-sales/warranties/export", partSaleWarrantiesExportHandler(db))
	mux.HandleFunc("GET /api/v1/part-sales/{id}", partSaleShowHandler(db))
	mux.HandleFunc("GET /api/v1/part-sales/{id}/print", partSalePrintHandler(db))
	mux.HandleFunc("GET /api/v1/part-sales/{id}/edit", partSaleEditHandler(db))
	mux.HandleFunc("PUT /api/v1/part-sales/{id}", partSaleUpdateHandler(db))
	mux.HandleFunc("DELETE /api/v1/part-sales/{id}", partSaleDestroyHandler(db))
	mux.HandleFunc("POST /api/v1/part-sales/create-from-order", partSaleCreateFromOrderHandler(db))
	mux.HandleFunc("POST /api/v1/part-sales/{id}/update-payment", partSaleUpdatePaymentHandler(db))
	mux.HandleFunc("POST /api/v1/part-sales/{id}/update-status", partSaleUpdateStatusHandler(db))
	mux.HandleFunc("POST /api/v1/part-sales/{partSale}/details/{detail}/claim-warranty", partSaleClaimWarrantyHandler(db))
	mux.HandleFunc("GET /api/v1/part-stock-history", partStockHistoryIndexHandler(db))
	mux.HandleFunc("GET /api/v1/part-stock-history/export", partStockHistoryExportHandler(db))
	mux.HandleFunc("PUT /api/v1/appointments/{id}", appointmentUpdateHandler(db))
	mux.HandleFunc("PATCH /api/v1/appointments/{id}/status", appointmentStatusHandler(db))
	mux.HandleFunc("DELETE /api/v1/appointments/{id}", appointmentDestroyHandler(db))
	mux.HandleFunc("GET /api/v1/parts/low-stock", lowStockIndexHandler(db))
	mux.HandleFunc("POST /api/v1/cash-management/change/suggest", cashChangeSuggestHandler(db))
	mux.HandleFunc("POST /api/v1/cash-management/sale/settle", cashSaleSettleHandler(db))
	mux.HandleFunc("GET /api/v1/reports/part-sales-profit", partSalesProfitHandler(db))
	mux.HandleFunc("GET /api/v1/reports/part-sales-profit/by-supplier", partSalesProfitBySupplierHandler(db))
	mux.HandleFunc("GET /api/v1/reports/overall", overallReportHandler(db))
	mux.HandleFunc("GET /api/v1/reports/service-revenue", serviceRevenueReportHandler(db))
	mux.HandleFunc("GET /api/v1/reports/mechanic-productivity", mechanicProductivityReportHandler(db))
	mux.HandleFunc("GET /api/v1/reports/mechanic-payroll", mechanicPayrollReportHandler(db))
	mux.HandleFunc("GET /api/v1/reports/parts-inventory", partsInventoryReportHandler(db))
	mux.HandleFunc("GET /api/v1/reports/outstanding-payments", outstandingPaymentsReportHandler(db))
	mux.HandleFunc("GET /api/v1/reports/export", reportExportCSVHandler(db))
	mux.HandleFunc("GET /api/v1/sync/status", syncStatusHandler(db, cfg))
	mux.HandleFunc("GET /api/v1/sync/batches", syncBatchesIndexHandler(db))
	mux.HandleFunc("POST /api/v1/sync/batches", syncCreateBatchHandler(db, cfg))
	mux.HandleFunc("POST /api/v1/sync/run", syncRunHandler(db, cfg))
	mux.HandleFunc("POST /api/v1/sync/batches/{id}/send", syncSendBatchHandler(db, cfg))
	mux.HandleFunc("POST /api/v1/sync/batches/{id}/retry", syncRetryBatchHandler(db, cfg))

	mux.HandleFunc("GET /api/v1/vehicles", vehicleIndexHandler(db))
	mux.HandleFunc("POST /api/v1/vehicles", vehicleStoreHandler(db))
	mux.HandleFunc("PUT /api/v1/vehicles/{id}", vehicleUpdateHandler(db))
	mux.HandleFunc("DELETE /api/v1/vehicles/{id}", vehicleDestroyHandler(db))
	mux.HandleFunc("GET /api/v1/suppliers", supplierIndexHandler(db))
	mux.HandleFunc("POST /api/v1/suppliers", supplierStoreHandler(db))
	mux.HandleFunc("POST /api/v1/suppliers/store-ajax", supplierStoreAjaxHandler(db))
	mux.HandleFunc("PUT /api/v1/suppliers/{id}", supplierUpdateHandler(db))
	mux.HandleFunc("DELETE /api/v1/suppliers/{id}", supplierDestroyHandler(db))
	mux.HandleFunc("GET /api/v1/mechanics", mechanicIndexHandler(db))
	mux.HandleFunc("POST /api/v1/mechanics", mechanicStoreHandler(db))
	mux.HandleFunc("PUT /api/v1/mechanics/{id}", mechanicUpdateHandler(db))
	mux.HandleFunc("DELETE /api/v1/mechanics/{id}", mechanicDestroyHandler(db))
	mux.HandleFunc("GET /api/v1/customers", customerIndexHandler(db))
	mux.HandleFunc("POST /api/v1/customers", customerStoreHandler(db))
	mux.HandleFunc("GET /api/v1/customers/search", customerSearchHandler(db))
	mux.HandleFunc("POST /api/v1/customers/store-ajax", customerStoreAjaxHandler(db))
	mux.HandleFunc("PUT /api/v1/customers/{id}", customerUpdateHandler(db))
	mux.HandleFunc("DELETE /api/v1/customers/{id}", customerDestroyHandler(db))
	mux.HandleFunc("GET /api/v1/customers/{id}", customerShowHandler(db))
	mux.HandleFunc("GET /api/v1/whatsapp/health/check", whatsappHealthCheckHandler(cfg))
	mux.HandleFunc("POST /api/v1/webhooks/whatsapp", whatsappWebhookHandler(cfg))
	mux.HandleFunc("GET /api/v1/vehicles/{id}/maintenance-insights", vehicleMaintenanceInsightsHandler(db))
	mux.HandleFunc("GET /api/v1/vehicles/{id}/service-history", vehicleServiceHistoryHandler(db))
	mux.HandleFunc("GET /api/v1/vehicles/{id}/with-history", vehicleWithHistoryHandler(db))
	mux.HandleFunc("GET /api/v1/vehicles/{id}", vehicleDetailHandler(db))
	mux.HandleFunc("GET /api/v1/vehicles/{id}/recommendations", vehicleRecommendationsHandler(db))
	mux.HandleFunc("GET /api/v1/vehicles/{id}/maintenance-schedule", vehicleMaintenanceScheduleHandler(db))

	handler := middleware.Recover(middleware.RequestID(middleware.RequestLogger(mux)))

	return &http.Server{
		Addr:         cfg.Address(),
		Handler:      handler,
		ReadTimeout:  cfg.ReadTimeout,
		WriteTimeout: cfg.WriteTimeout,
	}, nil
}

func writeJSON(w http.ResponseWriter, status int, payload response) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(payload)
}
