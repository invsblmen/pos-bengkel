<?php

namespace App\Http\Controllers\Webhooks;

use App\Http\Controllers\Controller;
use App\Models\WhatsAppWebhookEvent;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class WhatsAppWebhookController extends Controller
{
    public function __invoke(Request $request): JsonResponse
    {
        $rawBody = $request->getContent();
        $signature = (string) $request->header('X-Hub-Signature-256', '');
        $signatureValid = $this->isValidSignature($rawBody, $signature);

        WhatsAppWebhookEvent::create([
            'event' => (string) $request->input('event', 'unknown'),
            'device_id' => $request->input('device_id'),
            'signature_valid' => $signatureValid,
            'headers' => $request->headers->all(),
            'payload' => $request->all(),
            'received_at' => now(),
        ]);

        if (config('whatsapp.webhook.verify_signature', true) && !$signatureValid) {
            return response()->json([
                'message' => 'Invalid webhook signature.',
            ], 401);
        }

        return response()->json([
            'status' => 'ok',
        ]);
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
