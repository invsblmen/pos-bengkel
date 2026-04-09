<?php

namespace App\Http\Controllers\Apps;

use App\Http\Controllers\Controller;
use App\Events\WhatsAppOutboundUpdated;
use App\Jobs\SendWhatsAppMessageJob;
use App\Models\WhatsAppOutboundMessage;
use App\Models\WhatsAppWebhookEvent;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class WhatsAppLogController extends Controller
{
    public function index(Request $request)
    {
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
                'webhook_total' => WhatsAppWebhookEvent::count(),
                'webhook_invalid_signature' => WhatsAppWebhookEvent::where('signature_valid', false)->count(),
            ],
            'outboundStatuses' => $outboundStatuses,
            'webhookEvents' => $webhookEvents,
            'outboundLogs' => $outboundLogs,
            'webhookLogs' => $webhookLogs,
        ]);
    }

    public function retry(WhatsAppOutboundMessage $outbound): \Illuminate\Http\RedirectResponse
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

        return redirect()->back()->with('success', 'Pesan WhatsApp di-queue ulang untuk retry.');
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
}
