<?php

namespace App\Services;

use Illuminate\Http\Client\RequestException;
use Illuminate\Support\Facades\Http;
use RuntimeException;

class WhatsAppClient
{
    /**
     * Get the active device ID from go-whatsapp
     */
    public function getActiveDeviceId(): string
    {
        $deviceId = config('whatsapp.api.device_id');

        // If explicitly configured, use that
        if ($deviceId) {
            return $deviceId;
        }

        // Otherwise, fetch from go-whatsapp devices list
        try {
            $response = $this->baseRequest()
                ->get('/devices')
                ->throw();

            $json = $response->json();
            $devices = $json['results'] ?? [];

            // Try to find first connected/logged_in device
            foreach ($devices as $device) {
                if (in_array($device['state'] ?? null, ['connected', 'logged_in'])) {
                    return $device['id'] ?? $device['jid'];
                }
            }

            // Fallback: use first device if any exists
            if (!empty($devices)) {
                return $devices[0]['id'] ?? $devices[0]['jid'];
            }

            throw new RuntimeException('No WhatsApp devices available. Please register a device in go-whatsapp.');
        } catch (\Exception $e) {
            throw new RuntimeException('Failed to fetch device ID from go-whatsapp: ' . $e->getMessage());
        }
    }

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

    /**
     * @return array{is_on_whatsapp: bool, phone: string, normalized_phone: string, raw: array}
     */
    public function checkNumber(string $phone): array
    {
        $normalizedPhone = $this->normalizePhone($phone);
        $deviceId = $this->getActiveDeviceId();

        $response = $this->request()
            ->get('/user/check', [
                'phone' => $normalizedPhone,
                'device_id' => $deviceId,
            ])
            ->throw();

        $json = $response->json();

        if (!is_array($json) || ($json['code'] ?? null) !== 'SUCCESS') {
            throw new RequestException($response);
        }

        $results = is_array($json['results'] ?? null) ? $json['results'] : [];

        return [
            'is_on_whatsapp' => (bool) ($results['is_on_whatsapp'] ?? false),
            'phone' => $phone,
            'normalized_phone' => $normalizedPhone,
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
        $deviceId = $this->getActiveDeviceId();

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

    /**
     * Base HTTP request without device ID (used to fetch device list)
     */
    private function baseRequest()
    {
        $baseUrl = (string) config('whatsapp.api.base_url');
        $timeout = (int) config('whatsapp.api.timeout_seconds', 15);
        $username = config('whatsapp.api.username');
        $password = config('whatsapp.api.password');

        $request = Http::acceptJson()
            ->contentType('application/json')
            ->baseUrl(rtrim($baseUrl, '/'))
            ->timeout($timeout);

        if ($username && $password) {
            $request = $request->withBasicAuth((string) $username, (string) $password);
        }

        return $request;
    }

    public function normalizePhone(string $phone): string
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
