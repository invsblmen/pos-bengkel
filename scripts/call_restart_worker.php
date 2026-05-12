<?php
require __DIR__ . "/../vendor/autoload.php";
$app = require_once __DIR__ . "/../bootstrap/app.php";
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

use Illuminate\Http\Request;
use App\Http\Controllers\Apps\WhatsAppLogController;

$request = Request::create('/dashboard/whatsapp/worker/restart', 'POST', [], [], [], ['HTTP_X_REQUESTED_WITH' => 'XMLHttpRequest']);
$controller = new WhatsAppLogController();
$app->instance('request', $request);
$response = $controller->restartWorkers($request);
if ($response instanceof \Illuminate\Http\JsonResponse) {
    echo $response->getContent() . PHP_EOL;
} elseif ($response instanceof \Illuminate\Http\RedirectResponse) {
    echo json_encode(['redirect' => $response->getTargetUrl(), 'status' => $response->getStatusCode()]) . PHP_EOL;
} else {
    echo json_encode(['type' => gettype($response)]) . PHP_EOL;
}
