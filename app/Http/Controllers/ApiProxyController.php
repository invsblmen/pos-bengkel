<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class ApiProxyController extends Controller
{
    /**
     * Proxy requests to external SDMS API.
     * Path is appended to the external base URL.
     * Example: POST /api/authenticate -> forwarded to {SDMS_API_BASE}/authenticate
     */
    public function proxy(Request $request, $path = '')
    {
        $targetBase = config('services.sdms.base_url') ?? env('SDMS_API_BASE', 'https://sdmsdealer-h23.mpm-motor.com:22000');
        $targetUrl = rtrim($targetBase, '/') . '/' . ltrim($path, '/');

        // Forward safe headers and allow username/idInternal
        $forwardHeaders = [];
        $allowed = ['Authorization', 'Accept', 'Accept-Language', 'Content-Type', 'User-Agent', 'username', 'idInternal'];
        foreach ($allowed as $h) {
            $val = $request->header($h);
            if (!is_null($val) && $val !== '') {
                $forwardHeaders[$h] = $val;
            }
        }

        // If Authorization not provided by client, try session-stored token (access_token then id_token)
        if (!isset($forwardHeaders['Authorization'])) {
            $sdms = session('sdms', null);
            $sessionToken = null;
            if (is_array($sdms)) {
                $sessionToken = $sdms['access_token'] ?? $sdms['id_token'] ?? null;
            }
            if ($sessionToken) {
                $forwardHeaders['Authorization'] = 'Bearer ' . $sessionToken;
            }
        }

        // If username/idInternal not present, prefer values derived from token claims,
        // falling back to session values when token doesn't contain them.
        $sdms = $sdms ?? session('sdms', null);

        // ensure we have a session token value to inspect
        $sessionToken = $sessionToken ?? (is_array($sdms) ? ($sdms['access_token'] ?? $sdms['id_token'] ?? null) : null);

        // If we have a JWT-like token, try to extract common claim names for idInternal/username
        if (!isset($forwardHeaders['idInternal']) && is_string($sessionToken) && substr_count($sessionToken, '.') >= 2) {
            try {
                $parts = explode('.', $sessionToken);
                $payload = $parts[1] ?? '';
                $payload .= str_repeat('=', (4 - strlen($payload) % 4) % 4);
                $decoded = base64_decode(strtr($payload, '-_', '+/'));
                $claims = json_decode($decoded, true) ?: [];

                $claimKeys = ['idInternal','id_internal','internalId','internal_id','idinternal','id','sub','user_id','uid'];
                foreach ($claimKeys as $ck) {
                    if (isset($claims[$ck]) && $claims[$ck] !== '') {
                        $forwardHeaders['idInternal'] = (string) $claims[$ck];
                        break;
                    }
                }

                $userKeys = ['username','preferred_username','upn','email','name','sub'];
                if (!isset($forwardHeaders['username'])) {
                    foreach ($userKeys as $uk) {
                        if (isset($claims[$uk]) && $claims[$uk] !== '') {
                            $forwardHeaders['username'] = (string) $claims[$uk];
                            break;
                        }
                    }
                }

                if (app()->environment('local') || config('app.debug')) {
                    Log::debug('ApiProxy - token claims extracted', ['idInternal_from_token' => $forwardHeaders['idInternal'] ?? null, 'claims' => $claims]);
                }
            } catch (\Throwable $e) {
                Log::debug('ApiProxy - token parse failed', ['error' => $e->getMessage()]);
            }
        }

        // fallback to session values if still not set
        if (!isset($forwardHeaders['username']) && is_array($sdms) && isset($sdms['username'])) {
            $forwardHeaders['username'] = $sdms['username'];
        }
        if (!isset($forwardHeaders['idInternal']) && is_array($sdms) && isset($sdms['idInternal'])) {
            $forwardHeaders['idInternal'] = $sdms['idInternal'];
        }

        $options = [];
        if ($request->query()) {
            $options['query'] = $request->query();
        }

        // Log proxied request info (local/debug only)
        if (app()->environment('local') || config('app.debug')) {
            Log::debug('ApiProxy - forwarding request', [
                'method' => $request->method(),
                'targetUrl' => $targetUrl,
                'forwardHeaders' => $forwardHeaders,
                'query' => $options['query'] ?? null,
            ]);
        }

        $contentType = $request->header('Content-Type', '');
        if (function_exists('str_contains') && str_contains($contentType, 'application/json')) {
            $options['json'] = $request->json()->all() ?: $request->all();
        } else {
            if ($request->isMethod('post') && $request->all()) {
                $options['form_params'] = $request->all();
            } else {
                $options['body'] = $request->getContent();
            }
        }

        try {
            $response = Http::withHeaders($forwardHeaders)
                ->withOptions(['verify' => false])
                ->send($request->method(), $targetUrl, $options);
        } catch (\Exception $e) {
            Log::error('ApiProxy - request exception', ['error' => $e->getMessage(), 'target' => $targetUrl]);
            return response()->json(['message' => 'Proxy request failed', 'error' => $e->getMessage()], 502);
        }

        $body = $response->body();
        $status = $response->status();
        $contentTypeResp = $response->header('Content-Type');

        if (app()->environment('local') || config('app.debug')) {
            Log::debug('ApiProxy - upstream response', [
                'status' => $status,
                'headers' => $response->headers(),
                'body' => $body,
            ]);
        }

        // If caller requested debug info, return structured debug JSON (local only)
        if ((app()->environment('local') || config('app.debug')) && $request->query('_proxy_debug')) {
            $decoded = json_decode($body, true);
            return response()->json([
                'target' => $targetUrl,
                'status' => $status,
                'headers' => $response->headers(),
                'body' => $decoded ?? $body,
            ], 200);
        }

        return response($body, $status)
            ->header('Content-Type', $contentTypeResp ?: 'application/json');
    }
}
