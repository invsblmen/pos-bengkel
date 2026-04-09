<?php

namespace App\Http\Controllers\Apps;

use App\Http\Controllers\Controller;
use App\Models\Supplier;
use App\Events\SupplierCreated;
use App\Events\SupplierUpdated;
use App\Events\SupplierDeleted;
use App\Support\DispatchesBroadcastSafely;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;

class SupplierController extends Controller
{
    use DispatchesBroadcastSafely;

    public function index(Request $request)
    {
        if ((bool) config('go_backend.features.supplier_index', false)) {
            $proxied = $this->supplierIndexViaGo($request);
            if ($proxied !== null) {
                return inertia('Dashboard/Suppliers/Index', $proxied);
            }
        }

        $q = $request->query('q', '');

        $query = Supplier::orderBy('name');
        if ($q) {
            $query->where(function ($sub) use ($q) {
                $sub->where('name', 'like', "%{$q}%")
                    ->orWhere('phone', 'like', "%{$q}%")
                    ->orWhere('email', 'like', "%{$q}%")
                    ->orWhere('contact_person', 'like', "%{$q}%");
            });
        }

        $suppliers = $query->paginate(15)->withQueryString();

        return inertia('Dashboard/Suppliers/Index', [
            'suppliers' => $suppliers,
            'filters' => ['q' => $q],
        ]);
    }

    private function supplierIndexViaGo(Request $request): ?array
    {
        $baseUrl = rtrim((string) config('go_backend.base_url', 'http://127.0.0.1:8081'), '/');
        $timeout = (int) config('go_backend.timeout_seconds', 5);
        $requestId = (string) ($request->header('X-Request-Id') ?: Str::uuid());

        try {
            $response = Http::timeout($timeout)
                ->acceptJson()
                ->withHeaders([
                    'X-Request-Id' => $requestId,
                ])
                ->get($baseUrl . '/api/v1/suppliers', $request->only(['q', 'page']));

            $json = $response->json();
            if (! $response->successful() || ! is_array($json)) {
                Log::warning('Supplier index Go bridge returned an invalid response', [
                    'status' => $response->status(),
                ]);

                return null;
            }

            if (! isset($json['suppliers'], $json['filters'])) {
                Log::warning('Supplier index Go bridge response is missing expected keys', [
                    'keys' => array_keys($json),
                ]);

                return null;
            }

            return $json;
        } catch (\Throwable $e) {
            Log::warning('Supplier index Go bridge failed and fallback will be used', [
                'message' => $e->getMessage(),
            ]);

            return null;
        }
    }

    public function create()
    {
        return inertia('Dashboard/Suppliers/Create');
    }

    public function store(Request $request)
    {
        if ((bool) config('go_backend.features.supplier_store', false)) {
            $proxied = $this->supplierStoreViaGo($request);
            if ($proxied !== null) {
                if ($proxied['status'] === 'validation_error') {
                    return back()->withInput()->withErrors($proxied['errors'] ?? ['name' => 'Data supplier tidak valid.']);
                }

                $supplierPayload = $proxied['supplier'] ?? [
                    'name' => $request->input('name'),
                    'phone' => $request->input('phone'),
                    'email' => $request->input('email'),
                    'address' => $request->input('address'),
                    'contact_person' => $request->input('contact_person'),
                ];

                $this->dispatchBroadcastSafely(
                    fn () => event(new SupplierCreated([
                        'id' => $supplierPayload['id'] ?? null,
                        'name' => $supplierPayload['name'] ?? null,
                        'phone' => $supplierPayload['phone'] ?? null,
                        'email' => $supplierPayload['email'] ?? null,
                        'address' => $supplierPayload['address'] ?? null,
                        'contact_person' => $supplierPayload['contact_person'] ?? null,
                    ])),
                    'SupplierCreated'
                );

                return redirect()->route('suppliers.index')->with([
                    'success' => $proxied['message'] ?? 'Supplier created successfully.',
                    'flash' => ['supplier' => $supplierPayload],
                ]);
            }
        }

        $data = $request->validate([
            'name' => 'required|string|max:255',
            'phone' => 'nullable|string|max:50',
            'email' => 'nullable|email|max:255',
            'address' => 'nullable|string',
            'contact_person' => 'nullable|string|max:255',
        ]);

        $supplier = Supplier::create($data);

        $this->dispatchBroadcastSafely(
            fn () => event(new SupplierCreated([
                'id' => $supplier->id,
                'name' => $supplier->name,
                'phone' => $supplier->phone,
                'email' => $supplier->email,
                'address' => $supplier->address,
                'contact_person' => $supplier->contact_person,
            ])),
            'SupplierCreated'
        );

        return redirect()->route('suppliers.index')->with([
            'success' => 'Supplier created successfully.',
            'flash' => ['supplier' => $supplier]
        ]);
    }

    private function supplierStoreViaGo(Request $request): ?array
    {
        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'phone' => 'nullable|string|max:50',
            'email' => 'nullable|email|max:255',
            'address' => 'nullable|string',
            'contact_person' => 'nullable|string|max:255',
        ]);

        $baseUrl = rtrim((string) config('go_backend.base_url', 'http://127.0.0.1:8081'), '/');
        $timeout = (int) config('go_backend.timeout_seconds', 5);
        $requestId = (string) ($request->header('X-Request-Id') ?: Str::uuid());

        try {
            $response = Http::timeout($timeout)
                ->acceptJson()
                ->withHeaders([
                    'X-Request-Id' => $requestId,
                ])
                ->post($baseUrl . '/api/v1/suppliers', $validated);

            $json = $response->json();
            if (! is_array($json)) {
                Log::warning('Supplier store Go bridge returned a non-array response', [
                    'status' => $response->status(),
                ]);

                return null;
            }

            if ($response->status() === 422) {
                return [
                    'status' => 'validation_error',
                    'message' => $json['message'] ?? 'Data supplier tidak valid.',
                    'errors' => $json['errors'] ?? [],
                ];
            }

            if (! $response->successful()) {
                Log::warning('Supplier store Go bridge returned an invalid response', [
                    'status' => $response->status(),
                    'keys' => array_keys($json),
                ]);

                return null;
            }

            return [
                'status' => 'ok',
                'message' => $json['message'] ?? 'Supplier created successfully.',
                'supplier' => $json['supplier'] ?? null,
            ];
        } catch (\Throwable $e) {
            Log::warning('Supplier store Go bridge failed and fallback will be used', [
                'message' => $e->getMessage(),
            ]);

            return null;
        }
    }

    public function edit($id)
    {
        $supplier = Supplier::findOrFail($id);

        return inertia('Dashboard/Suppliers/Edit', [
            'supplier' => $supplier,
        ]);
    }

    public function update(Request $request, $id)
    {
        if ((bool) config('go_backend.features.supplier_update', false)) {
            $proxied = $this->supplierUpdateViaGo($request, (string) $id);
            if ($proxied !== null) {
                if ($proxied['status'] === 'validation_error') {
                    return back()->withInput()->withErrors($proxied['errors'] ?? ['name' => 'Data supplier tidak valid.']);
                }

                if ($proxied['status'] === 'not_found') {
                    abort(404);
                }

                $supplierPayload = $proxied['supplier'] ?? [
                    'id' => (int) $id,
                    'name' => $request->input('name'),
                    'phone' => $request->input('phone'),
                    'email' => $request->input('email'),
                    'address' => $request->input('address'),
                    'contact_person' => $request->input('contact_person'),
                ];

                $this->dispatchBroadcastSafely(
                    fn () => event(new SupplierUpdated([
                        'id' => $supplierPayload['id'] ?? null,
                        'name' => $supplierPayload['name'] ?? null,
                        'phone' => $supplierPayload['phone'] ?? null,
                        'email' => $supplierPayload['email'] ?? null,
                        'address' => $supplierPayload['address'] ?? null,
                        'contact_person' => $supplierPayload['contact_person'] ?? null,
                    ])),
                    'SupplierUpdated'
                );

                return redirect()->route('suppliers.index')->with([
                    'success' => $proxied['message'] ?? 'Supplier updated successfully.',
                    'flash' => ['supplier' => $supplierPayload],
                ]);
            }
        }

        $supplier = Supplier::findOrFail($id);

        $data = $request->validate([
            'name' => 'required|string|max:255',
            'phone' => 'nullable|string|max:50',
            'email' => 'nullable|email|max:255',
            'address' => 'nullable|string',
            'contact_person' => 'nullable|string|max:255',
        ]);

        $supplier->update($data);

        $this->dispatchBroadcastSafely(
            fn () => event(new SupplierUpdated([
                'id' => $supplier->id,
                'name' => $supplier->name,
                'phone' => $supplier->phone,
                'email' => $supplier->email,
                'address' => $supplier->address,
                'contact_person' => $supplier->contact_person,
            ])),
            'SupplierUpdated'
        );

        return redirect()->route('suppliers.index')->with([
            'success' => 'Supplier updated successfully.',
            'flash' => ['supplier' => $supplier]
        ]);
    }

    private function supplierUpdateViaGo(Request $request, string $supplierId): ?array
    {
        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'phone' => 'nullable|string|max:50',
            'email' => 'nullable|email|max:255',
            'address' => 'nullable|string',
            'contact_person' => 'nullable|string|max:255',
        ]);

        $baseUrl = rtrim((string) config('go_backend.base_url', 'http://127.0.0.1:8081'), '/');
        $timeout = (int) config('go_backend.timeout_seconds', 5);
        $requestId = (string) ($request->header('X-Request-Id') ?: Str::uuid());

        try {
            $response = Http::timeout($timeout)
                ->acceptJson()
                ->withHeaders([
                    'X-Request-Id' => $requestId,
                ])
                ->put($baseUrl . '/api/v1/suppliers/' . urlencode($supplierId), $validated);

            $json = $response->json();
            if (! is_array($json)) {
                Log::warning('Supplier update Go bridge returned a non-array response', [
                    'status' => $response->status(),
                ]);

                return null;
            }

            if ($response->status() === 404) {
                return [
                    'status' => 'not_found',
                    'message' => $json['message'] ?? 'Supplier tidak ditemukan.',
                ];
            }

            if ($response->status() === 422) {
                return [
                    'status' => 'validation_error',
                    'message' => $json['message'] ?? 'Data supplier tidak valid.',
                    'errors' => $json['errors'] ?? [],
                ];
            }

            if (! $response->successful()) {
                Log::warning('Supplier update Go bridge returned an invalid response', [
                    'status' => $response->status(),
                    'keys' => array_keys($json),
                ]);

                return null;
            }

            return [
                'status' => 'ok',
                'message' => $json['message'] ?? 'Supplier updated successfully.',
                'supplier' => $json['supplier'] ?? null,
            ];
        } catch (\Throwable $e) {
            Log::warning('Supplier update Go bridge failed and fallback will be used', [
                'message' => $e->getMessage(),
            ]);

            return null;
        }
    }

    public function destroy($id)
    {
        if ((bool) config('go_backend.features.supplier_destroy', false)) {
            $proxied = $this->supplierDestroyViaGo((string) $id, request());
            if ($proxied !== null) {
                if ($proxied['status'] === 'not_found') {
                    abort(404);
                }

                $supplierId = (int) ($proxied['supplier_id'] ?? $id);
                if ($supplierId > 0) {
                    $this->dispatchBroadcastSafely(
                        fn () => event(new SupplierDeleted($supplierId)),
                        'SupplierDeleted'
                    );
                }

                return redirect()->back()->with('success', $proxied['message'] ?? 'Supplier deleted successfully.');
            }
        }

        $supplier = Supplier::findOrFail($id);
        $supplierId = $supplier->id;
        $supplier->delete();

        $this->dispatchBroadcastSafely(
            fn () => event(new SupplierDeleted($supplierId)),
            'SupplierDeleted'
        );

        return redirect()->back()->with('success', 'Supplier deleted successfully.');
    }

    private function supplierDestroyViaGo(string $supplierId, Request $request): ?array
    {
        $baseUrl = rtrim((string) config('go_backend.base_url', 'http://127.0.0.1:8081'), '/');
        $timeout = (int) config('go_backend.timeout_seconds', 5);
        $requestId = (string) ($request->header('X-Request-Id') ?: Str::uuid());

        try {
            $response = Http::timeout($timeout)
                ->acceptJson()
                ->withHeaders([
                    'X-Request-Id' => $requestId,
                ])
                ->delete($baseUrl . '/api/v1/suppliers/' . urlencode($supplierId));

            $json = $response->json();
            if (! is_array($json)) {
                Log::warning('Supplier destroy Go bridge returned a non-array response', [
                    'status' => $response->status(),
                ]);

                return null;
            }

            if ($response->status() === 404) {
                return [
                    'status' => 'not_found',
                    'message' => $json['message'] ?? 'Supplier tidak ditemukan.',
                ];
            }

            if (! $response->successful()) {
                Log::warning('Supplier destroy Go bridge returned an invalid response', [
                    'status' => $response->status(),
                    'keys' => array_keys($json),
                ]);

                return null;
            }

            return [
                'status' => 'ok',
                'message' => $json['message'] ?? 'Supplier deleted successfully.',
                'supplier_id' => $json['supplier_id'] ?? (int) $supplierId,
            ];
        } catch (\Throwable $e) {
            Log::warning('Supplier destroy Go bridge failed and fallback will be used', [
                'message' => $e->getMessage(),
            ]);

            return null;
        }
    }

    /**
     * AJAX endpoint for quick supplier creation
     */
    public function storeAjax(Request $request)
    {
        if ((bool) config('go_backend.features.supplier_store_ajax', false)) {
            $proxied = $this->supplierStoreAjaxViaGo($request);
            if ($proxied !== null) {
                return response()->json($proxied['body'], $proxied['status']);
            }
        }

        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'contact_person' => 'nullable|string|max:255',
            'phone' => 'nullable|string|max:50',
            'email' => 'nullable|email|max:255',
            'address' => 'nullable|string',
        ]);

        try {
            $supplier = Supplier::create($validated);

            return response()->json([
                'success' => true,
                'message' => 'Supplier berhasil ditambahkan',
                'supplier' => [
                    'id' => $supplier->id,
                    'name' => $supplier->name,
                    'contact_person' => $supplier->contact_person,
                    'phone' => $supplier->phone,
                    'email' => $supplier->email,
                    'address' => $supplier->address,
                ],
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Gagal menambahkan supplier',
                'errors' => ['name' => ['Terjadi kesalahan saat menyimpan supplier']]
            ], 422);
        }
    }

    private function supplierStoreAjaxViaGo(Request $request): ?array
    {
        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'contact_person' => 'nullable|string|max:255',
            'phone' => 'nullable|string|max:50',
            'email' => 'nullable|email|max:255',
            'address' => 'nullable|string',
        ]);

        $baseUrl = rtrim((string) config('go_backend.base_url', 'http://127.0.0.1:8081'), '/');
        $timeout = (int) config('go_backend.timeout_seconds', 5);
        $requestId = (string) ($request->header('X-Request-Id') ?: Str::uuid());

        try {
            $response = Http::timeout($timeout)
                ->acceptJson()
                ->withHeaders([
                    'X-Request-Id' => $requestId,
                ])
                ->post($baseUrl . '/api/v1/suppliers/store-ajax', $validated);

            $json = $response->json();
            if (! is_array($json)) {
                Log::warning('Supplier storeAjax Go bridge returned a non-array response', [
                    'status' => $response->status(),
                ]);

                return null;
            }

            if (! isset($json['success']) || ! isset($json['message'])) {
                Log::warning('Supplier storeAjax Go bridge response is missing expected keys', [
                    'status' => $response->status(),
                    'keys' => array_keys($json),
                ]);

                return null;
            }

            return [
                'status' => $response->status(),
                'body' => $json,
            ];
        } catch (\Throwable $e) {
            Log::warning('Supplier storeAjax Go bridge failed and fallback will be used', [
                'message' => $e->getMessage(),
            ]);

            return null;
        }
    }
}
