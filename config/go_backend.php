<?php

return [
    'base_url' => env('GO_BACKEND_BASE_URL', 'http://127.0.0.1:8081'),
    'timeout_seconds' => (int) env('GO_BACKEND_TIMEOUT_SECONDS', 5),
    'sync' => [
        'enabled' => env('GO_SYNC_ENABLED', false),
        'shared_token' => env('GO_SYNC_SHARED_TOKEN', ''),
        'retention_days' => max(1, (int) env('GO_SYNC_RETENTION_DAYS', 30)),
        'retention' => [
            'enabled' => env('GO_SYNC_RETENTION_PURGE_ENABLED', true),
            'daily_at' => env('GO_SYNC_RETENTION_PURGE_DAILY_AT', '03:20'),
        ],
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
];
