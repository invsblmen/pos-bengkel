<?php

namespace App\Http\Controllers\Apps;

use App\Http\Controllers\Controller;
use App\Models\Supplier;
use App\Events\SupplierCreated;
use App\Events\SupplierUpdated;
use App\Events\SupplierDeleted;
use App\Support\DispatchesBroadcastSafely;
use Illuminate\Http\Request;
use App\Http\Controllers\Concerns\RespondsWithJsonOrRedirect;
use Illuminate\Support\Facades\Http;
use Illuminate\Validation\ValidationException;
use Illuminate\Support\Facades\Log;

class SupplierController extends Controller
{
    use DispatchesBroadcastSafely;
    use RespondsWithJsonOrRedirect;

    public function index(Request $request)
    {
        $q = $request->query('q', '');

        // Proxy to GO backend when enabled
        if (config('go_backend.features.supplier_index', false)) {
            $baseUrl = rtrim((string) config('go_backend.base_url', 'http://127.0.0.1:8081'), '/');
            try {
                $resp = Http::timeout((int) config('go_backend.timeout_seconds', 5))->get($baseUrl . '/api/v1/suppliers', $request->query());
                $json = $resp->json();
                if (is_array($json)) {
                    return inertia('Dashboard/Suppliers/Index', $json);
                }
            } catch (\Throwable $e) {
                Log::error('Supplier index proxy error: ' . $e->getMessage());
            }
        }

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

    public function create()
    {
        return inertia('Dashboard/Suppliers/Create');
    }

    public function store(Request $request)
    {
        $data = $request->validate([
            'name' => 'required|string|max:255',
            'phone' => 'nullable|string|max:50',
            'email' => 'nullable|email|max:255',
            'address' => 'nullable|string',
            'contact_person' => 'nullable|string|max:255',
        ]);

        // Proxy to GO backend when enabled
        if (config('go_backend.features.supplier_store', false)) {
            $baseUrl = rtrim((string) config('go_backend.base_url', 'http://127.0.0.1:8081'), '/');
            try {
                $resp = Http::timeout((int) config('go_backend.timeout_seconds', 5))->post($baseUrl . '/api/v1/suppliers', $data);
                if ($resp->status() === 422) {
                    $errors = $resp->json('errors') ?? [];
                    throw ValidationException::withMessages($errors);
                }

                $json = $resp->json();
                $message = $json['message'] ?? null;
                $supplierData = $json['supplier'] ?? null;
                $flashData = $supplierData ? ['supplier' => ['id' => $supplierData['id']]] : null;
                return $this->jsonOrRedirect('suppliers.index', [], $message, $flashData, $resp->status());
            } catch (ValidationException $ve) {
                throw $ve;
            } catch (\Throwable $e) {
                Log::error('Supplier store proxy error: ' . $e->getMessage());
            }
        }

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

        return $this->jsonOrRedirect('suppliers.index', [], 'Supplier created successfully.', ['supplier' => $supplier]);
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
        $supplier = Supplier::findOrFail($id);

        $data = $request->validate([
            'name' => 'required|string|max:255',
            'phone' => 'nullable|string|max:50',
            'email' => 'nullable|email|max:255',
            'address' => 'nullable|string',
            'contact_person' => 'nullable|string|max:255',
        ]);

        // Proxy to GO backend when enabled
        if (config('go_backend.features.supplier_update', false)) {
            $baseUrl = rtrim((string) config('go_backend.base_url', 'http://127.0.0.1:8081'), '/');
            try {
                $resp = Http::timeout((int) config('go_backend.timeout_seconds', 5))->put($baseUrl . '/api/v1/suppliers/' . $id, $data);
                if ($resp->status() === 422) {
                    $errors = $resp->json('errors') ?? [];
                    throw ValidationException::withMessages($errors);
                }

                $json = $resp->json();
                $message = $json['message'] ?? null;
                $supplierData = $json['supplier'] ?? null;
                $flashData = $supplierData ? ['supplier' => ['id' => $supplierData['id']]] : null;
                return $this->jsonOrRedirect('suppliers.index', [], $message, $flashData, $resp->status());
            } catch (ValidationException $ve) {
                throw $ve;
            } catch (\Throwable $e) {
                Log::error('Supplier update proxy error: ' . $e->getMessage());
            }
        }

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

        return $this->jsonOrRedirect('suppliers.index', [], 'Supplier updated successfully.', ['supplier' => $supplier]);
    }

    public function destroy($id)
    {
        // Proxy to GO backend when enabled
        if (config('go_backend.features.supplier_destroy', false)) {
            $baseUrl = rtrim((string) config('go_backend.base_url', 'http://127.0.0.1:8081'), '/');
            try {
                $resp = Http::timeout((int) config('go_backend.timeout_seconds', 5))->delete($baseUrl . '/api/v1/suppliers/' . $id);
                $json = $resp->json();
                $message = $json['message'] ?? 'Supplier deleted successfully.';
                return $this->jsonOrRedirect(null, [], $message, null, $resp->status());
            } catch (\Throwable $e) {
                Log::error('Supplier destroy proxy error: ' . $e->getMessage());
            }
        }

        $supplier = Supplier::findOrFail($id);
        $supplierId = $supplier->id;
        $supplier->delete();

        $this->dispatchBroadcastSafely(
            fn () => event(new SupplierDeleted($supplierId)),
            'SupplierDeleted'
        );

        return $this->jsonOrRedirect(null, [], 'Supplier deleted successfully.');
    }

    /**
     * AJAX endpoint for quick supplier creation
     */
    public function storeAjax(Request $request)
    {
        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'contact_person' => 'nullable|string|max:255',
            'phone' => 'nullable|string|max:50',
            'email' => 'nullable|email|max:255',
            'address' => 'nullable|string',
        ]);

        // Proxy to GO backend when enabled
        if (config('go_backend.features.supplier_store_ajax', false)) {
            $baseUrl = rtrim((string) config('go_backend.base_url', 'http://127.0.0.1:8081'), '/');
            try {
                $resp = Http::timeout((int) config('go_backend.timeout_seconds', 5))->post($baseUrl . '/api/v1/suppliers/store-ajax', $validated);
                return response()->json($resp->json(), $resp->status());
            } catch (\Throwable $e) {
                Log::error('Supplier storeAjax proxy error: ' . $e->getMessage());
                return response()->json(['success' => false, 'message' => 'Gagal menambahkan supplier via bridge'], 500);
            }
        }

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
}
