<?php

namespace App\Http\Controllers\Apps;

use App\Http\Controllers\Controller;
use App\Models\Part;
use App\Models\Supplier;
use App\Events\PartCreated;
use App\Events\PartUpdated;
use App\Events\PartDeleted;
use App\Support\DispatchesBroadcastSafely;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;
use App\Http\Controllers\Concerns\RespondsWithJsonOrRedirect;

class PartController extends Controller
{
    use DispatchesBroadcastSafely;
    use RespondsWithJsonOrRedirect;

    public function index(Request $request)
    {
        $q = $request->query('q', '');
        $categoryId = $request->query('category_id', '');
        $supplierId = $request->query('supplier_id', '');
        $stockStatus = $request->query('stock_status', '');
        $sortBy = $request->query('sort_by', 'name');
        $sortDirection = $request->query('sort_direction', 'asc');
        $perPage = $request->query('per_page', 10);

        $query = Part::with(['supplier', 'category', 'categories.parent']);

        // Search
        if ($q) {
            $query->where(function ($sub) use ($q) {
                $sub->where('name', 'like', "%{$q}%")
                    ->orWhere('part_number', 'like', "%{$q}%")
                    ->orWhere('barcode', 'like', "%{$q}%")
                    ->orWhere('rack_location', 'like', "%{$q}%")
                    ->orWhere('description', 'like', "%{$q}%");
            });
        }

        // Category filter (via many-to-many relationship)
        if ($categoryId) {
            $query->whereHas('categories', function ($q) use ($categoryId) {
                $q->where('part_category_id', $categoryId);
            });
        }

        // Supplier filter
        if ($supplierId) {
            $query->where('supplier_id', $supplierId);
        }

        // Stock status filter
        if ($stockStatus === 'low') {
            $query->whereColumn('stock', '<=', 'minimal_stock')
                  ->where('minimal_stock', '>', 0);
        } elseif ($stockStatus === 'out') {
            $query->where('stock', 0);
        } elseif ($stockStatus === 'normal') {
            $query->where(function ($sub) {
                $sub->whereColumn('stock', '>', 'minimal_stock')
                    ->orWhere('minimal_stock', 0);
            })->where('stock', '>', 0);
        }

        // Sorting
        $allowedSorts = ['name', 'part_number', 'stock', 'buy_price', 'sell_price', 'rack_location'];
        if (in_array($sortBy, $allowedSorts)) {
            $query->orderBy($sortBy, $sortDirection);
        } else {
            $query->orderBy('name', 'asc');
        }

        $parts = $query->paginate((int)$perPage)->withQueryString();

        $stats = [
            'total'         => Part::count(),
            'normal'        => Part::where('stock', '>', 0)
                                ->where(function ($q) {
                                    $q->whereColumn('stock', '>', 'minimal_stock')
                                      ->orWhere('minimal_stock', 0);
                                })->count(),
            'low_stock'     => Part::whereColumn('stock', '<=', 'minimal_stock')
                                ->where('minimal_stock', '>', 0)->count(),
            'out_of_stock'  => Part::where('stock', 0)->count(),
        ];

        return Inertia::render('Dashboard/Parts/Index', [
            'parts' => $parts,
            'stats' => $stats,
            'filters' => [
                'q' => $q,
                'category_id' => $categoryId,
                'supplier_id' => $supplierId,
                'stock_status' => $stockStatus,
                'sort_by' => $sortBy,
                'sort_direction' => $sortDirection,
                'per_page' => (int)$perPage,
            ],
            'suppliers' => Supplier::orderBy('name')->get(),
            'categories' => \App\Models\PartCategory::orderBy('name')->get(),
        ]);
    }

    public function create()
    {
        return Inertia::render('Dashboard/Parts/Create', [
            'suppliers' => Supplier::orderBy('name')->get(),
            'categories' => \App\Models\PartCategory::orderBy('name')->get(),
        ]);
    }

    public function sdmsPriceCheck(Request $request)
    {
        $ids = collect($request->input('part_ids', []))
            ->map(fn ($id) => (int) $id)
            ->filter()
            ->unique()
            ->take(50)
            ->values();

        if ($ids->isEmpty()) {
            return response()->json([
                'message' => 'Tidak ada sparepart yang dipilih untuk dicek.',
                'items' => [],
                'summary' => $this->emptySdmsPriceSummary(),
            ]);
        }

        $headers = $this->sdmsForwardHeaders();
        if (empty($headers['Authorization'])) {
            return response()->json([
                'message' => 'Sesi SDMS belum aktif. Silakan login SDMS terlebih dahulu.',
                'login_url' => route('sdms.auth.index'),
            ], 401);
        }

        $parts = Part::query()
            ->whereIn('id', $ids)
            ->get(['id', 'name', 'part_number', 'sell_price']);

        $baseUrl = rtrim((string) (config('services.sdms.base_url') ?? env('SDMS_API_BASE', 'https://sdmsdealer-h23.mpm-motor.com:22000')), '/');
        $endpoint = $baseUrl . '/api/part/GoodPartDetail/cs';

        $items = $parts->map(function (Part $part) use ($endpoint, $headers) {
            $partNumber = trim((string) ($part->part_number ?? ''));
            $localPrice = (int) ($part->sell_price ?? 0);

            if ($partNumber === '') {
                return $this->formatSdmsPriceResult($part, null, 'missing_code', 'Kode part kosong.');
            }

            try {
                $response = Http::withHeaders($headers)
                    ->withOptions(['verify' => false])
                    ->timeout(12)
                    ->get($endpoint, [
                        'idPart' => $partNumber,
                        'idCustomer' => 'undefined',
                    ]);
            } catch (\Throwable $e) {
                Log::warning('SDMS part price check failed', [
                    'part_id' => $part->id,
                    'part_number' => $partNumber,
                    'error' => $e->getMessage(),
                ]);

                return $this->formatSdmsPriceResult($part, null, 'error', $e->getMessage());
            }

            if (!$response->successful()) {
                return $this->formatSdmsPriceResult(
                    $part,
                    null,
                    'error',
                    'SDMS mengembalikan status ' . $response->status()
                );
            }

            $body = $response->json();
            $result = collect($body['Result'] ?? $body['result'] ?? [])->first();

            if (!$result) {
                return $this->formatSdmsPriceResult($part, null, 'not_found', 'Part tidak ditemukan di SDMS.');
            }

            $sdmsPrice = (int) round((float) ($result['price'] ?? $result['retailPrice'] ?? 0));
            $status = 'match';
            $message = 'Harga sudah sesuai SDMS.';

            if ($sdmsPrice <= 0) {
                $status = 'not_found';
                $message = 'Harga SDMS tidak tersedia.';
            } elseif ($localPrice < $sdmsPrice) {
                $status = 'local_lower';
                $message = 'Harga lokal lebih rendah dari SDMS.';
            } elseif ($localPrice > $sdmsPrice) {
                $status = 'local_higher';
                $message = 'Harga lokal lebih tinggi dari SDMS.';
            }

            return $this->formatSdmsPriceResult($part, [
                'part_number' => $result['idproduct'] ?? $partNumber,
                'name' => $result['name'] ?? null,
                'price' => $sdmsPrice,
            ], $status, $message);
        })->values();

        $summary = $this->emptySdmsPriceSummary();
        foreach ($items as $item) {
            $key = $item['status'] ?? 'error';
            if (array_key_exists($key, $summary)) {
                $summary[$key]++;
            }
        }
        $summary['total'] = $items->count();

        return response()->json([
            'checked_at' => now()->toISOString(),
            'items' => $items,
            'summary' => $summary,
        ]);
    }

    public function edit($id)
    {
        $part = Part::with('categories')->findOrFail($id);
        return Inertia::render('Dashboard/Parts/Edit', [
            'part' => $part,
            'suppliers' => Supplier::orderBy('name')->get(),
            'categories' => \App\Models\PartCategory::orderBy('name')->get(),
        ]);
    }

    public function store(Request $request)
    {
        $data = $request->validate([
            'name' => 'required|string|max:255',
            'part_number' => 'nullable|string|max:100|unique:parts,part_number',
            'barcode' => 'nullable|string|max:150|unique:parts,barcode',
            'part_category_id' => 'nullable|exists:part_categories,id',
            'category_ids' => 'nullable|array',
            'category_ids.*' => 'exists:part_categories,id',
            'supplier_id' => 'nullable|exists:suppliers,id',
            'buy_price' => 'nullable|numeric|min:0',
            'sell_price' => 'nullable|numeric|min:0',
            'stock' => 'nullable|integer|min:0',
            'minimal_stock' => 'nullable|integer|min:0',
            'rack_location' => 'nullable|string|max:50',
            'description' => 'nullable|string',
            'has_warranty' => 'nullable|boolean',
            'warranty_duration_days' => 'nullable|integer|min:0',
            'warranty_terms' => 'nullable|string',
        ]);

        $categoryIds = $data['category_ids'] ?? [];
        unset($data['category_ids']);

        $data['has_warranty'] = (bool) ($data['has_warranty'] ?? false);
        $data['warranty_duration_days'] = isset($data['warranty_duration_days']) ? (int) $data['warranty_duration_days'] : null;

        if (!$data['has_warranty']) {
            $data['warranty_duration_days'] = null;
        }

        if ($data['has_warranty'] && (($data['warranty_duration_days'] ?? 0) <= 0)) {
            throw ValidationException::withMessages([
                'warranty_duration_days' => 'Durasi garansi wajib lebih dari 0 hari saat garansi aktif.',
            ]);
        }

        // Set default stock if not provided
        if (!isset($data['stock'])) {
            $data['stock'] = 0;
        }

        $part = Part::create($data);
        if (!empty($categoryIds)) {
            $part->categories()->sync($categoryIds);
        }
        $part->load('supplier', 'category', 'categories');

        $this->dispatchBroadcastSafely(
            fn () => event(new PartCreated([
                'id' => $part->id,
                'name' => $part->name,
                'part_number' => $part->part_number,
                'barcode' => $part->barcode,
                'part_category_id' => $part->part_category_id,
                'supplier_id' => $part->supplier_id,
                'buy_price' => $part->buy_price,
                'sell_price' => $part->sell_price,
                'stock' => $part->stock,
                'minimal_stock' => $part->minimal_stock,
                'rack_location' => $part->rack_location,
                'has_warranty' => $part->has_warranty,
                'warranty_duration_days' => $part->warranty_duration_days,
                'warranty_terms' => $part->warranty_terms,
            ])),
            'PartCreated'
        );

        return $this->jsonOrRedirect('parts.index', [], 'Part created successfully.', ['part' => $part], 201);
    }

    public function update(Request $request, $id)
    {
        $part = Part::findOrFail($id);

        $data = $request->validate([
            'name' => 'required|string|max:255',
            'part_number' => "nullable|string|max:100|unique:parts,part_number,{$id}",
            'barcode' => "nullable|string|max:150|unique:parts,barcode,{$id}",
            'minimal_stock' => 'nullable|integer|min:0',
            'rack_location' => 'nullable|string|max:50',
            'part_category_id' => 'nullable|exists:part_categories,id',
            'category_ids' => 'nullable|array',
            'category_ids.*' => 'exists:part_categories,id',
            'supplier_id' => 'nullable|exists:suppliers,id',
            'buy_price' => 'nullable|numeric|min:0',
            'sell_price' => 'nullable|numeric|min:0',
            'stock' => 'nullable|integer|min:0',
            'description' => 'nullable|string',
            'has_warranty' => 'nullable|boolean',
            'warranty_duration_days' => 'nullable|integer|min:0',
            'warranty_terms' => 'nullable|string',
        ]);

        $categoryIds = $data['category_ids'] ?? [];
        unset($data['category_ids']);

        $data['has_warranty'] = (bool) ($data['has_warranty'] ?? false);
        $data['warranty_duration_days'] = isset($data['warranty_duration_days']) ? (int) $data['warranty_duration_days'] : null;

        if (!$data['has_warranty']) {
            $data['warranty_duration_days'] = null;
        }

        if ($data['has_warranty'] && (($data['warranty_duration_days'] ?? 0) <= 0)) {
            throw ValidationException::withMessages([
                'warranty_duration_days' => 'Durasi garansi wajib lebih dari 0 hari saat garansi aktif.',
            ]);
        }

        $part->update($data);
        if (!empty($categoryIds)) {
            $part->categories()->sync($categoryIds);
        } else {
            $part->categories()->detach();
        }

        $this->dispatchBroadcastSafely(
            fn () => event(new PartUpdated([
                'id' => $part->id,
                'name' => $part->name,
                'part_number' => $part->part_number,
                'barcode' => $part->barcode,
                'part_category_id' => $part->part_category_id,
                'supplier_id' => $part->supplier_id,
                'buy_price' => $part->buy_price,
                'sell_price' => $part->sell_price,
                'stock' => $part->stock,
                'minimal_stock' => $part->minimal_stock,
                'rack_location' => $part->rack_location,
                'has_warranty' => $part->has_warranty,
                'warranty_duration_days' => $part->warranty_duration_days,
                'warranty_terms' => $part->warranty_terms,
            ])),
            'PartUpdated'
        );

        return $this->jsonOrRedirect('parts.index', [], 'Part updated successfully.', ['part' => $part]);
    }

    public function show($id)
    {
        $part = Part::with(['supplier', 'category', 'categories'])->findOrFail($id);

        // Get stock movements/history for this part
        $stockHistory = \App\Models\PartStockMovement::where('part_id', $id)
            ->with(['user'])
            ->orderBy('created_at', 'desc')
            ->paginate(20);

        return Inertia::render('Dashboard/Parts/Show', [
            'part' => $part,
            'stock_history' => $stockHistory,
        ]);
    }

    public function destroy(Request $request, $id)
    {
        $part = Part::findOrFail($id);
        $partId = $part->id;
        $part->delete();

        $this->dispatchBroadcastSafely(
            fn () => event(new PartDeleted($partId)),
            'PartDeleted'
        );

        return $this->jsonOrRedirect('parts.index', [], 'Part deleted successfully.');
    }

    private function emptySdmsPriceSummary(): array
    {
        return [
            'total' => 0,
            'match' => 0,
            'local_lower' => 0,
            'local_higher' => 0,
            'not_found' => 0,
            'missing_code' => 0,
            'error' => 0,
        ];
    }

    private function formatSdmsPriceResult(Part $part, ?array $sdms, string $status, string $message): array
    {
        $localPrice = (int) ($part->sell_price ?? 0);
        $sdmsPrice = (int) ($sdms['price'] ?? 0);

        return [
            'part_id' => $part->id,
            'part_number' => $part->part_number,
            'name' => $part->name,
            'local_price' => $localPrice,
            'sdms_part_number' => $sdms['part_number'] ?? null,
            'sdms_name' => $sdms['name'] ?? null,
            'sdms_price' => $sdmsPrice,
            'difference' => $sdmsPrice > 0 ? $localPrice - $sdmsPrice : null,
            'status' => $status,
            'message' => $message,
        ];
    }

    private function sdmsForwardHeaders(): array
    {
        $sdms = session('sdms', null);
        $headers = [
            'Accept' => 'application/json',
        ];

        $sessionToken = is_array($sdms) ? ($sdms['access_token'] ?? $sdms['id_token'] ?? null) : null;
        if ($sessionToken) {
            $headers['Authorization'] = 'Bearer ' . $sessionToken;
        }

        if (is_array($sdms) && !empty($sdms['username'])) {
            $headers['username'] = (string) $sdms['username'];
        }

        if (is_array($sdms) && !empty($sdms['idInternal'])) {
            $headers['idInternal'] = (string) $sdms['idInternal'];
        }

        if (!isset($headers['idInternal']) && is_string($sessionToken) && substr_count($sessionToken, '.') >= 2) {
            try {
                $parts = explode('.', $sessionToken);
                $payload = $parts[1] ?? '';
                $payload .= str_repeat('=', (4 - strlen($payload) % 4) % 4);
                $claims = json_decode(base64_decode(strtr($payload, '-_', '+/')), true) ?: [];

                foreach (['idInternal', 'id_internal', 'internalId', 'internal_id', 'idinternal', 'id', 'sub', 'user_id', 'uid'] as $key) {
                    if (!empty($claims[$key])) {
                        $headers['idInternal'] = (string) $claims[$key];
                        break;
                    }
                }

                if (!isset($headers['username'])) {
                    foreach (['username', 'preferred_username', 'upn', 'email', 'name', 'sub'] as $key) {
                        if (!empty($claims[$key])) {
                            $headers['username'] = (string) $claims[$key];
                            break;
                        }
                    }
                }
            } catch (\Throwable $e) {
                Log::debug('SDMS part price token parse failed', ['error' => $e->getMessage()]);
            }
        }

        return $headers;
    }
}
