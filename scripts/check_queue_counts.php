<?php
require __DIR__ . '/../vendor/autoload.php';
$app = require_once __DIR__ . '/../bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

use Illuminate\Support\Facades\DB;
use App\Models\WhatsAppOutboundMessage;

echo json_encode([
    'jobs' => DB::table('jobs')->count(),
    'failed_jobs' => DB::table('failed_jobs')->count(),
    'outbound_queued' => WhatsAppOutboundMessage::where('status', 'queued')->count(),
    'outbound_sent' => WhatsAppOutboundMessage::where('status', 'sent')->count(),
    'outbound_failed' => WhatsAppOutboundMessage::where('status', 'failed')->count(),
], JSON_UNESCAPED_SLASHES) . PHP_EOL;
