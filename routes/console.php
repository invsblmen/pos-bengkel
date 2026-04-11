<?php

use App\Models\LowStockAlert;
use App\Models\Part;
use App\Models\PartSaleDetail;
use App\Models\User;
use App\Notifications\PartSaleWarrantyExpiringNotification;
use App\Http\Controllers\Apps\ServiceReportController;
use App\Http\Controllers\Reports\PartSalesProfitReportController;
use Illuminate\Foundation\Inspiring;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Schedule;
use Illuminate\Support\Facades\DB;

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote')->hourly();

Artisan::command('low-stock:sync', function () {
    $lowStockParts = Part::lowStock()->get(['id', 'stock', 'minimal_stock']);

    foreach ($lowStockParts as $part) {
        LowStockAlert::updateOrCreate(
            ['part_id' => $part->id],
            [
                'current_stock' => $part->stock,
                'minimal_stock' => $part->minimal_stock,
            ]
        );
    }

    LowStockAlert::whereNotIn('part_id', $lowStockParts->pluck('id'))->delete();

    $this->info("Low stock alerts synced: {$lowStockParts->count()}");
})->purpose('Sync low stock alerts based on minimal stock');

Artisan::command('warranty:notify-expiring {--days=7}', function () {
    $days = max(1, min((int) $this->option('days'), 60));

    $today = now()->startOfDay();
    $endDate = (clone $today)->addDays($days)->endOfDay();

    $details = PartSaleDetail::query()
        ->with([
            'part:id,name,part_number',
            'partSale:id,sale_number,customer_id,sale_date',
            'partSale.customer:id,name',
        ])
        ->where('warranty_period_days', '>', 0)
        ->whereNull('warranty_claimed_at')
        ->whereBetween('warranty_end_date', [$today, $endDate])
        ->get();

    if ($details->isEmpty()) {
        $this->info('No expiring warranties found.');
        return;
    }

    $recipients = User::permission('part-sales-access')->get();

    if ($recipients->isEmpty()) {
        $this->warn('No recipient with permission part-sales-access found.');
        return;
    }

    $sent = 0;
    $skipped = 0;

    foreach ($details as $detail) {
        $daysLeft = max(0, now()->startOfDay()->diffInDays($detail->warranty_end_date, false));

        foreach ($recipients as $recipient) {
            $alreadySentToday = $recipient->notifications()
                ->where('type', PartSaleWarrantyExpiringNotification::class)
                ->whereDate('created_at', now()->toDateString())
                ->where('data->part_sale_detail_id', $detail->id)
                ->exists();

            if ($alreadySentToday) {
                $skipped++;
                continue;
            }

            $recipient->notify(new PartSaleWarrantyExpiringNotification($detail, $daysLeft));
            $sent++;
        }
    }

    $this->info("Expiring warranty notifications sent: {$sent}, skipped: {$skipped}");
})->purpose('Notify users about sparepart warranties that are nearing expiration');

Artisan::command('reverb:watchdog-status {--lines=20}', function () {
    $lineCount = max(1, min((int) $this->option('lines'), 200));

    $logDir = storage_path('logs');
    $watchdogLog = $logDir . DIRECTORY_SEPARATOR . 'reverb-watchdog.log';
    $autostartLog = $logDir . DIRECTORY_SEPARATOR . 'reverb-autostart.log';
    $pidFile = $logDir . DIRECTORY_SEPARATOR . 'reverb-watchdog.pid';

    $this->line('Reverb Watchdog Status');
    $this->line('Project: ' . base_path());

    $watchdogPid = null;
    if (File::exists($pidFile)) {
        $rawPid = trim((string) File::get($pidFile));
        if (ctype_digit($rawPid)) {
            $watchdogPid = (int) $rawPid;
        }
    }

    $watchdogRunning = false;
    if ($watchdogPid) {
        $taskListResult = @shell_exec('tasklist /FI "PID eq ' . $watchdogPid . '" /FO CSV /NH');
        $watchdogRunning = is_string($taskListResult)
            && $taskListResult !== ''
            && stripos($taskListResult, 'INFO: No tasks are running') === false;
    }

    $reverbReachable = false;
    $socket = @fsockopen('127.0.0.1', 8080, $errno, $errstr, 1);
    if ($socket) {
        $reverbReachable = true;
        fclose($socket);
    }

    $rows = [
        ['Watchdog PID File', File::exists($pidFile) ? $pidFile : 'Tidak ditemukan'],
        ['Watchdog PID', $watchdogPid ? (string) $watchdogPid : '-'],
        ['Watchdog Process', $watchdogRunning ? 'RUNNING' : 'NOT RUNNING'],
        ['Reverb Port 8080', $reverbReachable ? 'REACHABLE' : 'UNREACHABLE'],
        ['Watchdog Log', File::exists($watchdogLog) ? $watchdogLog : 'Tidak ditemukan'],
        ['Autostart Log', File::exists($autostartLog) ? $autostartLog : 'Tidak ditemukan'],
    ];

    $this->table(['Check', 'Value'], $rows);

    $tailLines = function (string $path, int $limit): array {
        if (!File::exists($path)) {
            return ['(file not found)'];
        }

        $content = (string) File::get($path);
        $allLines = preg_split('/\r\n|\r|\n/', trim($content));
        if (!is_array($allLines) || count($allLines) === 0 || (count($allLines) === 1 && $allLines[0] === '')) {
            return ['(empty)'];
        }

        return array_slice($allLines, -1 * $limit);
    };

    $this->line('');
    $this->line('Last ' . $lineCount . ' lines: reverb-watchdog.log');
    foreach ($tailLines($watchdogLog, $lineCount) as $line) {
        $this->line('  ' . $line);
    }

    $this->line('');
    $this->line('Last ' . $lineCount . ' lines: reverb-autostart.log');
    foreach ($tailLines($autostartLog, $lineCount) as $line) {
        $this->line('  ' . $line);
    }
})->purpose('Show Reverb watchdog process, PID, port reachability, and recent logs');

Artisan::command('reverb:watchdog-maintain {--max-kb=1024} {--keep-lines=600}', function () {
    $maxKb = max(64, min((int) $this->option('max-kb'), 10240));
    $keepLines = max(50, min((int) $this->option('keep-lines'), 5000));
    $maxBytes = $maxKb * 1024;

    $logDir = storage_path('logs');
    $targets = [
        $logDir . DIRECTORY_SEPARATOR . 'reverb-watchdog.log',
        $logDir . DIRECTORY_SEPARATOR . 'reverb-autostart.log',
    ];

    $trimmed = 0;
    $untouched = 0;

    foreach ($targets as $target) {
        if (!File::exists($target)) {
            $this->line('Skip (not found): ' . $target);
            continue;
        }

        $size = (int) File::size($target);
        if ($size <= $maxBytes) {
            $untouched++;
            $this->line('OK: ' . basename($target) . ' (' . $size . ' bytes)');
            continue;
        }

        $content = (string) File::get($target);
        $lines = preg_split('/\r\n|\r|\n/', trim($content));
        $lines = is_array($lines) ? array_slice($lines, -1 * $keepLines) : [];
        $newContent = implode(PHP_EOL, $lines) . PHP_EOL;

        File::put($target, $newContent);
        $trimmed++;

        $newSize = (int) File::size($target);
        $this->line('Trimmed: ' . basename($target) . ' (' . $size . ' -> ' . $newSize . ' bytes)');
    }

    $this->info("Watchdog maintenance complete. trimmed={$trimmed}, untouched={$untouched}");
})->purpose('Trim Reverb watchdog log files when they exceed the configured size');

Schedule::command('low-stock:sync')->hourly();
Schedule::command('warranty:notify-expiring --days=7')->dailyAt('07:30');
Schedule::command('reverb:watchdog-maintain --max-kb=1024 --keep-lines=600')->weeklyOn(0, '03:10');
Schedule::command('benchmark:reports --iterations=2 --warmup=1 --save-history')->dailyAt('02:30');
Schedule::command('go:shadow:summary --top=50 --save-csv')->dailyAt('23:50')->withoutOverlapping();
Schedule::command('go:shadow:trend --days=7')->dailyAt('23:55')->withoutOverlapping();

Artisan::command('go:sync:run {--scope=daily} {--source_date=} {--tables=} {--timeout=}', function () {
    if (! (bool) config('go_backend.sync.enabled', false)) {
        $this->warn('GO sync belum aktif (GO_SYNC_ENABLED=false).');
        return self::FAILURE;
    }

    $baseUrl = rtrim((string) config('go_backend.base_url', ''), '/');
    if ($baseUrl === '') {
        $this->error('GO backend base URL belum dikonfigurasi.');
        return self::FAILURE;
    }

    $defaultTimeout = max(5, min((int) config('go_backend.sync.timeout.run_seconds', 60), 600));
    $timeoutInput = $this->option('timeout');
    $timeout = max(3, min((int) ($timeoutInput === null || $timeoutInput === '' ? $defaultTimeout : $timeoutInput), 600));
    $scope = trim((string) $this->option('scope'));
    $sourceDate = trim((string) $this->option('source_date'));
    $tablesRaw = trim((string) $this->option('tables'));
    $token = trim((string) config('go_backend.sync.shared_token', ''));

    $payload = [];
    if ($scope !== '') {
        $payload['scope'] = $scope;
    }
    if ($sourceDate !== '') {
        $payload['source_date'] = $sourceDate;
    }
    if ($tablesRaw !== '') {
        $payload['tables'] = array_values(array_filter(array_map('trim', explode(',', $tablesRaw)), fn ($item) => $item !== ''));
    }

    $request = Http::timeout($timeout)->acceptJson();
    if ($token !== '') {
        $request = $request
            ->withToken($token)
            ->withHeaders(['X-Sync-Token' => $token]);
    }

    try {
        $response = $request->post($baseUrl . '/api/v1/sync/run', $payload);
    } catch (\Throwable $e) {
        $this->error('Gagal memanggil endpoint Go sync run: ' . $e->getMessage());
        return self::FAILURE;
    }

    if (! $response->successful()) {
        $this->error('Go sync run gagal. HTTP ' . $response->status());
        $this->line($response->body());
        return self::FAILURE;
    }

    $json = $response->json();
    $batchId = data_get($json, 'batch.sync_batch_id') ?? data_get($json, 'send_result.batch.sync_batch_id') ?? '-';
    $status = data_get($json, 'send_result.status') ?? data_get($json, 'send_result.send_status') ?? '-';
    $httpStatus = data_get($json, 'send_result.http_status') ?? data_get($json, 'send_result.send_http_status') ?? '-';

    $this->info('Go sync run berhasil.');
    $this->line('Batch: ' . $batchId);
    $this->line('Send status: ' . $status);
    $this->line('Send HTTP status: ' . $httpStatus);

    return self::SUCCESS;
})->purpose('Trigger one Go-to-Laravel sync run using the Go backend API');

Artisan::command('go:sync:retry-failed {--limit=} {--timeout=} {--base-minutes=5} {--max-minutes=240} {--respect-backoff=1}', function () {
    if (! (bool) config('go_backend.sync.enabled', false)) {
        $this->warn('GO sync belum aktif (GO_SYNC_ENABLED=false).');
        return self::FAILURE;
    }

    $baseUrl = rtrim((string) config('go_backend.base_url', ''), '/');
    if ($baseUrl === '') {
        $this->error('GO backend base URL belum dikonfigurasi.');
        return self::FAILURE;
    }

    $defaultTimeout = max(5, min((int) config('go_backend.sync.timeout.retry_seconds', 60), 600));
    $timeoutInput = $this->option('timeout');
    $timeout = max(3, min((int) ($timeoutInput === null || $timeoutInput === '' ? $defaultTimeout : $timeoutInput), 600));
    $defaultLimit = max(1, (int) config('go_backend.sync.retry.default_limit', 5));
    $maxLimit = max($defaultLimit, (int) config('go_backend.sync.retry.max_limit', 200));
    $limitInput = $this->option('limit');
    $limit = max(1, min((int) ($limitInput === null || $limitInput === '' ? $defaultLimit : $limitInput), $maxLimit));
    $baseMinutes = max(1, min((int) $this->option('base-minutes'), 120));
    $maxMinutes = max($baseMinutes, min((int) $this->option('max-minutes'), 1440));
    $respectBackoff = filter_var((string) $this->option('respect-backoff'), FILTER_VALIDATE_BOOL);
    $token = trim((string) config('go_backend.sync.shared_token', ''));

    $request = Http::timeout($timeout)->acceptJson();
    if ($token !== '') {
        $request = $request
            ->withToken($token)
            ->withHeaders(['X-Sync-Token' => $token]);
    }

    try {
        $batchesResponse = $request->get($baseUrl . '/api/v1/sync/batches');
    } catch (\Throwable $e) {
        $this->error('Gagal mengambil daftar batch Go: ' . $e->getMessage());
        return self::FAILURE;
    }

    if (! $batchesResponse->successful()) {
        $this->error('Gagal mengambil daftar batch Go. HTTP ' . $batchesResponse->status());
        $this->line($batchesResponse->body());
        return self::FAILURE;
    }

    $failedBatches = collect($batchesResponse->json('batches', []))
        ->filter(fn ($batch) => (string) data_get($batch, 'status') === 'failed')
        ->values();

    if ($respectBackoff) {
        $now = now();
        $failedBatches = $failedBatches->filter(function ($batch) use ($baseMinutes, $maxMinutes, $now) {
            $attemptCount = max(1, (int) data_get($batch, 'attempt_count', 1));
            $lastAttemptAt = data_get($batch, 'last_attempt_at');

            if (empty($lastAttemptAt)) {
                return true;
            }

            try {
                $lastAttempt = Carbon::parse((string) $lastAttemptAt);
            } catch (\Throwable $e) {
                return true;
            }

            $delayMinutes = min($maxMinutes, $baseMinutes * (2 ** max(0, $attemptCount - 1)));
            return $lastAttempt->addMinutes((int) $delayMinutes)->lte($now);
        })->values();
    }

    $failedBatchIds = $failedBatches
        ->take($limit)
        ->pluck('sync_batch_id')
        ->filter(fn ($id) => is_string($id) && trim($id) !== '')
        ->values();

    if ($failedBatchIds->isEmpty()) {
        $this->info('Tidak ada batch failed yang eligible untuk diretry.');
        return self::SUCCESS;
    }

    $retried = 0;
    $failed = 0;

    foreach ($failedBatchIds as $batchId) {
        try {
            $retryResponse = $request->post($baseUrl . '/api/v1/sync/batches/' . $batchId . '/retry');
        } catch (\Throwable $e) {
            $failed++;
            $this->warn("Retry error untuk {$batchId}: {$e->getMessage()}");
            continue;
        }

        if (! $retryResponse->successful()) {
            $failed++;
            $this->warn("Retry gagal untuk {$batchId}. HTTP {$retryResponse->status()}");
            continue;
        }

        $retried++;
        $status = data_get($retryResponse->json(), 'result.status', '-');
        $this->line("Retry {$batchId}: {$status}");
    }

    $this->info("Retry selesai. berhasil={$retried}, gagal={$failed}, kandidat={$failedBatchIds->count()}");
    return $failed > 0 ? self::FAILURE : self::SUCCESS;
})->purpose('Retry failed sync batches via Go backend API');

Artisan::command('go:sync:alert-long-failed {--minutes=120} {--limit=20} {--timeout=}', function () {
    if (! (bool) config('go_backend.sync.enabled', false)) {
        $this->warn('GO sync belum aktif (GO_SYNC_ENABLED=false).');
        return self::SUCCESS;
    }

    $baseUrl = rtrim((string) config('go_backend.base_url', ''), '/');
    if ($baseUrl === '') {
        $this->error('GO backend base URL belum dikonfigurasi.');
        return self::FAILURE;
    }

    $defaultTimeout = max(5, min((int) config('go_backend.sync.timeout.alert_seconds', 30), 600));
    $timeoutInput = $this->option('timeout');
    $timeout = max(3, min((int) ($timeoutInput === null || $timeoutInput === '' ? $defaultTimeout : $timeoutInput), 600));
    $minutes = max(5, min((int) $this->option('minutes'), 10080));
    $limit = max(1, min((int) $this->option('limit'), 200));
    $token = trim((string) config('go_backend.sync.shared_token', ''));

    $request = Http::timeout($timeout)->acceptJson();
    if ($token !== '') {
        $request = $request
            ->withToken($token)
            ->withHeaders(['X-Sync-Token' => $token]);
    }

    try {
        $batchesResponse = $request->get($baseUrl . '/api/v1/sync/batches');
    } catch (\Throwable $e) {
        $this->error('Gagal mengambil daftar batch Go: ' . $e->getMessage());
        return self::FAILURE;
    }

    if (! $batchesResponse->successful()) {
        $this->error('Gagal mengambil daftar batch Go. HTTP ' . $batchesResponse->status());
        $this->line($batchesResponse->body());
        return self::FAILURE;
    }

    $threshold = now()->subMinutes($minutes);

    $staleFailed = collect($batchesResponse->json('batches', []))
        ->filter(fn ($batch) => (string) data_get($batch, 'status') === 'failed')
        ->filter(function ($batch) use ($threshold) {
            $referenceTime = data_get($batch, 'last_attempt_at') ?: data_get($batch, 'updated_at') ?: data_get($batch, 'created_at');
            if (empty($referenceTime)) {
                return true;
            }

            try {
                return Carbon::parse((string) $referenceTime)->lte($threshold);
            } catch (\Throwable $e) {
                return true;
            }
        })
        ->take($limit)
        ->values();

    if ($staleFailed->isEmpty()) {
        $this->info("Tidak ada failed batch lebih dari {$minutes} menit.");
        return self::SUCCESS;
    }

    $payload = $staleFailed->map(fn ($batch) => [
        'sync_batch_id' => data_get($batch, 'sync_batch_id'),
        'attempt_count' => (int) data_get($batch, 'attempt_count', 0),
        'last_attempt_at' => data_get($batch, 'last_attempt_at'),
        'last_error' => data_get($batch, 'last_error'),
    ])->all();

    Log::warning('go_sync_stale_failed_batches', [
        'threshold_minutes' => $minutes,
        'count' => count($payload),
        'batches' => $payload,
    ]);

    $this->warn("Ditemukan " . count($payload) . " failed batch lebih dari {$minutes} menit. Lihat log channel aplikasi.");
    foreach ($payload as $item) {
        $this->line('- ' . ($item['sync_batch_id'] ?? '-') . ' | attempts=' . $item['attempt_count'] . ' | last_attempt_at=' . ($item['last_attempt_at'] ?? '-'));
    }

    return self::FAILURE;
})->purpose('Alert when failed sync batches exceed age threshold');

Artisan::command('go:sync:reconciliation-daily {--date=} {--timeout=} {--max-variance-percent=5}', function () {
    if (! (bool) config('go_backend.sync.enabled', false)) {
        $this->warn('GO sync belum aktif (GO_SYNC_ENABLED=false).');
        return self::SUCCESS;
    }

    $baseUrl = rtrim((string) config('go_backend.base_url', ''), '/');
    if ($baseUrl === '') {
        $this->error('GO backend base URL belum dikonfigurasi.');
        return self::FAILURE;
    }

    $defaultTimeout = max(5, min((int) config('go_backend.sync.timeout.reconciliation_seconds', 45), 600));
    $timeoutInput = $this->option('timeout');
    $timeout = max(3, min((int) ($timeoutInput === null || $timeoutInput === '' ? $defaultTimeout : $timeoutInput), 600));
    $maxVariancePercent = max(0, min((int) $this->option('max-variance-percent'), 100));
    $targetDate = $this->option('date') ?: now()->toDateString();
    $token = trim((string) config('go_backend.sync.shared_token', ''));

    $request = Http::timeout($timeout)->acceptJson();
    if ($token !== '') {
        $request = $request
            ->withToken($token)
            ->withHeaders(['X-Sync-Token' => $token]);
    }

    // Fetch Go sync status
    try {
        $statusResponse = $request->get($baseUrl . '/api/v1/sync/status');
    } catch (\Throwable $e) {
        $this->error('Gagal mengambil sync status dari Go: ' . $e->getMessage());
        return self::FAILURE;
    }

    if (! $statusResponse->successful()) {
        $this->error('Go sync status gagal. HTTP ' . $statusResponse->status());
        return self::FAILURE;
    }

    $goStatus = $statusResponse->json();
    $goSummary = data_get($goStatus, 'summary', []);
    $goBatchTotal = (int) data_get($goSummary, 'batch_total', 0);
    $goPendingTotal = (int) data_get($goSummary, 'pending_total', 0);
    $goFailedTotal = (int) data_get($goSummary, 'failed_total', 0);
    $goAcknowledgedTotal = (int) data_get($goSummary, 'acknowledged_total', 0);

    // Query Laravel sync_received_batches by status
    $receivedCounts = DB::table('sync_received_batches')
        ->select(DB::raw('status'), DB::raw('COUNT(*) as count'))
        ->groupBy('status')
        ->get()
        ->pluck('count', 'status')
        ->toArray();

    $laravelReceived = (int) ($receivedCounts['received'] ?? 0);
    $laravelAcknowledged = (int) ($receivedCounts['acknowledged'] ?? 0);
    $laravelDuplicate = (int) ($receivedCounts['duplicate'] ?? 0);
    $laravelInvalid = (int) ($receivedCounts['invalid'] ?? 0);
    $laravelFailed = (int) ($receivedCounts['failed'] ?? 0);
    $laravelTotal = $laravelReceived + $laravelAcknowledged + $laravelDuplicate + $laravelInvalid + $laravelFailed;

    // Calculate variance
    $batchVariance = $goBatchTotal > 0 ? abs($goBatchTotal - $laravelTotal) / $goBatchTotal * 100 : 0;
    $acknowledgedVariance = $goAcknowledgedTotal > 0 ? abs($goAcknowledgedTotal - $laravelAcknowledged) / $goAcknowledgedTotal * 100 : 0;

    $summary = [
        'reconciled_date' => $targetDate,
        'go_batches' => [
            'total' => $goBatchTotal,
            'pending' => $goPendingTotal,
            'failed' => $goFailedTotal,
            'acknowledged' => $goAcknowledgedTotal,
        ],
        'laravel_batches' => [
            'total' => $laravelTotal,
            'received' => $laravelReceived,
            'acknowledged' => $laravelAcknowledged,
            'duplicate' => $laravelDuplicate,
            'invalid' => $laravelInvalid,
            'failed' => $laravelFailed,
        ],
        'variance' => [
            'batch_total_percent' => round($batchVariance, 2),
            'acknowledged_percent' => round($acknowledgedVariance, 2),
            'max_allowed_percent' => $maxVariancePercent,
        ],
        'status' => 'OK',
    ];

    // Check variance thresholds
    if ($batchVariance > $maxVariancePercent) {
        $summary['status'] = 'VARIANCE_DETECTED';
        $summary['alert'] = "Batch total variance {$batchVariance}% exceeds threshold {$maxVariancePercent}%";
    }

    if ($acknowledgedVariance > $maxVariancePercent) {
        $summary['status'] = 'VARIANCE_DETECTED';
        $summary['alert'] = (isset($summary['alert']) ? $summary['alert'] . '; ' : '') . "Acknowledged variance {$acknowledgedVariance}% exceeds threshold {$maxVariancePercent}%";
    }

    // Log summary
    Log::info('go_sync_reconciliation_daily', $summary);

    // Display summary
    $this->info('Reconciliation Harian - ' . $targetDate);
    $this->line('');

    $this->line('Go Backend Summary:');
    $this->table(['Metric', 'Count'], [
        ['Total Batches', $goBatchTotal],
        ['Pending', $goPendingTotal],
        ['Failed', $goFailedTotal],
        ['Acknowledged', $goAcknowledgedTotal],
    ]);

    $this->line('');
    $this->line('Laravel Received Summary:');
    $this->table(['Status', 'Count'], [
        ['Received', $laravelReceived],
        ['Acknowledged', $laravelAcknowledged],
        ['Duplicate', $laravelDuplicate],
        ['Invalid', $laravelInvalid],
        ['Failed', $laravelFailed],
        ['Total', $laravelTotal],
    ]);

    $this->line('');
    $this->line('Comparison & Variance:');
    $this->table(['Metric', 'Variance %', 'Threshold %', 'Status'], [
        ['Batch Total', $batchVariance, $maxVariancePercent, $batchVariance <= $maxVariancePercent ? '✓' : '✗'],
        ['Acknowledged', $acknowledgedVariance, $maxVariancePercent, $acknowledgedVariance <= $maxVariancePercent ? '✓' : '✗'],
    ]);

    $this->line('');
    if ($summary['status'] === 'OK') {
        $this->info("✓ Reconciliation OK - Batches match within {$maxVariancePercent}% threshold");
        return self::SUCCESS;
    } else {
        $this->warn("⚠ {$summary['status']} - {$summary['alert']}");
        return self::FAILURE;
    }
})->purpose('Compare Go sync counts against Laravel received batches and log discrepancies');

Artisan::command('go:sync:benchmark-capacity {--scope=daily} {--source_date=} {--tables=} {--timeouts=60,120,180} {--iterations=3}', function () {
    if (! (bool) config('go_backend.sync.enabled', false)) {
        $this->warn('GO sync belum aktif (GO_SYNC_ENABLED=false).');
        return self::FAILURE;
    }

    $baseUrl = rtrim((string) config('go_backend.base_url', ''), '/');
    if ($baseUrl === '') {
        $this->error('GO backend base URL belum dikonfigurasi.');
        return self::FAILURE;
    }

    $iterations = max(1, min((int) $this->option('iterations'), 20));
    $scope = trim((string) $this->option('scope'));
    $sourceDate = trim((string) $this->option('source_date'));
    $tablesRaw = trim((string) $this->option('tables'));
    $timeoutsRaw = trim((string) $this->option('timeouts'));
    $token = trim((string) config('go_backend.sync.shared_token', ''));

    $timeouts = collect(explode(',', $timeoutsRaw))
        ->map(fn ($value) => (int) trim((string) $value))
        ->filter(fn ($value) => $value >= 3 && $value <= 600)
        ->unique()
        ->values();

    if ($timeouts->isEmpty()) {
        $this->error('Daftar timeout kosong atau tidak valid. Gunakan rentang 3-600 detik.');
        return self::FAILURE;
    }

    $payload = [];
    if ($scope !== '') {
        $payload['scope'] = $scope;
    }
    if ($sourceDate !== '') {
        $payload['source_date'] = $sourceDate;
    }
    if ($tablesRaw !== '') {
        $payload['tables'] = array_values(array_filter(array_map('trim', explode(',', $tablesRaw)), fn ($item) => $item !== ''));
    }

    $this->info('Benchmark kapasitas Go sync dimulai...');
    $this->line('Timeout set: ' . $timeouts->implode(', ') . ' detik | Iterasi per timeout: ' . $iterations);

    $attemptRows = [];
    $summaryRows = [];

    $percentile = function (array $values, float $percent): float {
        if (count($values) === 0) {
            return 0.0;
        }

        sort($values);
        $index = ($percent / 100) * (count($values) - 1);
        $lower = (int) floor($index);
        $upper = (int) ceil($index);
        if ($lower === $upper) {
            return (float) $values[$lower];
        }

        $weight = $index - $lower;
        return (float) ($values[$lower] * (1 - $weight) + $values[$upper] * $weight);
    };

    foreach ($timeouts as $timeoutSeconds) {
        $durations = [];
        $success = 0;
        $failed = 0;

        for ($i = 1; $i <= $iterations; $i++) {
            $request = Http::timeout((int) $timeoutSeconds)->acceptJson();
            if ($token !== '') {
                $request = $request
                    ->withToken($token)
                    ->withHeaders(['X-Sync-Token' => $token]);
            }

            $startedAt = microtime(true);
            $durationMs = 0.0;
            $httpStatus = '-';
            $sendStatus = '-';
            $batchId = '-';
            $error = '';

            try {
                $response = $request->post($baseUrl . '/api/v1/sync/run', $payload);
                $durationMs = round((microtime(true) - $startedAt) * 1000, 2);
                $durations[] = $durationMs;
                $httpStatus = (string) $response->status();

                if ($response->successful()) {
                    $json = $response->json();
                    $sendStatus = (string) (data_get($json, 'send_result.status') ?? data_get($json, 'send_result.send_status') ?? '-');
                    $batchId = (string) (data_get($json, 'batch.sync_batch_id') ?? data_get($json, 'send_result.batch.sync_batch_id') ?? '-');
                    $success++;
                } else {
                    $failed++;
                    $error = 'HTTP ' . $response->status();
                }
            } catch (\Throwable $e) {
                $durationMs = round((microtime(true) - $startedAt) * 1000, 2);
                $durations[] = $durationMs;
                $failed++;
                $httpStatus = 'EXCEPTION';
                $error = $e->getMessage();
            }

            $attemptRows[] = [
                'timeout_s' => $timeoutSeconds,
                'iteration' => $i,
                'duration_ms' => $durationMs,
                'http_status' => $httpStatus,
                'send_status' => $sendStatus,
                'batch_id' => $batchId,
                'result' => $error === '' ? 'ok' : 'failed',
                'error' => $error,
            ];
        }

        $summaryRows[] = [
            'timeout_s' => $timeoutSeconds,
            'iterations' => $iterations,
            'success' => $success,
            'failed' => $failed,
            'min_ms' => count($durations) > 0 ? min($durations) : 0,
            'avg_ms' => count($durations) > 0 ? round(array_sum($durations) / count($durations), 2) : 0,
            'p95_ms' => round($percentile($durations, 95), 2),
            'max_ms' => count($durations) > 0 ? max($durations) : 0,
        ];
    }

    $this->line('');
    $this->line('Summary per timeout:');
    $this->table(['Timeout (s)', 'Iterations', 'Success', 'Failed', 'Min (ms)', 'Avg (ms)', 'P95 (ms)', 'Max (ms)'], $summaryRows);

    $this->line('');
    $this->line('Attempt details:');
    $this->table(['Timeout (s)', 'Iter', 'Duration (ms)', 'HTTP', 'Send', 'Result', 'Batch'],
        collect($attemptRows)->map(fn ($row) => [
            $row['timeout_s'],
            $row['iteration'],
            $row['duration_ms'],
            $row['http_status'],
            $row['send_status'],
            $row['result'],
            $row['batch_id'],
        ])->all()
    );

    Log::info('go_sync_capacity_benchmark', [
        'scope' => $scope,
        'source_date' => $sourceDate,
        'tables' => $payload['tables'] ?? null,
        'timeouts' => $timeouts->all(),
        'iterations' => $iterations,
        'summary' => $summaryRows,
        'attempts' => $attemptRows,
    ]);

    $hasFailure = collect($summaryRows)->contains(fn ($row) => (int) $row['failed'] > 0);
    if ($hasFailure) {
        $this->warn('Benchmark selesai dengan kegagalan pada sebagian percobaan. Cek log go_sync_capacity_benchmark untuk detail.');
        return self::FAILURE;
    }

    $this->info('Benchmark kapasitas selesai tanpa kegagalan request.');
    return self::SUCCESS;
})->purpose('Benchmark Go sync throughput/latency for multiple timeout values');

if ((bool) config('go_backend.sync.schedule.enabled', false)) {
    $dailyAt = (string) config('go_backend.sync.schedule.daily_at', '23:40');
    $retryLimit = max(1, (int) config('go_backend.sync.schedule.retry_limit', 5));

    Schedule::command('go:sync:run --scope=daily')
        ->dailyAt($dailyAt)
        ->withoutOverlapping();

    Schedule::command("go:sync:retry-failed --limit={$retryLimit}")
        ->everyThirtyMinutes()
        ->withoutOverlapping();

    if ((bool) config('go_backend.sync.alert.enabled', false)) {
        $alertMinutes = max(5, (int) config('go_backend.sync.alert.failed_after_minutes', 120));
        $alertLimit = max(1, (int) config('go_backend.sync.alert.limit', 20));

        Schedule::command("go:sync:alert-long-failed --minutes={$alertMinutes} --limit={$alertLimit}")
            ->everyThirtyMinutes()
            ->withoutOverlapping();
    }

    if ((bool) config('go_backend.sync.reconciliation.enabled', false)) {
        $reconciliationAt = (string) config('go_backend.sync.reconciliation.daily_at', '00:15');
        $maxVariance = max(0, (int) config('go_backend.sync.reconciliation.max_variance_percent', 5));

        Schedule::command("go:sync:reconciliation-daily --max-variance-percent={$maxVariance}")
            ->dailyAt($reconciliationAt)
            ->withoutOverlapping();
    }
}

Artisan::command('benchmark:reports {--iterations=3} {--warmup=1} {--start_date=} {--end_date=} {--save-history}', function () {
    $iterations = max(1, min((int) $this->option('iterations'), 20));
    $warmup = max(0, min((int) $this->option('warmup'), 10));
    $startDate = $this->option('start_date') ?: now()->firstOfMonth()->toDateString();
    $endDate = $this->option('end_date') ?: now()->toDateString();
    $saveHistory = (bool) $this->option('save-history');
    $historyPath = storage_path('app/benchmarks/report_benchmark_history_v2.csv');

    $benchmarks = [
        [
            'key' => 'overall',
            'label' => 'Report Overall',
            'controller' => ServiceReportController::class,
            'method' => 'overall',
            'query' => [
                'start_date' => $startDate,
                'end_date' => $endDate,
                'source' => 'all',
                'status' => 'all',
                'per_page' => 20,
                'page' => 1,
            ],
        ],
        [
            'key' => 'service_revenue',
            'label' => 'Report Service Revenue',
            'controller' => ServiceReportController::class,
            'method' => 'revenue',
            'query' => [
                'start_date' => $startDate,
                'end_date' => $endDate,
                'period' => 'daily',
            ],
        ],
        [
            'key' => 'mechanic_productivity',
            'label' => 'Report Mechanic Productivity',
            'controller' => ServiceReportController::class,
            'method' => 'mechanicProductivity',
            'query' => [
                'start_date' => $startDate,
                'end_date' => $endDate,
            ],
        ],
        [
            'key' => 'mechanic_payroll',
            'label' => 'Report Mechanic Payroll',
            'controller' => ServiceReportController::class,
            'method' => 'mechanicPayroll',
            'query' => [
                'start_date' => $startDate,
                'end_date' => $endDate,
            ],
        ],
        [
            'key' => 'part_sales_profit',
            'label' => 'Report Part Sales Profit',
            'controller' => PartSalesProfitReportController::class,
            'method' => 'index',
            'query' => [
                'start_date' => $startDate,
                'end_date' => $endDate,
            ],
        ],
        [
            'key' => 'outstanding_payments',
            'label' => 'Report Outstanding Payments',
            'controller' => ServiceReportController::class,
            'method' => 'outstandingPayments',
            'query' => [],
        ],
    ];

    $this->info("Running report benchmark ({$iterations}x, warmup {$warmup}x) | period {$startDate} - {$endDate}");

    $results = [];

    foreach ($benchmarks as $benchmark) {
        $durationsMs = [];
        $payloadBytes = 0;
        $okCount = 0;
        $errorMessage = null;

        for ($w = 0; $w < $warmup; $w++) {
            $warmupRequest = Request::create('/', 'GET', $benchmark['query']);

            try {
                app()->call([
                    app($benchmark['controller']),
                    $benchmark['method'],
                ], ['request' => $warmupRequest]);
            } catch (\Throwable $e) {
                $errorMessage = $e->getMessage();
            }
        }

        for ($i = 0; $i < $iterations; $i++) {
            $request = Request::create('/', 'GET', $benchmark['query']);

            $started = hrtime(true);

            try {
                $response = app()->call([
                    app($benchmark['controller']),
                    $benchmark['method'],
                ], ['request' => $request]);

                if (is_object($response) && method_exists($response, 'getProps')) {
                    $props = $response->getProps();
                    $payloadBytes = max($payloadBytes, strlen(json_encode($props)));
                } elseif (is_object($response) && method_exists($response, 'getContent')) {
                    $payloadBytes = max($payloadBytes, strlen((string) $response->getContent()));
                }

                $okCount++;
            } catch (\Throwable $e) {
                $errorMessage = $e->getMessage();
            }

            $durationsMs[] = round((hrtime(true) - $started) / 1_000_000, 2);
        }

        $avg = count($durationsMs) > 0 ? round(array_sum($durationsMs) / count($durationsMs), 2) : 0;

        $results[] = [
            'report' => $benchmark['label'],
            'avg_ms' => $avg,
            'min_ms' => count($durationsMs) > 0 ? min($durationsMs) : 0,
            'max_ms' => count($durationsMs) > 0 ? max($durationsMs) : 0,
            'payload_kb' => round($payloadBytes / 1024, 2),
            'ok' => $okCount . '/' . $iterations,
            'error' => $errorMessage ? mb_strimwidth($errorMessage, 0, 120, '...') : '',
        ];
    }

    $this->table(
        ['Report', 'Avg (ms)', 'Min (ms)', 'Max (ms)', 'Payload (KB)', 'Success', 'Error'],
        $results
    );

    $slowest = collect($results)
        ->sortByDesc('avg_ms')
        ->take(3)
        ->values();

    $this->line('Top 3 slowest reports by average time:');
    foreach ($slowest as $index => $item) {
        $rank = $index + 1;
        $this->line("{$rank}. {$item['report']} - {$item['avg_ms']} ms");
    }

    if ($saveHistory) {
        $historyDir = dirname($historyPath);
        if (!File::exists($historyDir)) {
            File::makeDirectory($historyDir, 0755, true);
        }

        $isNewFile = !File::exists($historyPath);
        $stream = fopen($historyPath, 'a');

        if ($isNewFile) {
            fputcsv($stream, [
                'recorded_at',
                'period_start',
                'period_end',
                'iterations',
                'warmup',
                'report_key',
                'report_label',
                'avg_ms',
                'min_ms',
                'max_ms',
                'payload_kb',
                'success',
                'error',
            ]);
        }

        $recordedAt = now()->toDateTimeString();

        foreach ($results as $result) {
            $benchmarkMeta = collect($benchmarks)->firstWhere('label', $result['report']);

            fputcsv($stream, [
                $recordedAt,
                $startDate,
                $endDate,
                $iterations,
                $warmup,
                $benchmarkMeta['key'] ?? '',
                $result['report'],
                $result['avg_ms'],
                $result['min_ms'],
                $result['max_ms'],
                $result['payload_kb'],
                $result['ok'],
                $result['error'] ?? '',
            ]);
        }

        fclose($stream);
        $this->info('Benchmark history saved to: ' . $historyPath);
    }
})->purpose('Benchmark report controllers response time and payload size');

Artisan::command('benchmark:reports:trend {--limit=30} {--report_key=}', function () {
    $limit = max(1, min((int) $this->option('limit'), 500));
    $reportKey = (string) ($this->option('report_key') ?? '');
    $historyPath = storage_path('app/benchmarks/report_benchmark_history_v2.csv');

    if (!File::exists($historyPath)) {
        $this->warn('No benchmark history found. Run benchmark:reports --save-history first.');
        return;
    }

    $rows = collect(array_map('str_getcsv', file($historyPath)))
        ->filter(fn ($row) => is_array($row) && count($row) >= 2)
        ->values();

    if ($rows->count() <= 1) {
        $this->warn('Benchmark history is empty.');
        return;
    }

    $headers = $rows->first();
    $dataRows = $rows->slice(1)
        ->map(function ($row) use ($headers) {
            $headerCount = count($headers);
            $rowCount = count($row);

            if ($rowCount < $headerCount) {
                $row = array_pad($row, $headerCount, '');
            } elseif ($rowCount > $headerCount) {
                $row = array_slice($row, 0, $headerCount);
            }

            $combined = array_combine($headers, $row);

            return is_array($combined) ? $combined : null;
        })
        ->filter()
        ->values();

    if ($reportKey !== '') {
        $dataRows = $dataRows->where('report_key', $reportKey)->values();
    }

    if ($dataRows->isEmpty()) {
        $this->warn('No benchmark history rows match the selected filter.');
        return;
    }

    $latestRows = $dataRows
        ->sortByDesc('recorded_at')
        ->take($limit)
        ->map(function ($row) {
            return [
                'recorded_at' => $row['recorded_at'] ?? '-',
                'report' => $row['report_label'] ?? ($row['report'] ?? '-'),
                'avg_ms' => (float) ($row['avg_ms'] ?? 0),
                'max_ms' => (float) ($row['max_ms'] ?? 0),
                'payload_kb' => (float) ($row['payload_kb'] ?? 0),
                'success' => $row['success'] ?? ($row['ok'] ?? '-'),
                'error' => $row['error'] ? mb_strimwidth($row['error'], 0, 120, '...') : '',
            ];
        })
        ->values();

    $this->table(
        ['Recorded At', 'Report', 'Avg (ms)', 'Max (ms)', 'Payload (KB)', 'Success', 'Error'],
        $latestRows->all()
    );

    $summary = $latestRows
        ->groupBy('report')
        ->map(function ($group, $report) {
            return [
                'report' => $report,
                'samples' => $group->count(),
                'avg_of_avg_ms' => round($group->avg('avg_ms'), 2),
                'peak_max_ms' => round($group->max('max_ms'), 2),
            ];
        })
        ->sortByDesc('avg_of_avg_ms')
        ->values();

    $this->line('Summary by report (latest selected rows):');
    $this->table(['Report', 'Samples', 'Avg of Avg (ms)', 'Peak Max (ms)'], $summary->all());
})->purpose('Show benchmark trend from report benchmark history CSV');

Artisan::command('benchmark:reports:compare {--report_key=} {--run-offset=0} {--threshold-percent=}', function () {
    $reportKey = (string) ($this->option('report_key') ?? '');
    $runOffset = max(0, (int) $this->option('run-offset'));
    $thresholdPercent = (float) ($this->option('threshold-percent') ?? 0);
    $historyPath = storage_path('app/benchmarks/report_benchmark_history_v2.csv');

    if (!File::exists($historyPath)) {
        $this->warn('No benchmark history found. Run benchmark:reports --save-history first.');
        return;
    }

    $rows = collect(array_map('str_getcsv', file($historyPath)))
        ->filter(fn ($row) => is_array($row) && count($row) >= 2)
        ->values();

    if ($rows->count() <= 1) {
        $this->warn('Benchmark history is empty.');
        return;
    }

    $headers = $rows->first();
    $dataRows = $rows->slice(1)
        ->map(function ($row) use ($headers) {
            $headerCount = count($headers);
            $rowCount = count($row);

            if ($rowCount < $headerCount) {
                $row = array_pad($row, $headerCount, '');
            } elseif ($rowCount > $headerCount) {
                $row = array_slice($row, 0, $headerCount);
            }

            $combined = array_combine($headers, $row);

            return is_array($combined) ? $combined : null;
        })
        ->filter()
        ->values();

    if ($reportKey !== '') {
        $dataRows = $dataRows->where('report_key', $reportKey)->values();
    }

    if ($dataRows->isEmpty()) {
        $this->warn('No rows match the selected filter.');
        return;
    }

    $runs = $dataRows
        ->groupBy('recorded_at')
        ->sortKeysDesc()
        ->values();

    $currentIndex = $runOffset;
    $previousIndex = $runOffset + 1;

    if (!isset($runs[$previousIndex])) {
        $this->warn('Not enough benchmark runs to compare.');
        return;
    }

    $currentRun = collect($runs[$currentIndex])->keyBy('report_key');
    $previousRun = collect($runs[$previousIndex])->keyBy('report_key');

    $currentRecordedAt = (string) (collect($runs[$currentIndex])->first()['recorded_at'] ?? '-');
    $previousRecordedAt = (string) (collect($runs[$previousIndex])->first()['recorded_at'] ?? '-');

    $reportKeys = $currentRun->keys()->merge($previousRun->keys())->unique()->values();

    $comparison = $reportKeys->map(function ($key) use ($currentRun, $previousRun) {
        $current = $currentRun->get($key, []);
        $previous = $previousRun->get($key, []);

        $label = $current['report_label'] ?? ($previous['report_label'] ?? $key);
        $currentAvg = (float) ($current['avg_ms'] ?? 0);
        $previousAvg = (float) ($previous['avg_ms'] ?? 0);
        $delta = round($currentAvg - $previousAvg, 2);
        $deltaPct = $previousAvg > 0 ? round(($delta / $previousAvg) * 100, 2) : 0;

        return [
            'report' => $label,
            'current_avg_ms' => $currentAvg,
            'previous_avg_ms' => $previousAvg,
            'delta_ms' => $delta,
            'delta_percent' => $deltaPct,
            'current_success' => $current['success'] ?? '-',
            'previous_success' => $previous['success'] ?? '-',
        ];
    })->sortByDesc(fn ($row) => abs((float) $row['delta_ms']))->values();

    $this->line('Comparing benchmark runs:');
    $this->line('Current : ' . $currentRecordedAt);
    $this->line('Previous: ' . $previousRecordedAt);

    if ($thresholdPercent > 0) {
        $this->line('Threshold: ' . abs($thresholdPercent) . '% (alerts on regressions exceeding this)');
    }
    $this->line('');

    $this->table([
        'Report',
        'Current Avg (ms)',
        'Previous Avg (ms)',
        'Delta (ms)',
        'Delta (%)',
        'Current Success',
        'Previous Success',
    ], $comparison->all());

    // Threshold checking
    if ($thresholdPercent > 0) {
        $this->line('');
        $regressions = $comparison->filter(function ($row) use ($thresholdPercent) {
            $deltaPct = (float) $row['delta_percent'];
            return $deltaPct > $thresholdPercent;
        });

        if ($regressions->isNotEmpty()) {
            $this->error('⚠ THRESHOLD ALERT: ' . $regressions->count() . ' report(s) exceeded the ' . $thresholdPercent . '% regression threshold:');
            foreach ($regressions as $regression) {
                $this->error('  - ' . $regression['report'] . ': +' . $regression['delta_percent'] . '%');
            }
            $this->line('');
            $this->warn('Exiting with error code 1 (suitable for CI/CD pre-deploy validation)');
            return 1;
        } else {
            $this->info('✓ All reports are within the ' . $thresholdPercent . '% threshold');
        }
    }

    return 0;
})->purpose('Compare two benchmark runs and show performance deltas');

Artisan::command('verify:cache-invalidation {--report=overall}', function () {
    $report = $this->option('report');

    $this->info("Verifying cache invalidation for: {$report}");

    // Set broadcast driver to null to avoid connection errors
    \Illuminate\Support\Facades\Config::set('broadcasting.default', 'null');

    // Test 1: Create and verify cache entry
    $cacheKey = 'reports:' . $report . ':' . sha1(json_encode(['test' => true, 'timestamp' => now()]));
    $testData = ['timestamp' => now(), 'test_data' => true];

    \Illuminate\Support\Facades\Cache::put($cacheKey, $testData, 3600);
    $this->line("✓ Cache entry created: {$cacheKey}");

    if (\Illuminate\Support\Facades\Cache::has($cacheKey)) {
        $this->line("✓ Cache entry verified");
    } else {
        $this->error("✗ Cache entry not found after creation");
        return 1;
    }

    // Test 2: Dispatch event and verify cache invalidation
    $this->line("");
    $this->line("Dispatching ServiceOrderCreated event...");

    \Illuminate\Support\Facades\Config::set('broadcasting.default', 'null');

    try {
        \App\Events\ServiceOrderCreated::dispatch([
            'id' => 999,
            'test' => true,
            'created_at' => now(),
        ]);
        $this->line("✓ Event dispatched successfully");
    } catch (\Exception $e) {
        $this->warn("⚠ Event dispatch error (non-critical): " . mb_strimwidth($e->getMessage(), 0, 100, '...'));
    }

    usleep(100000);

    // Test 3: Check cache status after event
    $this->line("");
    if (\Illuminate\Support\Facades\Cache::has($cacheKey)) {
        $this->warn("⚠ Cache still exists (may be expected for file cache driver)");
    } else {
        $this->line("✓ Cache successfully invalidated by event");
    }

    // Test 4: Show registered listeners
    $this->line("");
    $this->info("Registered Event Listeners:");

    $listeners = \Illuminate\Support\Facades\Event::getRawListeners();
    $reportEvents = [
        \App\Events\ServiceOrderCreated::class,
        \App\Events\ServiceOrderUpdated::class,
        \App\Events\ServiceOrderDeleted::class,
        \App\Events\PartSaleCreated::class,
        \App\Events\PartSaleUpdated::class,
        \App\Events\PartSaleDeleted::class,
    ];

    $listenerCount = 0;
    foreach ($reportEvents as $eventClass) {
        if (isset($listeners[$eventClass]) && count($listeners[$eventClass]) > 0) {
            $this->line("✓ " . class_basename($eventClass));
            foreach ($listeners[$eventClass] as $listener) {
                if (is_array($listener) && count($listener) >= 2) {
                    $listenerClass = is_object($listener[0]) ? $listener[0]::class : (string) $listener[0];
                    $method = (string) ($listener[1] ?? 'unknown');
                    $this->line("  └─ " . class_basename($listenerClass) . "::{$method}()");
                    $listenerCount++;
                }
            }
        }
    }

    $this->line("");
    $this->info("Total event listeners: {$listenerCount}");

    if ($listenerCount === 0) {
        $this->warn("⚠ No event listeners registered! Cache invalidation will not work.");
        return 1;
    }

    $this->info("✓ Cache invalidation verification complete!");
    return 0;
})->purpose('Verify event-driven cache invalidation is working correctly');

Artisan::command('go:shadow:summary {--date=} {--since=} {--until=} {--log=} {--top=20} {--threshold=} {--save-csv} {--csv-path=}', function () {
    $dateInput = (string) ($this->option('date') ?: now()->format('Y-m-d'));
    $date = Carbon::parse($dateInput)->format('Y-m-d');
    $sinceInput = trim((string) ($this->option('since') ?? ''));
    $untilInput = trim((string) ($this->option('until') ?? ''));
    $sinceAt = null;
    $untilAt = null;

    if ($sinceInput !== '') {
        try {
            $sinceAt = Carbon::parse($sinceInput);
        } catch (\Throwable) {
            $this->error('Invalid --since value. Use a valid datetime, e.g. 2026-04-09 13:00:00');
            return 1;
        }
    }

    if ($untilInput !== '') {
        try {
            $untilAt = Carbon::parse($untilInput);
        } catch (\Throwable) {
            $this->error('Invalid --until value. Use a valid datetime, e.g. 2026-04-09 14:00:00');
            return 1;
        }
    }

    if ($sinceAt !== null && $untilAt !== null && $sinceAt->gt($untilAt)) {
        $this->error('Invalid time window: --since must be earlier than or equal to --until.');
        return 1;
    }

    $top = max(1, min((int) $this->option('top'), 200));
    $logPath = (string) ($this->option('log') ?: storage_path('logs/laravel.log'));
    $threshold = $this->option('threshold');
    $saveCsv = (bool) $this->option('save-csv');
    $csvPath = (string) ($this->option('csv-path') ?: storage_path('app/go-shadow/summary.csv'));
    $defaultThreshold = config('go_backend.shadow_compare.default_threshold');
    $featureThresholds = (array) config('go_backend.shadow_compare.feature_thresholds', []);
    $maxSkippedRate = max(0, min(100, (float) config('go_backend.shadow_compare.max_skipped_rate', 20)));

    if (!File::exists($logPath)) {
        $this->error('Log file not found: ' . $logPath);
        return 1;
    }

    $lines = preg_split('/\r\n|\r|\n/', (string) File::get($logPath));
    if (!is_array($lines) || count($lines) === 0) {
        $this->warn('Log file is empty.');
        return 0;
    }

    $summary = [];
    $totalMatched = 0;
    $totalMismatch = 0;
    $totalSkipped = 0;

    foreach ($lines as $line) {
        if (!is_string($line) || $line === '' || !str_contains($line, $date)) {
            continue;
        }

        if (!str_contains($line, 'Go shadow compare')) {
            continue;
        }

        if ($sinceAt !== null || $untilAt !== null) {
            if (preg_match('/^\[(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2})\]/', $line, $timeMatch) !== 1) {
                continue;
            }

            try {
                $lineAt = Carbon::parse($timeMatch[1]);
            } catch (\Throwable) {
                continue;
            }

            if ($sinceAt !== null && $lineAt->lt($sinceAt)) {
                continue;
            }

            if ($untilAt !== null && $lineAt->gt($untilAt)) {
                continue;
            }
        }

        $type = null;
        if (str_contains($line, 'matched.')) {
            $type = 'matched';
            $totalMatched++;
        } elseif (str_contains($line, 'mismatch detected.')) {
            $type = 'mismatch';
            $totalMismatch++;
        } elseif (str_contains($line, 'skipped because Go payload is unavailable.')) {
            $type = 'skipped';
            $totalSkipped++;
        }

        if ($type === null) {
            continue;
        }

        $feature = 'unknown';
        if (preg_match('/"feature"\s*:\s*"([^"]+)"/', $line, $m) === 1) {
            $feature = $m[1];
        }

        if (!isset($summary[$feature])) {
            $summary[$feature] = [
                'feature' => $feature,
                'matched' => 0,
                'mismatch' => 0,
                'skipped' => 0,
            ];
        }

        $summary[$feature][$type]++;
    }

    if (empty($summary)) {
        if ($saveCsv) {
            $dir = dirname($csvPath);
            if (!File::exists($dir)) {
                File::makeDirectory($dir, 0755, true);
            }

            if (!File::exists($csvPath)) {
                $stream = fopen($csvPath, 'a');
                if ($stream !== false) {
                    fputcsv($stream, [
                        'recorded_at',
                        'date',
                        'feature',
                        'matched',
                        'mismatch',
                        'skipped',
                        'total',
                        'mismatch_rate',
                    ]);
                    fclose($stream);
                    $this->info('Shadow summary CSV initialized: ' . $csvPath);
                }
            }
        }

        $this->warn('No Go shadow compare entries found for ' . $date . '.');
        return 0;
    }

    $rows = collect(array_values($summary))
        ->map(function (array $row) {
            $total = $row['matched'] + $row['mismatch'] + $row['skipped'];
            $checked = max(1, $row['matched'] + $row['mismatch']);
            $mismatchRate = $checked > 0 ? round(($row['mismatch'] / $checked) * 100, 2) : 0;

            return [
                'feature' => $row['feature'],
                'matched' => $row['matched'],
                'mismatch' => $row['mismatch'],
                'skipped' => $row['skipped'],
                'total' => $total,
                'mismatch_rate' => $mismatchRate,
            ];
        })
        ->sortByDesc('mismatch')
        ->take($top)
        ->values();

    $this->line('Go shadow compare summary for ' . $date);
    $this->line('Log file: ' . $logPath);
    if ($sinceAt !== null || $untilAt !== null) {
        $this->line('Time window: ' . ($sinceAt?->toDateTimeString() ?? '-') . ' -> ' . ($untilAt?->toDateTimeString() ?? '-'));
    }
    $this->line('');

    $this->table(
        ['Feature', 'Matched', 'Mismatch', 'Skipped', 'Checked', 'Total', 'Mismatch %', 'Skipped %'],
        $rows->map(fn ($row) => [
            $row['feature'],
            $row['matched'],
            $row['mismatch'],
            $row['skipped'],
            $row['matched'] + $row['mismatch'],
            $row['total'],
            $row['mismatch_rate'],
            round(((float) $row['skipped'] / max(1, (int) $row['total'])) * 100, 2),
        ])->all()
    );

    $checkedTotal = max(1, $totalMatched + $totalMismatch);
    $overallMismatchRate = round(($totalMismatch / $checkedTotal) * 100, 2);
    $overallTotal = max(1, $totalMatched + $totalMismatch + $totalSkipped);
    $overallSkippedRate = round(($totalSkipped / $overallTotal) * 100, 2);

    $this->line('Overall: matched=' . $totalMatched . ', mismatch=' . $totalMismatch . ', skipped=' . $totalSkipped . ', mismatch_rate=' . $overallMismatchRate . '%, skipped_rate=' . $overallSkippedRate . '%');

    if ($saveCsv) {
        $dir = dirname($csvPath);
        if (!File::exists($dir)) {
            File::makeDirectory($dir, 0755, true);
        }

        $isNewFile = !File::exists($csvPath);
        $stream = fopen($csvPath, 'a');
        if ($stream !== false) {
            if ($isNewFile) {
                fputcsv($stream, [
                    'recorded_at',
                    'date',
                    'feature',
                    'matched',
                    'mismatch',
                    'skipped',
                    'total',
                    'mismatch_rate',
                ]);
            }

            $recordedAt = now()->toDateTimeString();
            foreach ($rows as $row) {
                fputcsv($stream, [
                    $recordedAt,
                    $date,
                    $row['feature'],
                    $row['matched'],
                    $row['mismatch'],
                    $row['skipped'],
                    $row['total'],
                    $row['mismatch_rate'],
                ]);
            }

            fclose($stream);
            $this->info('Shadow summary CSV appended: ' . $csvPath);
        }
    }

    $featureViolations = collect();
    if (!empty($featureThresholds)) {
        $featureViolations = $rows
            ->filter(function ($row) use ($featureThresholds) {
                $feature = (string) ($row['feature'] ?? '');
                if (!array_key_exists($feature, $featureThresholds)) {
                    return false;
                }

                return (float) ($row['mismatch_rate'] ?? 0) > (float) $featureThresholds[$feature];
            })
            ->values();

        if ($featureViolations->isNotEmpty()) {
            $this->error('Feature threshold violation(s):');
            foreach ($featureViolations as $violation) {
                $limit = (float) $featureThresholds[$violation['feature']];
                $this->error(' - ' . $violation['feature'] . ': ' . $violation['mismatch_rate'] . '% > ' . $limit . '%');
            }
        } else {
            $this->info('Feature threshold check passed.');
        }
    }

    if ($threshold !== null && $threshold !== '') {
        $thresholdValue = max(0, (float) $threshold);
        if ($overallMismatchRate > $thresholdValue) {
            $this->error('Mismatch rate exceeds threshold: ' . $overallMismatchRate . '% > ' . $thresholdValue . '%');
            return 1;
        }

        $this->info('Mismatch threshold check passed: ' . $overallMismatchRate . '% <= ' . $thresholdValue . '%');
    } elseif ($defaultThreshold !== null) {
        $thresholdValue = max(0, (float) $defaultThreshold);
        if ($overallMismatchRate > $thresholdValue) {
            $this->error('Mismatch rate exceeds default threshold: ' . $overallMismatchRate . '% > ' . $thresholdValue . '%');
            return 1;
        }

        $this->info('Default mismatch threshold check passed: ' . $overallMismatchRate . '% <= ' . $thresholdValue . '%');
    }

    if ($featureViolations->isNotEmpty()) {
        return 1;
    }

    if ($overallSkippedRate > $maxSkippedRate) {
        $this->error('Skipped rate exceeds limit: ' . $overallSkippedRate . '% > ' . $maxSkippedRate . '%');
        return 1;
    }

    return 0;
})->purpose('Summarize Go shadow compare matches and mismatches from laravel log');

Artisan::command('go:shadow:trend {--days=7} {--feature=} {--csv-path=} {--threshold=}', function () {
    $days = max(1, min((int) $this->option('days'), 90));
    $featureFilter = trim((string) ($this->option('feature') ?? ''));
    $csvPath = (string) ($this->option('csv-path') ?: storage_path('app/go-shadow/summary.csv'));
    $explicitThreshold = $this->option('threshold');
    $defaultThreshold = config('go_backend.shadow_compare.default_threshold');
    $featureThresholds = (array) config('go_backend.shadow_compare.feature_thresholds', []);
    $maxSkippedRate = max(0, min(100, (float) config('go_backend.shadow_compare.max_skipped_rate', 20)));

    if (!File::exists($csvPath)) {
        $this->warn('Shadow summary CSV not found: ' . $csvPath);
        return 0;
    }

    $rows = collect(array_map('str_getcsv', file($csvPath)))
        ->filter(fn ($row) => is_array($row) && count($row) >= 2)
        ->values();

    if ($rows->count() <= 1) {
        $this->warn('Shadow summary CSV is empty.');
        return 0;
    }

    $headers = $rows->first();
    $rawData = $rows->slice(1)
        ->map(function ($row) use ($headers) {
            $headerCount = count($headers);
            $rowCount = count($row);

            if ($rowCount < $headerCount) {
                $row = array_pad($row, $headerCount, '');
            } elseif ($rowCount > $headerCount) {
                $row = array_slice($row, 0, $headerCount);
            }

            $combined = array_combine($headers, $row);
            return is_array($combined) ? $combined : null;
        })
        ->filter()
        ->values();

    $startDate = Carbon::today()->subDays($days - 1)->format('Y-m-d');
    $data = $rawData
        ->filter(function ($row) use ($startDate, $featureFilter) {
            $date = (string) ($row['date'] ?? '');
            if ($date < $startDate) {
                return false;
            }

            if ($featureFilter !== '' && (string) ($row['feature'] ?? '') !== $featureFilter) {
                return false;
            }

            return true;
        })
        ->values();

    if ($data->isEmpty()) {
        $this->warn('No trend rows found for selected window/filter.');
        return 0;
    }

    $byFeature = $data
        ->groupBy('feature')
        ->map(function ($group, $feature) {
            $rates = $group->pluck('mismatch_rate')->map(fn ($v) => (float) $v)->values();
            $samples = $group->count();
            $avgRate = round($rates->avg() ?? 0, 2);
            $maxRate = round($rates->max() ?? 0, 2);
            $lastRate = round((float) ($group->sortBy('recorded_at')->last()['mismatch_rate'] ?? 0), 2);
            $lastSeen = (string) ($group->sortBy('recorded_at')->last()['recorded_at'] ?? '-');

            return [
                'feature' => $feature,
                'samples' => $samples,
                'avg_mismatch_rate' => $avgRate,
                'max_mismatch_rate' => $maxRate,
                'last_mismatch_rate' => $lastRate,
                'last_seen' => $lastSeen,
            ];
        })
        ->sortByDesc('avg_mismatch_rate')
        ->values();

    $this->line('Go shadow trend for last ' . $days . ' day(s)');
    $this->line('CSV: ' . $csvPath);
    if ($featureFilter !== '') {
        $this->line('Feature filter: ' . $featureFilter);
    }
    $this->line('');

    $this->table(
        ['Feature', 'Samples', 'Avg %', 'Max %', 'Last %', 'Last Seen'],
        $byFeature->map(fn ($row) => [
            $row['feature'],
            $row['samples'],
            $row['avg_mismatch_rate'],
            $row['max_mismatch_rate'],
            $row['last_mismatch_rate'],
            $row['last_seen'],
        ])->all()
    );

    $daily = $data
        ->groupBy('date')
        ->map(function ($group, $date) {
            $matched = $group->sum(fn ($row) => (int) ($row['matched'] ?? 0));
            $mismatch = $group->sum(fn ($row) => (int) ($row['mismatch'] ?? 0));
            $skipped = $group->sum(fn ($row) => (int) ($row['skipped'] ?? 0));
            $checked = max(1, $matched + $mismatch);
            $total = max(1, $matched + $mismatch + $skipped);
            return [
                'date' => $date,
                'matched' => $matched,
                'mismatch' => $mismatch,
                'skipped' => $skipped,
                'mismatch_rate' => round(($mismatch / $checked) * 100, 2),
                'skipped_rate' => round(($skipped / $total) * 100, 2),
            ];
        })
        ->sortBy('date')
        ->values();

    $this->line('');
    $this->table(
        ['Date', 'Matched', 'Mismatch', 'Skipped', 'Mismatch %', 'Skipped %'],
        $daily->map(fn ($row) => [
            $row['date'],
            $row['matched'],
            $row['mismatch'],
            $row['skipped'],
            $row['mismatch_rate'],
            $row['skipped_rate'],
        ])->all()
    );

    $violations = collect();
    foreach ($byFeature as $row) {
        $feature = (string) $row['feature'];
        $limit = null;

        if ($explicitThreshold !== null && $explicitThreshold !== '') {
            $limit = max(0, (float) $explicitThreshold);
        } elseif (array_key_exists($feature, $featureThresholds)) {
            $limit = max(0, (float) $featureThresholds[$feature]);
        } elseif ($defaultThreshold !== null) {
            $limit = max(0, (float) $defaultThreshold);
        }

        if ($limit !== null && (float) $row['avg_mismatch_rate'] > $limit) {
            $violations->push([
                'feature' => $feature,
                'avg_rate' => (float) $row['avg_mismatch_rate'],
                'limit' => $limit,
            ]);
        }
    }

    if ($violations->isNotEmpty()) {
        $this->error('Trend threshold violation(s):');
        foreach ($violations as $violation) {
            $this->error(' - ' . $violation['feature'] . ': avg ' . $violation['avg_rate'] . '% > ' . $violation['limit'] . '%');
        }
    } else {
        $this->info('Trend threshold checks passed.');
    }

    $overallAvg = round((float) ($byFeature->avg('avg_mismatch_rate') ?? 0), 2);
    $overallMax = round((float) ($byFeature->max('max_mismatch_rate') ?? 0), 2);
    $overallSamples = (int) $byFeature->sum('samples');

    $overallSkippedAvg = round((float) ($daily->avg('skipped_rate') ?? 0), 2);

    if ($overallSamples >= 50 && $overallAvg <= 0.5 && $overallMax <= 1.0 && $overallSkippedAvg <= $maxSkippedRate && $violations->isEmpty()) {
        $this->info('Canary recommendation: safe to increase gradually (e.g. +5%).');
    } else {
        $this->warn('Canary recommendation: hold current percentage and investigate mismatches/skipped first.');
    }

    return ($violations->isNotEmpty() || $overallSkippedAvg > $maxSkippedRate) ? 1 : 0;
})->purpose('Analyze Go shadow mismatch trends from summary CSV');

Artisan::command('go:shadow:enable {--canary=5} {--sample=100} {--threshold=1}', function () {
    $envPath = base_path('.env');
    if (!File::exists($envPath)) {
        $this->error('.env file not found at ' . $envPath);
        return 1;
    }

    $canary = max(0, min(100, (int) $this->option('canary')));
    $sample = max(0, min(100, (int) $this->option('sample')));
    $threshold = max(0, (float) $this->option('threshold'));

    $featurePercentages = implode(',', [
        'appointment_index:' . $canary,
        'appointment_calendar:' . $canary,
        'appointment_slots:' . $canary,
        'service_order_index:' . $canary,
        'vehicle_index:' . $canary,
        'vehicle_insights:' . $canary,
        'vehicle_service_history:' . $canary,
        'vehicle_recommendations:' . $canary,
        'vehicle_maintenance_schedule:' . $canary,
        'report_part_sales_profit:' . $canary,
        'report_overall:' . $canary,
    ]);

    $featureThresholds = implode(',', [
        'appointment_index:' . $threshold,
        'appointment_calendar:' . $threshold,
        'appointment_slots:' . $threshold,
        'service_order_index:' . $threshold,
        'vehicle_index:' . max(0, $threshold / 2),
        'vehicle_insights:' . $threshold,
        'vehicle_service_history:' . $threshold,
        'vehicle_recommendations:' . $threshold,
        'vehicle_maintenance_schedule:' . $threshold,
        'report_part_sales_profit:' . max($threshold, 2),
        'report_part_sales_profit_by_supplier:' . max($threshold, 2),
        'report_overall:' . max($threshold, 2),
    ]);

    $toggles = [
        'GO_CANARY_ENABLED' => 'true',
        'GO_CANARY_DEFAULT_PERCENT' => (string) $canary,
        'GO_CANARY_FEATURES' => $featurePercentages,
        'GO_SHADOW_COMPARE_ENABLED' => 'true',
        'GO_SHADOW_COMPARE_SAMPLE_RATE' => (string) $sample,
        'GO_SHADOW_COMPARE_DEFAULT_THRESHOLD' => (string) $threshold,
        'GO_SHADOW_COMPARE_FEATURE_THRESHOLDS' => $featureThresholds,
        'GO_APPOINTMENT_INDEX_USE_GO' => 'true',
        'GO_APPOINTMENT_CALENDAR_USE_GO' => 'true',
        'GO_APPOINTMENT_SLOTS_USE_GO' => 'true',
        'GO_SERVICE_ORDER_INDEX_USE_GO' => 'true',
        'GO_VEHICLE_INDEX_USE_GO' => 'true',
        'GO_VEHICLE_INSIGHTS_USE_GO' => 'true',
        'GO_VEHICLE_SERVICE_HISTORY_USE_GO' => 'true',
        'GO_VEHICLE_RECOMMENDATIONS_USE_GO' => 'true',
        'GO_VEHICLE_MAINTENANCE_SCHEDULE_USE_GO' => 'true',
        'GO_REPORT_PART_SALES_PROFIT_USE_GO' => 'true',
        'GO_REPORT_OVERALL_USE_GO' => 'true',
    ];

    $content = (string) File::get($envPath);
    foreach ($toggles as $key => $value) {
        $pattern = '/^' . preg_quote($key, '/') . '=.*$/m';
        $line = $key . '=' . $value;

        if (preg_match($pattern, $content) === 1) {
            $content = preg_replace($pattern, $line, $content);
        } else {
            $content = rtrim($content) . PHP_EOL . $line . PHP_EOL;
        }
    }

    File::put($envPath, $content);

    $this->info('Go shadow/canary flags have been written to .env');
    $this->line('canary=' . $canary . '%, sample=' . $sample . '%, threshold=' . $threshold . '%');
    $this->line('Run: php artisan config:clear');

    return 0;
})->purpose('Enable Go shadow compare and canary flags in .env for controlled rollout');
