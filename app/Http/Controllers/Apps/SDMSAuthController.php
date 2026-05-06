<?php

namespace App\Http\Controllers\Apps;

use App\Http\Controllers\Controller;
use App\Models\Supplier;
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
        $defaultName = env('SDMS_DEFAULT_SUPPLIER_NAME', 'MPM Surabaya');
        $default = Supplier::where('name', $defaultName)->first();
        $defaultId = $default ? $default->id : null;

        return Inertia::render('Dashboard/SDMSDelivery', [
            'sdms' => $sdms,
            'defaultSupplierId' => $defaultId,
            'defaultSupplierName' => $defaultName,
        ]);
    }

    public function spg(Request $request)
    {
        $sdms = session('sdms', null);

        return Inertia::render('Dashboard/SDMSSpg', [
            'sdms' => $sdms,
            'initialIdBilling' => $request->query('idbilling') ?? $request->query('idBilling') ?? null,
            'initialSupplierId' => $request->query('supplier_id') ?? $request->query('supplierId') ?? null,
        ]);
    }

    /**
     * Create a new Part (Sparepart) from SPG received item
     * POST /api/spg/sparepart
     */
    public function storeSparepartFromSPG(Request $request)
    {
        $validated = $request->validate([
            'part_number' => 'required|string|unique:parts,part_number',
            'name' => 'required|string',
            'supplier_id' => 'nullable|exists:suppliers,id',
            'buy_price' => 'nullable|integer|min:0',
            'sell_price' => 'nullable|integer|min:0',
            'part_category_id' => 'nullable|exists:part_categories,id',
            'unit_measure' => 'nullable|string',
        ]);

        try {
            $part = \App\Models\Part::create([
                'part_number' => $validated['part_number'],
                'name' => $validated['name'],
                'supplier_id' => $validated['supplier_id'] ?? null,
                'buy_price' => $validated['buy_price'] ?? 0,
                'sell_price' => $validated['sell_price'] ?? 0,
                'part_category_id' => $validated['part_category_id'] ?? null,
                'unit_measure' => $validated['unit_measure'] ?? 'PCS',
                'stock' => 0,
                'minimal_stock' => 0,
                'status' => 'active',
            ]);

            return response()->json([
                'success' => true,
                'message' => 'Sparepart berhasil ditambahkan',
                'part' => $part,
            ], 201);
        } catch (\Exception $e) {
            \Log::error('Error creating sparepart:', ['error' => $e->getMessage()]);
            return response()->json([
                'success' => false,
                'message' => 'Gagal menambah sparepart: ' . $e->getMessage(),
            ], 422);
        }
    }

    /**
     * Create a PartPurchase from SPG received items
     * POST /api/spg/part-purchase
     */
    public function storePartPurchaseFromSPG(Request $request)
    {
        $validated = $request->validate([
            'supplier_id' => 'required|exists:suppliers,id',
            'items' => 'required|array|min:1',
            'items.*.part_id' => 'required|exists:parts,id',
            'items.*.quantity' => 'required|integer|min:1',
            'items.*.unit_price' => 'required|integer|min:0',
            'notes' => 'nullable|string',
        ]);

        try {
            \Illuminate\Support\Facades\DB::beginTransaction();

            // Calculate total amount
            $totalAmount = 0;
            foreach ($validated['items'] as $item) {
                $totalAmount += $item['quantity'] * $item['unit_price'];
            }

            // Create purchase
            $purchase = \App\Models\PartPurchase::create([
                'supplier_id' => $validated['supplier_id'],
                'purchase_date' => now()->toDateString(),
                'status' => 'pending',
                'total_amount' => $totalAmount,
                'notes' => $validated['notes'] ?? 'From SPG Received Items',
            ]);

            // Create purchase details
            foreach ($validated['items'] as $item) {
                $subtotal = $item['quantity'] * $item['unit_price'];
                \App\Models\PartPurchaseDetail::create([
                    'part_purchase_id' => $purchase->id,
                    'part_id' => $item['part_id'],
                    'quantity' => $item['quantity'],
                    'unit_price' => $item['unit_price'],
                    'subtotal' => $subtotal,
                    'final_amount' => $subtotal,
                    'discount_type' => 'none',
                    'discount_value' => 0,
                    'discount_amount' => 0,
                    'margin_type' => 'percent',
                    'margin_value' => 0,
                ]);
            }

            // Calculate totals
            $purchase->recalculateTotals()->save();

            \Illuminate\Support\Facades\DB::commit();

            return response()->json([
                'success' => true,
                'message' => 'Purchase Order berhasil dibuat',
                'purchase' => $purchase->load(['supplier', 'details.part']),
                'purchase_number' => $purchase->purchase_number,
            ], 201);
        } catch (\Exception $e) {
            \Illuminate\Support\Facades\DB::rollBack();
            \Log::error('Error creating purchase from SPG:', ['error' => $e->getMessage()]);
            return response()->json([
                'success' => false,
                'message' => 'Gagal membuat purchase order: ' . $e->getMessage(),
            ], 422);
        }
    }
}
