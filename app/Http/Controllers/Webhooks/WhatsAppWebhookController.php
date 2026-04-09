<?php

namespace App\Http\Controllers\Webhooks;

use App\Events\WhatsAppWebhookReceived;
use App\Http\Controllers\Controller;
use App\Models\WhatsAppWebhookEvent;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Str;

class WhatsAppWebhookController extends Controller
{
    public function __invoke(Request $request): JsonResponse
    {
        if ((bool) config('whatsapp.go_backend.use_webhook', false)) {
            $proxied = $this->proxyToGo($request);
            if ($proxied !== null) {
                return $proxied;
            }
        }

        return $this->processLocally($request);
    }

    private function processLocally(Request $request): JsonResponse
    {
        $rawBody = $request->getContent();
        $signature = (string) $request->header('X-Hub-Signature-256', '');
        $signatureValid = $this->isValidSignature($rawBody, $signature);

        $webhookEvent = WhatsAppWebhookEvent::create([
            'event' => (string) $request->input('event', 'unknown'),
            'device_id' => $request->input('device_id'),
            'signature_valid' => $signatureValid,
            'headers' => $request->headers->all(),
            'payload' => $request->all(),
            'received_at' => now(),
        ]);

        event(new WhatsAppWebhookReceived($webhookEvent));

        if (config('whatsapp.webhook.verify_signature', true) && !$signatureValid) {
            return response()->json([
                'message' => 'Invalid webhook signature.',
            ], 401);
        }

        return response()->json([
            'status' => 'ok',
        ]);
    }

    private function proxyToGo(Request $request): ?JsonResponse
    {
        $baseUrl = rtrim((string) config('whatsapp.go_backend.base_url', 'http://127.0.0.1:8081'), '/');
        $timeout = (int) config('whatsapp.go_backend.timeout_seconds', 5);
        $requestId = (string) ($request->header('X-Request-Id') ?: Str::uuid());

        try {
            $response = Http::timeout($timeout)
                ->acceptJson()
                ->withHeaders([
                    'X-Request-Id' => $requestId,
                    'X-Hub-Signature-256' => (string) $request->header('X-Hub-Signature-256', ''),
                    'Content-Type' => 'application/json',
                ])
                ->withBody($request->getContent(), 'application/json')
                ->post($baseUrl . '/api/v1/webhooks/whatsapp');

            $json = $response->json();
            if (is_array($json)) {
                return response()->json($json, $response->status());
            }

            return response()->json([
                'message' => 'Bridge ke Go aktif, tetapi respons webhook tidak valid JSON object.',
            ], 502);
        } catch (\Throwable $e) {
            // Fallback ke local handler untuk menghindari kehilangan webhook saat Go tidak tersedia.
            return null;
        }
    }

    private function isValidSignature(string $rawBody, string $header): bool
    {
        if ($header === '' || !str_starts_with($header, 'sha256=')) {
            return false;
        }

        $secret = (string) config('whatsapp.webhook.secret', '');
        if ($secret === '') {
            return false;
        }

        $actual = substr($header, 7);
        $expected = hash_hmac('sha256', $rawBody, $secret);

        return hash_equals($expected, $actual);
    }
}
