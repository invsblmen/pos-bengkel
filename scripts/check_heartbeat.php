<?php
require __DIR__ . "/../vendor/autoload.php";
$app = require_once __DIR__ . "/../bootstrap/app.php";
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();
$cache = $app->make('cache');
$key = 'whatsapp:queue:heartbeat';
$val = $cache->get($key);
if (!$val) {
    echo "null" . PHP_EOL;
    exit(0);
}
// If it's an array/object, json encode
if (is_array($val) || is_object($val)) {
    echo json_encode($val) . PHP_EOL;
    exit(0);
}
// else just print scalar
echo (string) $val . PHP_EOL;
