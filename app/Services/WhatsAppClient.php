<?php

namespace App\Services;

use Illuminate\Http\Client\RequestException;
use Illuminate\Support\Facades\Http;

class WhatsAppClient
{
    /**
     * @return array{message_id: ?string, message: ?string, raw: array}
     */
    public function sendText(string $phone, string $message, ?string $replyMessageId = null): array
    {
        $payload = [
            'phone' => $this->normalizePhone($phone),
            'message' => $message,
        ];

        if ($replyMessageId) {
            $payload['reply_message_id'] = $replyMessageId;
        }

        $response = $this->request()
            ->post('/send/message', $payload)
            ->throw();

        $json = $response->json();

        if (!is_array($json) || ($json['code'] ?? null) !== 'SUCCESS') {
            throw new RequestException($response);
        }

        $results = is_array($json['results'] ?? null) ? $json['results'] : [];

        return [
            'message_id' => $results['message_id'] ?? null,
            'message' => $json['message'] ?? null,
            'raw' => $json,
        ];
    }

    private function request()
    {
        $baseUrl = (string) config('whatsapp.api.base_url');
        $timeout = (int) config('whatsapp.api.timeout_seconds', 15);
        $retryTimes = (int) config('whatsapp.api.retry_times', 2);
        $retrySleep = (int) config('whatsapp.api.retry_sleep_ms', 250);
        $username = config('whatsapp.api.username');
        $password = config('whatsapp.api.password');
        $deviceId = config('whatsapp.api.device_id');

        $request = Http::acceptJson()
            ->contentType('application/json')
            ->baseUrl(rtrim($baseUrl, '/'))
            ->timeout($timeout)
            ->retry($retryTimes, $retrySleep);

        if ($username && $password) {
            $request = $request->withBasicAuth((string) $username, (string) $password);
        }

        if ($deviceId) {
            $request = $request->withHeaders([
                'X-Device-Id' => (string) $deviceId,
            ]);
        }

        return $request;
    }

    private function normalizePhone(string $phone): string
    {
        $phone = trim($phone);

        if (str_contains($phone, '@')) {
            return $phone;
        }

        $digits = preg_replace('/[^0-9]/', '', $phone) ?? '';

        if ($digits === '') {
            return $phone;
        }

        if (str_starts_with($digits, '0')) {
            $digits = '62' . substr($digits, 1);
        }

        if (!str_starts_with($digits, '62')) {
            $digits = '62' . ltrim($digits, '0');
        }

        return $digits . '@s.whatsapp.net';
    }
}
