<?php

namespace App\Http\Controllers\Apps;

use App\Http\Controllers\Controller;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;
use Symfony\Component\HttpFoundation\Response;

class WhatsAppGoController extends Controller
{
    public function __invoke(Request $request): Response|RedirectResponse
    {
        $targetUrl = trim((string) config('whatsapp.go_dashboard_url'));
        $username = trim((string) config('whatsapp.api.username', ''));
        $password = (string) config('whatsapp.api.password', '');

        if ($targetUrl === '') {
            throw ValidationException::withMessages([
                'whatsapp_go' => 'URL dashboard WhatsApp Go belum dikonfigurasi.',
            ]);
        }

        if (!str_starts_with($targetUrl, 'http://') && !str_starts_with($targetUrl, 'https://')) {
            throw ValidationException::withMessages([
                'whatsapp_go' => 'URL dashboard WhatsApp Go harus diawali http:// atau https://',
            ]);
        }

        if ($username !== '') {
            $targetUrl = $this->injectBasicAuth($targetUrl, $username, $password);
        }

        if (! $request->header('X-Inertia')) {
            return redirect()->away($targetUrl);
        }

        return Inertia::location($targetUrl);
    }

    private function injectBasicAuth(string $url, string $username, string $password): string
    {
        $parts = parse_url($url);
        if ($parts === false) {
            return $url;
        }

        if (!empty($parts['user'])) {
            return $url;
        }

        $scheme = $parts['scheme'] ?? 'http';
        $host = $parts['host'] ?? '';
        if ($host === '') {
            return $url;
        }

        $port = isset($parts['port']) ? ':' . $parts['port'] : '';
        $path = $parts['path'] ?? '';
        $query = isset($parts['query']) ? '?' . $parts['query'] : '';
        $fragment = isset($parts['fragment']) ? '#' . $parts['fragment'] : '';

        $auth = rawurlencode($username);
        if ($password !== '') {
            $auth .= ':' . rawurlencode($password);
        }

        return "{$scheme}://{$auth}@{$host}{$port}{$path}{$query}{$fragment}";
    }
}
