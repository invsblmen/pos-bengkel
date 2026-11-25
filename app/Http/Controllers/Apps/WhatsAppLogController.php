<?php

namespace App\Http\Controllers\Apps;

use App\Http\Controllers\Controller;
use App\Events\WhatsAppOutboundUpdated;
use App\Jobs\SendWhatsAppMessageJob;
use App\Models\Appointment;
use App\Models\Customer;
use App\Models\WhatsAppOutboundMessage;
use App\Models\WhatsAppWebhookEvent;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;
use App\Http\Controllers\Concerns\RespondsWithJsonOrRedirect;
use Symfony\Component\Process\Process;

class WhatsAppLogController extends Controller
{
    use RespondsWithJsonOrRedirect;
    public function index(Request $request)
    {
        $monitoring = $this->buildMonitoringSnapshot();

        $outboundQueryText = trim((string) $request->get('outbound_q', ''));
        $outboundStatus = (string) $request->get('outbound_status', 'all');

        $webhookQueryText = trim((string) $request->get('webhook_q', ''));
        $webhookEvent = (string) $request->get('webhook_event', 'all');

        $dateFrom = (string) $request->get('date_from', '');
        $dateTo = (string) $request->get('date_to', '');

        $outboundQuery = WhatsAppOutboundMessage::query()->latest();
        if ($outboundQueryText !== '') {
            $outboundQuery->where(function ($query) use ($outboundQueryText) {
                $query->where('phone', 'like', "%{$outboundQueryText}%")
                    ->orWhere('message', 'like', "%{$outboundQueryText}%")
                    ->orWhere('event_type', 'like', "%{$outboundQueryText}%");
            });
        }

        if ($outboundStatus !== 'all') {
            $outboundQuery->where('status', $outboundStatus);
        }

        if ($dateFrom !== '') {
            $outboundQuery->whereDate('created_at', '>=', $dateFrom);
        }

        if ($dateTo !== '') {
            $outboundQuery->whereDate('created_at', '<=', $dateTo);
        }

        $webhookQuery = WhatsAppWebhookEvent::query()->latest();
        if ($webhookQueryText !== '') {
            $webhookQuery->where(function ($query) use ($webhookQueryText) {
                $query->where('event', 'like', "%{$webhookQueryText}%")
                    ->orWhere('device_id', 'like', "%{$webhookQueryText}%");
            });
        }

        if ($webhookEvent !== 'all') {
            $webhookQuery->where('event', $webhookEvent);
        }

        if ($dateFrom !== '') {
            $webhookQuery->whereDate('created_at', '>=', $dateFrom);
        }

        if ($dateTo !== '') {
            $webhookQuery->whereDate('created_at', '<=', $dateTo);
        }

        $outboundLogs = $outboundQuery->paginate(15, ['*'], 'outbound_page')->withQueryString();
        $webhookLogs = $webhookQuery->paginate(15, ['*'], 'webhook_page')->withQueryString();

        $outboundStatuses = ['all', 'queued', 'sent', 'failed'];
        $webhookEvents = array_merge(
            ['all'],
            WhatsAppWebhookEvent::query()->select('event')->distinct()->orderBy('event')->pluck('event')->toArray()
        );

        return inertia('Dashboard/WhatsApp/Logs', [
            'filters' => [
                'outbound_q' => $outboundQueryText,
                'outbound_status' => $outboundStatus,
                'webhook_q' => $webhookQueryText,
                'webhook_event' => $webhookEvent,
                'date_from' => $dateFrom,
                'date_to' => $dateTo,
            ],
            'summary' => [
                'outbound_total' => WhatsAppOutboundMessage::count(),
                'outbound_queued' => WhatsAppOutboundMessage::where('status', 'queued')->count(),
                'outbound_sent' => WhatsAppOutboundMessage::where('status', 'sent')->count(),
                'outbound_failed' => WhatsAppOutboundMessage::where('status', 'failed')->count(),
                'queue_pending' => $monitoring['queue_pending'],
                'queue_failed' => $monitoring['queue_failed'],
                'queue_worker_active' => $monitoring['worker_active'],
                'queue_worker_last_heartbeat' => $monitoring['worker_last_heartbeat'],
                'queue_worker_age_seconds' => $monitoring['worker_age_seconds'],
                'webhook_total' => WhatsAppWebhookEvent::count(),
                'webhook_invalid_signature' => WhatsAppWebhookEvent::where('signature_valid', false)->count(),
            ],
            'monitoring' => $monitoring,
            'outboundStatuses' => $outboundStatuses,
            'webhookEvents' => $webhookEvents,
            'outboundLogs' => $outboundLogs,
            'webhookLogs' => $webhookLogs,
        ]);
    }

    public function overview()
    {
        $monitoring = $this->buildMonitoringSnapshot();

        $recentFailed = WhatsAppOutboundMessage::query()
            ->where('status', 'failed')
            ->latest()
            ->limit(8)
            ->get([
                'id',
                'event_type',
                'phone',
                'status',
                'error_message',
                'created_at',
                'failed_at',
            ]);

        return inertia('Dashboard/WhatsApp/Overview', [
            'summary' => [
                'outbound_total' => WhatsAppOutboundMessage::count(),
                'outbound_queued' => WhatsAppOutboundMessage::where('status', 'queued')->count(),
                'outbound_sent' => WhatsAppOutboundMessage::where('status', 'sent')->count(),
                'outbound_failed' => WhatsAppOutboundMessage::where('status', 'failed')->count(),
                'queue_pending' => $monitoring['queue_pending'],
                'queue_failed' => $monitoring['queue_failed'],
                'customers' => Customer::query()->where('phone', '!=', '')->count(),
                'appointments' => Appointment::query()
                    ->whereIn('status', ['scheduled', 'confirmed'])
                    ->whereDate('scheduled_at', '>=', now()->toDateString())
                    ->whereDate('scheduled_at', '<=', now()->addDays(7)->toDateString())
                    ->count(),
            ],
            'monitoring' => $monitoring,
            'recentFailed' => $recentFailed,
        ]);
    }

    public function device()
    {
        return inertia('Dashboard/WhatsApp/Device');
    }

    public function queueMonitor()
    {
        $monitoring = $this->buildMonitoringSnapshot();

        $recentOutbound = WhatsAppOutboundMessage::query()
            ->latest()
            ->limit(10)
            ->get([
                'id',
                'event_type',
                'phone',
                'status',
                'error_message',
                'created_at',
                'sent_at',
                'failed_at',
            ]);

        return inertia('Dashboard/WhatsApp/QueueMonitor', [
            'summary' => [
                'outbound_total' => WhatsAppOutboundMessage::count(),
                'outbound_queued' => WhatsAppOutboundMessage::where('status', 'queued')->count(),
                'outbound_sent' => WhatsAppOutboundMessage::where('status', 'sent')->count(),
                'outbound_failed' => WhatsAppOutboundMessage::where('status', 'failed')->count(),
                'queue_pending' => $monitoring['queue_pending'],
                'queue_failed' => $monitoring['queue_failed'],
                'queue_worker_active' => $monitoring['worker_active'],
                'queue_worker_last_heartbeat' => $monitoring['worker_last_heartbeat'],
                'queue_worker_age_seconds' => $monitoring['worker_age_seconds'],
            ],
            'monitoring' => $monitoring,
            'recentOutbound' => $recentOutbound,
            'refreshIntervalSeconds' => (int) config('whatsapp.monitoring.refresh_interval_seconds', 15),
        ]);
    }

    public function retry(WhatsAppOutboundMessage $outbound): \Illuminate\Http\RedirectResponse|\Illuminate\Http\JsonResponse
    {
        if ($outbound->status === 'sent') {
            throw ValidationException::withMessages([
                'retry' => 'Pesan yang sudah sent tidak bisa di-retry.',
            ]);
        }

        $outbound->update([
            'status' => 'queued',
            'error_message' => null,
            'failed_at' => null,
        ]);

        event(new WhatsAppOutboundUpdated($outbound->fresh()));

        SendWhatsAppMessageJob::dispatch($outbound->id)
            ->onQueue((string) config('whatsapp.notifications.queue', 'default'));

        return $this->jsonOrRedirect(null, [], 'Pesan WhatsApp di-queue ulang untuk retry.');
    }

    public function healthCheck(): JsonResponse
    {
        if ((bool) config('whatsapp.go_backend.use_health_check', false)) {
            return $this->healthCheckViaGo(request());
        }

        $targetUrl = trim((string) config('whatsapp.go_dashboard_url', ''));
        $username = config('whatsapp.api.username');
        $password = config('whatsapp.api.password');

        if ($targetUrl === '') {
            return response()->json([
                'ok' => false,
                'status' => 'down',
                'message' => 'WHATSAPP_GO_DASHBOARD_URL belum dikonfigurasi.',
                'http_status' => null,
                'latency_ms' => null,
                'target_url' => null,
            ], 200);
        }

        $startedAt = microtime(true);

        try {
            $request = Http::timeout(5)->withoutRedirecting();

            if (!empty($username) && !empty($password)) {
                $request = $request->withBasicAuth((string) $username, (string) $password);
            }

            $response = $request->get($targetUrl);
            $latencyMs = (int) round((microtime(true) - $startedAt) * 1000);
            $httpStatus = $response->status();

            if ($httpStatus === 401 && (empty($username) || empty($password))) {
                return response()->json([
                    'ok' => false,
                    'status' => 'auth_required',
                    'message' => 'Service WhatsApp Go aktif, tetapi butuh Basic Auth. Isi WHATSAPP_API_USERNAME dan WHATSAPP_API_PASSWORD agar akses dashboard tidak 401.',
                    'http_status' => $httpStatus,
                    'latency_ms' => $latencyMs,
                    'target_url' => $targetUrl,
                ], 200);
            }

            $isUp = $httpStatus >= 200 && $httpStatus < 500;

            return response()->json([
                'ok' => $isUp,
                'status' => $isUp ? 'up' : 'down',
                'message' => $isUp
                    ? "Service WhatsApp Go reachable (HTTP {$httpStatus})."
                    : "Service WhatsApp Go merespons HTTP {$httpStatus}.",
                'http_status' => $httpStatus,
                'latency_ms' => $latencyMs,
                'target_url' => $targetUrl,
            ], 200);
        } catch (\Throwable $e) {
            $latencyMs = (int) round((microtime(true) - $startedAt) * 1000);

            return response()->json([
                'ok' => false,
                'status' => 'down',
                'message' => 'Service WhatsApp Go tidak bisa diakses: ' . $e->getMessage(),
                'http_status' => null,
                'latency_ms' => $latencyMs,
                'target_url' => $targetUrl,
            ], 200);
        }
    }

    public function runWorkerOnce(Request $request)
    {
        // Start a persistent worker in the background (non-blocking).
        // This keeps consuming queued jobs after the HTTP request finishes.
        try {
            $queue = (string) config('whatsapp.notifications.queue', 'default');
            $php = $this->resolvePhpCliExecutable();
            $artisan = base_path('artisan');

            $commandText = sprintf('"%s" "%s" queue:work --queue=%s --tries=3 --sleep=3', $php, $artisan, $queue);

            $process = Process::fromShellCommandline($commandText, base_path());
            $process->disableOutput();
            $process->setTimeout(null);
            $process->start();

            $pid = $process->getPid();

            $processRunning = $process->isRunning();

            // Verify the spawned process actually exists before recording heartbeat
            if ($this->isPidAlive($pid) || $processRunning) {
                $this->recordHeartbeat('run-worker', $pid);
            } else {
                Log::warning('Attempted to start queue worker but process not found', [
                    'pid' => $pid,
                    'command' => $commandText,
                    'running' => $processRunning,
                    'output' => $process->getOutput(),
                    'error' => $process->getErrorOutput(),
                ]);

                if (request()->expectsJson() || request()->ajax()) {
                    return response()->json([
                        'success' => false,
                        'message' => 'Gagal memulai worker background (process tidak muncul). Lihat log untuk detail.',
                        'data' => [
                            'process_pid' => $pid,
                            'command' => $commandText,
                        ],
                    ], 500);
                }

                return $this->jsonOrRedirect(null, [], 'Gagal memulai worker background (process tidak muncul).');
            }

            if (request()->expectsJson() || request()->ajax()) {
                return response()->json([
                    'success' => true,
                    'message' => 'Worker background dimulai dan akan terus memproses antrean.',
                    'data' => [
                        'process_pid' => $process->getPid(),
                        'command' => $commandText,
                    ],
                ], 200);
            }

            return $this->jsonOrRedirect(null, [], 'Worker background dimulai dan akan terus memproses antrean.');
        } catch (\Throwable $e) {
            if (request()->expectsJson() || request()->ajax()) {
                return response()->json([
                    'success' => false,
                    'message' => 'Gagal memulai worker background.',
                    'error' => $e->getMessage(),
                ], 500);
            }

            return $this->jsonOrRedirect(null, [], 'Gagal memulai worker background.', ['error' => $e->getMessage()]);
        }
    }

    private function isPidAlive(?int $pid): bool
    {
        if (empty($pid)) {
            return false;
        }

        try {
            if (PHP_OS_FAMILY === 'Windows') {
                $process = Process::fromShellCommandline(sprintf('powershell -NoProfile -Command "Get-CimInstance Win32_Process -Filter \"ProcessId=%d\" | Select-Object -ExpandProperty ProcessId"', $pid), base_path());
                $process->setTimeout(5);
                $process->run();
                return trim($process->getOutput()) !== '';
            }

            if (function_exists('posix_kill')) {
                return posix_kill($pid, 0);
            }

            $process = Process::fromShellCommandline(sprintf('ps -p %d -o pid=', $pid), base_path());
            $process->setTimeout(5);
            $process->run();
            return trim($process->getOutput()) !== '';
        } catch (\Throwable $e) {
            Log::debug('isPidAlive check failed', ['pid' => $pid, 'error' => $e->getMessage()]);
            return false;
        }
    }

    public function restartWorkers(Request $request)
    {
        try {
            $php = $this->resolvePhpCliExecutable();
            $commandText = sprintf('"%s" "%s" queue:restart', $php, base_path('artisan'));
            $process = Process::fromShellCommandline($commandText, base_path());
            $process->disableOutput();
            $process->setTimeout(null);
            $process->start(); // Start async, do NOT wait

            $this->recordHeartbeat('restart-signal', $process->getPid());

            if (request()->expectsJson() || request()->ajax()) {
                return response()->json([
                    'success' => true,
                    'message' => 'Perintah restart broadcast dikirim. Worker akan restart saat siap.',
                    'data' => [
                        'process_pid' => $process->getPid(),
                        'command' => $commandText,
                    ],
                ], 200);
            }

            return $this->jsonOrRedirect(null, [], 'Perintah restart broadcast dikirim. Worker akan restart saat siap.');
        } catch (\Throwable $e) {
            if (request()->expectsJson() || request()->ajax()) {
                return response()->json([
                    'success' => false,
                    'message' => 'Gagal mengirim perintah restart.',
                    'error' => $e->getMessage(),
                ], 500);
            }

            return $this->jsonOrRedirect(null, [], 'Gagal mengirim perintah restart.', ['error' => $e->getMessage()]);
        }
    }

    private function resolvePhpCliExecutable(): string
    {
        $phpBinary = PHP_BINARY;

        if (PHP_OS_FAMILY === 'Windows' && str_contains(strtolower($phpBinary), 'php-cgi')) {
            $phpFolder = dirname($phpBinary);
            $wrapper = dirname($phpFolder) . DIRECTORY_SEPARATOR . basename($phpFolder) . '.bat';

            if (is_file($wrapper)) {
                return $wrapper;
            }

            $genericWrapper = dirname($phpFolder) . DIRECTORY_SEPARATOR . 'php.bat';

            if (is_file($genericWrapper)) {
                return $genericWrapper;
            }
        }

        return $phpBinary;
    }

    private function healthCheckViaGo(Request $request): JsonResponse
    {
        $baseUrl = rtrim((string) config('whatsapp.go_backend.base_url', 'http://127.0.0.1:8081'), '/');
        $timeout = (int) config('whatsapp.go_backend.timeout_seconds', 5);
        $requestId = (string) ($request->header('X-Request-Id') ?: Str::uuid());

        try {
            $response = Http::timeout($timeout)
                ->acceptJson()
                ->withHeaders([
                    'X-Request-Id' => $requestId,
                ])
                ->get($baseUrl . '/api/v1/whatsapp/health/check');
            $json = $response->json();

            if (is_array($json)) {
                return response()->json($json, 200);
            }

            return response()->json([
                'ok' => false,
                'status' => 'down',
                'message' => 'Bridge ke Go aktif, tetapi respons health check tidak valid JSON object.',
                'http_status' => null,
                'latency_ms' => null,
                'target_url' => $baseUrl,
            ], 200);
        } catch (\Throwable $e) {
            return response()->json([
                'ok' => false,
                'status' => 'down',
                'message' => 'Bridge ke Go gagal: ' . $e->getMessage(),
                'http_status' => null,
                'latency_ms' => null,
                'target_url' => $baseUrl,
            ], 200);
        }
    }

    private function recordHeartbeat(string $source, ?int $pid = null): void
    {
        $heartbeatKey = (string) config('whatsapp.monitoring.heartbeat_key', 'whatsapp:queue:heartbeat');
        $heartbeatTtl = max(30, (int) config('whatsapp.monitoring.heartbeat_ttl_seconds', 90));

        Cache::put($heartbeatKey, [
            'checked_at' => now()->toIso8601String(),
            'timestamp' => now()->timestamp,
            'pid' => $pid ?? (function_exists('getmypid') ? getmypid() : null),
            'host' => gethostname() ?: php_uname('n'),
            'queue_connection' => (string) config('queue.default', 'database'),
            'queue_name' => (string) config('whatsapp.notifications.queue', 'default'),
            'source' => $source,
        ], now()->addSeconds($heartbeatTtl));
    }

    private function buildMonitoringSnapshot(): array
    {
        $heartbeatKey = (string) config('whatsapp.monitoring.heartbeat_key', 'whatsapp:queue:heartbeat');
        $heartbeatTtl = max(30, (int) config('whatsapp.monitoring.heartbeat_ttl_seconds', 90));
        $heartbeat = Cache::get($heartbeatKey);
        $queuePending = DB::table('jobs')->count();
        $queueFailed = DB::table('failed_jobs')->count();

        $heartbeatTimestamp = is_array($heartbeat) ? (int) ($heartbeat['timestamp'] ?? 0) : 0;
        $lastHeartbeatAt = $heartbeatTimestamp > 0 ? Carbon::createFromTimestamp($heartbeatTimestamp) : null;
        $workerAgeSeconds = $lastHeartbeatAt ? now()->diffInSeconds($lastHeartbeatAt) : null;
        $workerActive = $lastHeartbeatAt !== null && $workerAgeSeconds !== null && $workerAgeSeconds <= $heartbeatTtl;

        return [
            'heartbeat' => is_array($heartbeat) ? $heartbeat : null,
            'worker_active' => $workerActive,
            'worker_last_heartbeat' => $lastHeartbeatAt?->timezone(config('app.timezone'))->format('Y-m-d H:i:s'),
            'worker_age_seconds' => $workerAgeSeconds,
            'queue_pending' => $queuePending,
            'queue_failed' => $queueFailed,
            'heartbeat_ttl_seconds' => $heartbeatTtl,
        ];
    }
}
