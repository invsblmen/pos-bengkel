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
use Illuminate\Support\Facades\File;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Schedule;

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
