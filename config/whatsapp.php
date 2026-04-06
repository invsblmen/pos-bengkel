<?php

return [
    'enabled' => env('WHATSAPP_ENABLED', false),

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
];
