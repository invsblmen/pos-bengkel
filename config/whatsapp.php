<?php

return [
    'enabled' => env('WHATSAPP_ENABLED', false),
    'go_dashboard_url' => env('WHATSAPP_GO_DASHBOARD_URL', env('WHATSAPP_API_BASE_URL', 'http://127.0.0.1:3000')),
    'go_backend' => [
        'base_url' => env('GO_WHATSAPP_BASE_URL', 'http://127.0.0.1:8081'),
        'use_webhook' => env('WHATSAPP_WEBHOOK_USE_GO', false),
        'use_health_check' => env('WHATSAPP_HEALTHCHECK_USE_GO', false),
        'timeout_seconds' => (int) env('GO_WHATSAPP_TIMEOUT_SECONDS', 5),
    ],

    'api' => [
        'base_url' => env('WHATSAPP_API_BASE_URL', 'http://127.0.0.1:3000'),
        'timeout_seconds' => (int) env('WHATSAPP_API_TIMEOUT_SECONDS', 15),
        'retry_times' => (int) env('WHATSAPP_API_RETRY_TIMES', 2),
        'retry_sleep_ms' => (int) env('WHATSAPP_API_RETRY_SLEEP_MS', 250),
        'username' => env('WHATSAPP_API_USERNAME'),
        'password' => env('WHATSAPP_API_PASSWORD'),
        'device_id' => env('WHATSAPP_DEVICE_ID'),
    ],

    'webhook' => [
        'secret' => env('WHATSAPP_WEBHOOK_SECRET', 'secret'),
        'verify_signature' => env('WHATSAPP_WEBHOOK_VERIFY_SIGNATURE', true),
    ],

    'notifications' => [
        'queue' => env('WHATSAPP_QUEUE', 'default'),
        'service_order_created' => env('WHATSAPP_NOTIFY_SERVICE_ORDER_CREATED', true),
        'service_order_updated' => env('WHATSAPP_NOTIFY_SERVICE_ORDER_UPDATED', false),
    ],

    'monitoring' => [
        'heartbeat_key' => env('WHATSAPP_QUEUE_HEARTBEAT_KEY', 'whatsapp:queue:heartbeat'),
        'heartbeat_ttl_seconds' => (int) env('WHATSAPP_QUEUE_HEARTBEAT_TTL_SECONDS', 90),
        'refresh_interval_seconds' => (int) env('WHATSAPP_QUEUE_REFRESH_INTERVAL_SECONDS', 15),
    ],
    'docker' => [
        // Path to docker-compose file relative to repository root or absolute path.
        // Default assumes local copy at `go-whatsapp-web-multidevice/docker-compose.yml`.
        'compose_file' => env('WHATSAPP_GO_DOCKER_COMPOSE', 'go-whatsapp-web-multidevice/docker-compose.yml'),
        // Optional service name (leave empty to manage all services defined in compose file)
        'service_name' => env('WHATSAPP_GO_DOCKER_SERVICE', ''),
        // Docker Engine API host (tcp) e.g. tcp://127.0.0.1:2375 or http://127.0.0.1:2375
        // If empty, CLI will be preferred; set this if you want API fallback over TCP.
        'host' => env('WHATSAPP_DOCKER_HOST', env('DOCKER_HOST', '')),
    ],
    'local' => [
        // Path to local built binary (absolute or repo-relative). Default assumes
        // `go-whatsapp-web-multidevice/src/whatsapp`.
        'binary_path' => env('WHATSAPP_LOCAL_BINARY', base_path('go-whatsapp-web-multidevice/src/whatsapp')),
    ],
];
