<?php
require __DIR__ . '/../vendor/autoload.php';
$app = require_once __DIR__ . '/../bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

$payload = json_decode(file_get_contents(__DIR__ . '/purchase.json'), true);
if (!$payload) {
    echo "Missing purchase.json or invalid JSON\n";
    exit(1);
}

$req = Illuminate\Http\Request::create('/api/spg/part-purchase', 'POST', $payload);
$controller = new App\Http\Controllers\Apps\SDMSAuthController();
$resp = $controller->storePartPurchaseFromSPG($req);
if (method_exists($resp, 'getContent')) {
    echo $resp->getContent();
} else {
    var_export($resp);
}

echo "\n";
