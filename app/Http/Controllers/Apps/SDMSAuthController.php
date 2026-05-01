<?php

namespace App\Http\Controllers\Apps;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Arr;
use Inertia\Inertia;

class SDMSAuthController extends Controller
{
    public function index()
    {
        $sdms = session('sdms', null);
        return Inertia::render('Dashboard/SDMSAuth', [
            'sdms' => $sdms,
        ]);
    }

    public function login(Request $request)
    {
        $data = $request->validate([
            'idInternal' => ['required', 'string'],
            'username' => ['required', 'string'],
            'password' => ['required', 'string'],
        ]);

        $target = config('services.sdms.base_url') ?? env('SDMS_API_BASE', 'https://sdmsdealer-h23.mpm-motor.com:22000');
        $url = rtrim($target, '/') . '/api/authenticate';

        try {
            $response = Http::withOptions(['verify' => false])->post($url, $data);
        } catch (\Exception $e) {
            return back()->withErrors(['global' => 'Request to SDMS API failed: ' . $e->getMessage()]);
        }

        if ($response->successful()) {
            $body = $response->json();

            // Try common locations for access token and id_token
            $candidates = [
                'access_token',
                'token',
                'id_token',
                'data.access_token',
                'data.token',
                'data.id_token',
                'result.access_token',
                'result.token',
                'result.id_token',
                'accessToken',
                'data.accessToken',
                'idToken',
                'data.idToken',
            ];

            $token = null;
            foreach ($candidates as $path) {
                $val = Arr::get($body, $path);
                if ($val) {
                    $token = $val;
                    break;
                }
            }

            // explicit id_token retrieval (common in OIDC responses)
            $idToken = Arr::get($body, 'id_token') ?? Arr::get($body, 'data.id_token') ?? Arr::get($body, 'result.id_token') ?? Arr::get($body, 'idToken') ?? Arr::get($body, 'data.idToken');

            $sdms = [
                'access_token' => $token,
                'id_token' => $idToken,
                'username' => $data['username'] ?? null,
                'idInternal' => $data['idInternal'] ?? null,
                'token_type' => Arr::get($body, 'token_type') ?? Arr::get($body, 'data.token_type'),
                'expires_in' => Arr::get($body, 'expires_in') ?? Arr::get($body, 'data.expires_in'),
                'raw' => $body,
            ];

            session(['sdms' => $sdms]);

            if ($token) {
                return redirect()->route('sdms.dashboard')->with('success', 'Token berhasil diterima');
            }

            // no token found but 2xx response — show raw response to help debugging
            $msg = is_array($body) ? json_encode($body) : (string) $body;
            return back()->withErrors(['global' => 'Autentikasi berhasil tetapi token tidak ditemukan pada respons: ' . $msg]);
        }

        // propagate validation/errors from upstream if present
        $json = $response->json();
        if (is_array($json) && isset($json['message'])) {
            return back()->withErrors(['global' => $json['message']]);
        }

        return back()->withErrors(['global' => 'Autentikasi gagal, periksa kredensial Anda']);
    }

    public function dashboard()
    {
        $sdms = session('sdms', null);
        return Inertia::render('Dashboard/SDMSDashboard', [
            'sdms' => $sdms,
        ]);
    }

    public function pkb()
    {
        $sdms = session('sdms', null);
        return Inertia::render('Dashboard/SDMSPkb', [
            'sdms' => $sdms,
        ]);
    }

    public function deliveryOrders()
    {
        $sdms = session('sdms', null);
        return Inertia::render('Dashboard/SDMSDelivery', [
            'sdms' => $sdms,
        ]);
    }

    public function spg(Request $request)
    {
        $sdms = session('sdms', null);

        return Inertia::render('Dashboard/SDMSSpg', [
            'sdms' => $sdms,
            'initialIdBilling' => $request->query('idbilling') ?? $request->query('idBilling') ?? null,
        ]);
    }
}
