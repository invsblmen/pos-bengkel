<?php

return [
    'base_url' => env('GO_BACKEND_BASE_URL', 'http://127.0.0.1:8081'),
    'timeout_seconds' => (int) env('GO_BACKEND_TIMEOUT_SECONDS', 5),
    'sync' => [
        'enabled' => env('GO_SYNC_ENABLED', false),
        'shared_token' => env('GO_SYNC_SHARED_TOKEN', ''),
        'retention_days' => max(1, (int) env('GO_SYNC_RETENTION_DAYS', 30)),
        'timeout' => [
            'run_seconds' => max(5, min(600, (int) env('GO_SYNC_RUN_TIMEOUT_SECONDS', 60))),
            'retry_seconds' => max(5, min(600, (int) env('GO_SYNC_RETRY_TIMEOUT_SECONDS', 60))),
            'alert_seconds' => max(5, min(600, (int) env('GO_SYNC_ALERT_TIMEOUT_SECONDS', 30))),
            'reconciliation_seconds' => max(5, min(600, (int) env('GO_SYNC_RECONCILIATION_TIMEOUT_SECONDS', 45))),
        ],
        'retry' => [
            'default_limit' => max(1, min(1000, (int) env('GO_SYNC_RETRY_DEFAULT_LIMIT', 5))),
            'max_limit' => max(1, min(1000, (int) env('GO_SYNC_RETRY_MAX_LIMIT', 200))),
        ],
        'schedule' => [
            'enabled' => env('GO_SYNC_SCHEDULE_ENABLED', false),
            'daily_at' => env('GO_SYNC_SCHEDULE_DAILY_AT', '23:40'),
            'retry_limit' => max(1, min(100, (int) env('GO_SYNC_SCHEDULE_RETRY_LIMIT', 5))),
        ],
        'alert' => [
            'enabled' => env('GO_SYNC_ALERT_ENABLED', false),
            'failed_after_minutes' => max(5, min(10080, (int) env('GO_SYNC_ALERT_FAILED_MINUTES', 120))),
            'limit' => max(1, min(200, (int) env('GO_SYNC_ALERT_LIMIT', 20))),
        ],
        'reconciliation' => [
            'enabled' => env('GO_SYNC_RECONCILIATION_ENABLED', false),
            'daily_at' => env('GO_SYNC_RECONCILIATION_DAILY_AT', '00:15'),
            'max_variance_percent' => max(0, min(100, (int) env('GO_SYNC_RECONCILIATION_MAX_VARIANCE', 5))),
        ],
    ],
    'canary' => [
        'enabled' => env('GO_CANARY_ENABLED', false),
        'default_percentage' => max(0, min(100, (int) env('GO_CANARY_DEFAULT_PERCENT', 100))),
        'feature_percentages' => collect(explode(',', (string) env('GO_CANARY_FEATURES', '')))
            ->map(fn ($item) => trim($item))
            ->filter(fn ($item) => $item !== '' && str_contains($item, ':'))
            ->mapWithKeys(function ($item) {
                [$key, $value] = array_pad(explode(':', $item, 2), 2, '100');
                return [trim($key) => max(0, min(100, (int) trim($value)))];
            })
            ->toArray(),
    ],
    'shadow_compare' => [
        'enabled' => env('GO_SHADOW_COMPARE_ENABLED', false),
        'sample_rate' => max(0, min(100, (int) env('GO_SHADOW_COMPARE_SAMPLE_RATE', 100))),
        'max_skipped_rate' => max(0, min(100, (float) env('GO_SHADOW_COMPARE_MAX_SKIPPED_RATE', 20))),
        'ignore_paths' => array_values(array_filter(array_map('trim', explode(',', (string) env(
            'GO_SHADOW_COMPARE_IGNORE_PATHS',
            'csrf_token,current_date,generated_at,server_time,timestamp,*.created_at,*.updated_at'
        ))))),
        'default_threshold' => env('GO_SHADOW_COMPARE_DEFAULT_THRESHOLD') !== null
            ? max(0, (float) env('GO_SHADOW_COMPARE_DEFAULT_THRESHOLD'))
            : null,
        'feature_thresholds' => collect(explode(',', (string) env('GO_SHADOW_COMPARE_FEATURE_THRESHOLDS', '')))
            ->map(fn ($item) => trim($item))
            ->filter(fn ($item) => $item !== '' && str_contains($item, ':'))
            ->mapWithKeys(function ($item) {
                [$key, $value] = array_pad(explode(':', $item, 2), 2, '0');
                return [trim($key) => max(0, (float) trim($value))];
            })
            ->toArray(),
    ],

    'features' => [
        'appointment_index' => env('GO_APPOINTMENT_INDEX_USE_GO', false),
        'appointment_calendar' => env('GO_APPOINTMENT_CALENDAR_USE_GO', false),
        'appointment_slots' => env('GO_APPOINTMENT_SLOTS_USE_GO', false),
        'appointment_store' => env('GO_APPOINTMENT_STORE_USE_GO', false),
        'appointment_edit' => env('GO_APPOINTMENT_EDIT_USE_GO', false),
        'appointment_update' => env('GO_APPOINTMENT_UPDATE_USE_GO', false),
        'appointment_update_status' => env('GO_APPOINTMENT_UPDATE_STATUS_USE_GO', false),
        'appointment_destroy' => env('GO_APPOINTMENT_DESTROY_USE_GO', false),
        'appointment_export' => env('GO_APPOINTMENT_EXPORT_USE_GO', false),
        'part_purchase_index' => env('GO_PART_PURCHASE_INDEX_USE_GO', false),
        'part_purchase_create' => env('GO_PART_PURCHASE_CREATE_USE_GO', false),
        'part_purchase_store' => env('GO_PART_PURCHASE_STORE_USE_GO', false),
        'part_purchase_edit' => env('GO_PART_PURCHASE_EDIT_USE_GO', false),
        'part_purchase_show' => env('GO_PART_PURCHASE_SHOW_USE_GO', false),
        'part_purchase_print' => env('GO_PART_PURCHASE_PRINT_USE_GO', false),
        'part_purchase_update' => env('GO_PART_PURCHASE_UPDATE_USE_GO', false),
        'part_purchase_update_status' => env('GO_PART_PURCHASE_UPDATE_STATUS_USE_GO', false),
        'part_sale_store' => env('GO_PART_SALE_STORE_USE_GO', false),
        'part_sale_update' => env('GO_PART_SALE_UPDATE_USE_GO', false),
        'part_sale_destroy' => env('GO_PART_SALE_DESTROY_USE_GO', false),
        'part_sale_show' => env('GO_PART_SALE_SHOW_USE_GO', false),
        'part_sale_print' => env('GO_PART_SALE_PRINT_USE_GO', false),
        'part_sale_edit' => env('GO_PART_SALE_EDIT_USE_GO', false),
        'part_sale_warranties_index' => env('GO_PART_SALE_WARRANTIES_INDEX_USE_GO', false),
        'part_sale_warranties_export' => env('GO_PART_SALE_WARRANTIES_EXPORT_USE_GO', false),
        'part_sale_index' => env('GO_PART_SALE_INDEX_USE_GO', false),
        'part_sale_create_from_order' => env('GO_PART_SALE_CREATE_FROM_ORDER_USE_GO', false),
        'part_sale_update_payment' => env('GO_PART_SALE_UPDATE_PAYMENT_USE_GO', false),
        'part_sale_update_status' => env('GO_PART_SALE_UPDATE_STATUS_USE_GO', false),
        'part_sale_claim_warranty' => env('GO_PART_SALE_CLAIM_WARRANTY_USE_GO', false),
        'service_order_index' => env('GO_SERVICE_ORDER_INDEX_USE_GO', false),
        'service_order_show' => env('GO_SERVICE_ORDER_SHOW_USE_GO', false),
        'service_order_store' => env('GO_SERVICE_ORDER_STORE_USE_GO', false),
        'service_order_update' => env('GO_SERVICE_ORDER_UPDATE_USE_GO', false),
        'service_order_create' => env('GO_SERVICE_ORDER_CREATE_USE_GO', false),
        'service_order_edit' => env('GO_SERVICE_ORDER_EDIT_USE_GO', false),
        'service_order_print' => env('GO_SERVICE_ORDER_PRINT_USE_GO', false),
        'service_order_update_status' => env('GO_SERVICE_ORDER_UPDATE_STATUS_USE_GO', false),
        'service_order_claim_warranty' => env('GO_SERVICE_ORDER_CLAIM_WARRANTY_USE_GO', false),
        'service_order_destroy' => env('GO_SERVICE_ORDER_DESTROY_USE_GO', false),
        'service_order_quick_intake_create' => env('GO_SERVICE_ORDER_QUICK_INTAKE_CREATE_USE_GO', false),
        'service_order_quick_intake_store' => env('GO_SERVICE_ORDER_QUICK_INTAKE_STORE_USE_GO', false),
        'part_stock_history_index' => env('GO_PART_STOCK_HISTORY_INDEX_USE_GO', false),
        'part_stock_history_export' => env('GO_PART_STOCK_HISTORY_EXPORT_USE_GO', false),
        'report_part_sales_profit' => env('GO_REPORT_PART_SALES_PROFIT_USE_GO', false),
        'report_overall' => env('GO_REPORT_OVERALL_USE_GO', false),
        'report_service_revenue' => env('GO_REPORT_SERVICE_REVENUE_USE_GO', false),
        'report_mechanic_productivity' => env('GO_REPORT_MECHANIC_PRODUCTIVITY_USE_GO', false),
        'report_mechanic_payroll' => env('GO_REPORT_MECHANIC_PAYROLL_USE_GO', false),
        'report_parts_inventory' => env('GO_REPORT_PARTS_INVENTORY_USE_GO', false),
        'report_outstanding_payments' => env('GO_REPORT_OUTSTANDING_PAYMENTS_USE_GO', false),
        'report_export_csv' => env('GO_REPORT_EXPORT_CSV_USE_GO', false),
        'cash_change_suggest' => env('GO_CASH_CHANGE_SUGGEST_USE_GO', false),
        'cash_sale_settle' => env('GO_CASH_SALE_SETTLE_USE_GO', false),
        'parts_low_stock' => env('GO_PARTS_LOW_STOCK_USE_GO', false),
        'vehicle_index' => env('GO_VEHICLE_INDEX_USE_GO', false),
        'vehicle_store' => env('GO_VEHICLE_STORE_USE_GO', false),
        'vehicle_update' => env('GO_VEHICLE_UPDATE_USE_GO', false),
        'vehicle_destroy' => env('GO_VEHICLE_DESTROY_USE_GO', false),
        'vehicle_insights' => env('GO_VEHICLE_INSIGHTS_USE_GO', false),
        'vehicle_service_history' => env('GO_VEHICLE_SERVICE_HISTORY_USE_GO', false),
        'vehicle_with_history' => env('GO_VEHICLE_WITH_HISTORY_USE_GO', false),
        'vehicle_detail' => env('GO_VEHICLE_DETAIL_USE_GO', false),
        'vehicle_recommendations' => env('GO_VEHICLE_RECOMMENDATIONS_USE_GO', false),
        'vehicle_maintenance_schedule' => env('GO_VEHICLE_MAINTENANCE_SCHEDULE_USE_GO', false),
        'customer_index' => env('GO_CUSTOMER_INDEX_USE_GO', false),
        'customer_show' => env('GO_CUSTOMER_SHOW_USE_GO', false),
        'customer_search' => env('GO_CUSTOMER_SEARCH_USE_GO', false),
        'customer_store' => env('GO_CUSTOMER_STORE_USE_GO', false),
        'customer_store_ajax' => env('GO_CUSTOMER_STORE_AJAX_USE_GO', false),
        'customer_update' => env('GO_CUSTOMER_UPDATE_USE_GO', false),
        'customer_destroy' => env('GO_CUSTOMER_DESTROY_USE_GO', false),
        'supplier_store' => env('GO_SUPPLIER_STORE_USE_GO', false),
        'supplier_index' => env('GO_SUPPLIER_INDEX_USE_GO', false),
        'supplier_store_ajax' => env('GO_SUPPLIER_STORE_AJAX_USE_GO', false),
        'supplier_update' => env('GO_SUPPLIER_UPDATE_USE_GO', false),
        'supplier_destroy' => env('GO_SUPPLIER_DESTROY_USE_GO', false),
        'mechanic_index' => env('GO_MECHANIC_INDEX_USE_GO', false),
        'mechanic_store' => env('GO_MECHANIC_STORE_USE_GO', false),
        'mechanic_update' => env('GO_MECHANIC_UPDATE_USE_GO', false),
        'mechanic_destroy' => env('GO_MECHANIC_DESTROY_USE_GO', false),
    ],
];
