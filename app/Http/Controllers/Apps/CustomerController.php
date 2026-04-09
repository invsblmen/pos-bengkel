<?php
namespace App\Http\Controllers\Apps;

use App\Events\CustomerCreated;
use App\Events\CustomerDeleted;
use App\Events\CustomerUpdated;
use App\Http\Controllers\Controller;
use App\Models\Customer;
use App\Support\DispatchesBroadcastSafely;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Inertia\Inertia;

class CustomerController extends Controller
{
    use DispatchesBroadcastSafely;

    /**
     * Display a listing of the resource.
     *
     * @return \Illuminate\Http\Response
     */
    public function index(Request $request)
    {
        if ((bool) config('go_backend.features.customer_index', false)) {
            $proxied = $this->customerIndexViaGo($request);
            if ($proxied !== null) {
                return Inertia::render('Dashboard/Customers/Index', $proxied);
            }
        }

        //get customers
        $customers = Customer::with('vehicles')
            ->when(request()->search, function ($query) {
                $search = request()->search;
                $query->where(function ($q) use ($search) {
                    $q->where('name', 'like', "%$search%")
                      ->orWhere('phone', 'like', "%$search%")
                      ->orWhere('email', 'like', "%$search%");
                });
            })->latest()->paginate(request('per_page', 8));

        //return inertia
        return Inertia::render('Dashboard/Customers/Index', [
            'customers' => $customers,
        ]);
    }

    private function customerIndexViaGo(Request $request): ?array
    {
        try {
            $baseUrl = config('go_backend.base_url');
            $response = \Illuminate\Support\Facades\Http::timeout(config('go_backend.timeout_seconds'))
                ->acceptJson()
                ->get($baseUrl . '/api/v1/customers', $request->query());

            $json = $response->json();
            if (! $response->successful() || ! is_array($json)) {
                Log::warning('Customer index Go bridge returned an invalid response', [
                    'status' => $response->status(),
                    'body' => $response->body(),
                ]);
                return null;
            }

            if (! isset($json['customers'])) {
                Log::warning('Customer index Go bridge response is missing expected keys', [
                    'keys' => array_keys($json),
                ]);
                return null;
            }

            return $json;
        } catch (\Exception $e) {
            Log::warning('Customer index proxy failed', ['error' => $e->getMessage()]);
        }

        return null;
    }

    /**
     * Show the form for creating a new resource.
     *
     * @return \Illuminate\Http\Response
     */
    public function create()
    {
        return Inertia::render('Dashboard/Customers/Create');
    }

    /**
     * Store a newly created resource in storage.
     *
     * @param  \Illuminate\Http\Request  $request
     * @return \Illuminate\Http\Response
     */
    public function store(Request $request)
    {
        if ((bool) config('go_backend.features.customer_store', false)) {
            $proxied = $this->customerStoreViaGo($request);
            if ($proxied !== null) {
                if ($proxied['status'] === 'validation_error') {
                    return back()->withInput()->withErrors($proxied['errors'] ?? ['name' => 'Data pelanggan tidak valid.']);
                }

                $customerPayload = $proxied['customer'] ?? [
                    'name' => $request->input('name'),
                    'phone' => $request->input('phone'),
                    'email' => $request->input('email'),
                    'address' => $request->input('address'),
                ];

                $this->dispatchBroadcastSafely(
                    fn () => event(new CustomerCreated($customerPayload)),
                    'CustomerCreated'
                );

                return to_route('customers.index')->with('flash', [
                    'customer' => $customerPayload,
                ]);
            }
        }

        /**
         * validate
         */
        $validated = $request->validate([
            'name'    => 'required',
            'phone'   => 'required|unique:customers',
            'email'   => 'nullable|email',
            'address' => 'nullable',
        ]);

        //create customer
        $customer = Customer::create([
            'name'    => $validated['name'],
            'phone'   => $validated['phone'],
            'email'   => $validated['email'] ?? null,
            'address' => $validated['address'] ?? null,
        ]);

        $this->dispatchBroadcastSafely(
            fn () => event(new CustomerCreated([
                'id' => $customer->id,
                'name' => $customer->name,
                'phone' => $customer->phone,
                'email' => $customer->email,
                'address' => $customer->address,
            ])),
            'CustomerCreated'
        );

        //redirect with flash data
        return to_route('customers.index')->with('flash', [
            'customer' => $customer
        ]);
    }

    private function customerStoreViaGo(Request $request): ?array
    {
        $validated = $request->validate([
            'name'    => 'required',
            'phone'   => 'required|unique:customers',
            'email'   => 'nullable|email',
            'address' => 'nullable',
        ]);

        try {
            $baseUrl = config('go_backend.base_url');
            $response = \Illuminate\Support\Facades\Http::timeout(config('go_backend.timeout_seconds'))
                ->acceptJson()
                ->post($baseUrl . '/api/v1/customers', $validated);

            $json = $response->json();
            if (! is_array($json)) {
                Log::warning('Customer store Go bridge returned a non-array response', [
                    'status' => $response->status(),
                ]);
                return null;
            }

            if ($response->status() === 422) {
                return [
                    'status' => 'validation_error',
                    'message' => $json['message'] ?? 'Data pelanggan tidak valid.',
                    'errors' => $json['errors'] ?? [],
                ];
            }

            if (! $response->successful()) {
                Log::warning('Customer store Go bridge returned an invalid response', [
                    'status' => $response->status(),
                    'keys' => array_keys($json),
                ]);
                return null;
            }

            return [
                'status' => 'ok',
                'message' => $json['message'] ?? 'Pelanggan berhasil ditambahkan',
                'customer' => $json['customer'] ?? null,
            ];
        } catch (\Exception $e) {
            Log::warning('Customer store proxy failed', ['error' => $e->getMessage()]);
        }

        return null;
    }

    /**
     * Store a newly created customer via AJAX (returns JSON, no redirect)
     *
     * @param  \Illuminate\Http\Request  $request
     * @return \Illuminate\Http\JsonResponse
     */
    public function storeAjax(Request $request)
    {
        if ((bool) config('go_backend.features.customer_store_ajax', false)) {
            $proxied = $this->customerStoreAjaxViaGo($request);
            if ($proxied !== null) {
                return response()->json($proxied['body'], $proxied['status']);
            }
        }

        $validated = $request->validate([
            'name'    => 'required|string|max:255',
            'phone'   => 'nullable|string',
            'no_telp' => 'nullable|string',
            'email'   => 'nullable|email',
            'address' => 'nullable|string',
        ]);

        // Accept either 'phone' or legacy 'no_telp'
        $phone = $validated['phone'] ?? $validated['no_telp'] ?? null;
        if (!$phone) {
            return response()->json([
                'success' => false,
                'message' => 'Telepon wajib diisi',
                'errors'  => ['phone' => ['Telepon wajib diisi']],
            ], 422);
        }

        // Ensure phone is unique
        if (Customer::where('phone', $phone)->exists()) {
            return response()->json([
                'success' => false,
                'message' => 'Nomor telepon sudah terdaftar',
                'errors'  => ['phone' => ['Nomor telepon sudah terdaftar']]
            ], 422);
        }

        try {
            $customer = Customer::create([
                'name'    => $validated['name'],
                'phone'   => $phone,
                'email'   => $validated['email'] ?? null,
                'address' => $validated['address'] ?? null,
            ]);

            $this->dispatchBroadcastSafely(
                fn () => event(new CustomerCreated([
                    'id' => $customer->id,
                    'name' => $customer->name,
                    'phone' => $customer->phone,
                    'email' => $customer->email,
                    'address' => $customer->address,
                ])),
                'CustomerCreated'
            );

            return response()->json([
                'success'  => true,
                'message'  => 'Pelanggan berhasil ditambahkan',
                'customer' => [
                    'id'      => $customer->id,
                    'name'    => $customer->name,
                    'phone'   => $customer->phone,
                    'email'   => $customer->email,
                    'address' => $customer->address,
                ],
            ]);
        } catch (\Exception $e) {
            Log::error('Customer storeAjax error: ' . $e->getMessage(), [
                'file' => $e->getFile(),
                'line' => $e->getLine(),
                'trace' => $e->getTraceAsString()
            ]);

            return response()->json([
                'success' => false,
                'message' => 'Gagal menambahkan pelanggan: ' . $e->getMessage(),
                'errors'  => [],
            ], 500);
        }
    }

    private function customerStoreAjaxViaGo(Request $request): ?array
    {
        try {
            $baseUrl = config('go_backend.base_url');
            $response = \Illuminate\Support\Facades\Http::timeout(config('go_backend.timeout_seconds'))
                ->acceptJson()
                ->post($baseUrl . '/api/v1/customers/store-ajax', $request->only(['name', 'phone', 'no_telp', 'email', 'address']));

            $json = $response->json();
            if (! is_array($json)) {
                Log::warning('Customer storeAjax Go bridge returned a non-array response', [
                    'status' => $response->status(),
                ]);
                return null;
            }

            if (! isset($json['success']) || ! isset($json['message'])) {
                Log::warning('Customer storeAjax Go bridge response is missing expected keys', [
                    'status' => $response->status(),
                    'keys' => array_keys($json),
                ]);
                return null;
            }

            return [
                'status' => $response->status(),
                'body' => $json,
            ];
        } catch (\Exception $e) {
            Log::warning('Customer storeAjax Go proxy failed', ['error' => $e->getMessage()]);
        }

        return null;
    }

    /**
     * Show the form for editing the specified resource.
     *
     * @param  int  $id
     * @return \Illuminate\Http\Response
     */
    public function edit(Customer $customer)
    {
        return Inertia::render('Dashboard/Customers/Edit', [
            'customer' => $customer,
        ]);
    }

    /**
     * Display the specified customer.
     *
     * @param  \App\Models\Customer  $customer
     * @return \Illuminate\Http\Response
     */
    public function show(Customer $customer)
    {
        if ((bool) config('go_backend.features.customer_show', false)) {
            $proxied = $this->customerShowViaGo((int) $customer->id);
            if ($proxied !== null) {
                return Inertia::render('Dashboard/Customers/Show', $proxied);
            }
        }

        $customer->load([
            'vehicles' => function ($query) {
                $query->orderByDesc('created_at');
            },
        ]);

        // Use direct relation query to avoid eager-limit window function issues on strict SQL modes.
        $serviceOrders = $customer->serviceOrders()
            ->with(['vehicle:id,plate_number,brand,model', 'mechanic:id,name'])
            ->orderByDesc('created_at')
            ->limit(20)
            ->get();

        $customer->setRelation('serviceOrders', $serviceOrders);

        return Inertia::render('Dashboard/Customers/Show', [
            'customer' => $customer,
        ]);
    }

    private function customerShowViaGo(int $id): ?array
    {
        try {
            $baseUrl = config('go_backend.base_url');
            $response = \Illuminate\Support\Facades\Http::timeout(config('go_backend.timeout_seconds'))
                ->acceptJson()
                ->get($baseUrl . '/api/v1/customers/' . $id);

            $json = $response->json();
            if (! $response->successful() || ! is_array($json)) {
                Log::warning('Customer show Go bridge returned an invalid response', [
                    'status' => $response->status(),
                    'body' => $response->body(),
                ]);
                return null;
            }

            if (! isset($json['customer'])) {
                Log::warning('Customer show Go bridge response is missing expected keys', [
                    'keys' => array_keys($json),
                ]);
                return null;
            }

            return $json;
        } catch (\Exception $e) {
            Log::warning('Customer show proxy failed', ['error' => $e->getMessage()]);
        }

        return null;
    }

    /**
     * Update the specified resource in storage.
     *
     * @param  \Illuminate\Http\Request  $request
     * @param  int  $id
     * @return \Illuminate\Http\Response
     */
    public function update(Request $request, Customer $customer)
    {
        if ((bool) config('go_backend.features.customer_update', false)) {
            $proxied = $this->customerUpdateViaGo($request, (int) $customer->id);
            if ($proxied !== null) {
                if ($proxied['status'] === 'validation_error') {
                    return back()->withErrors($proxied['errors'] ?? ['name' => 'Data pelanggan tidak valid.']);
                }

                if ($proxied['status'] === 'not_found') {
                    abort(404);
                }

                $customerPayload = $proxied['customer'] ?? [
                    'id' => $customer->id,
                    'name' => $request->input('name'),
                    'phone' => $request->input('phone'),
                    'email' => $request->input('email'),
                    'address' => $request->input('address'),
                ];

                $this->dispatchBroadcastSafely(
                    fn () => event(new CustomerUpdated($customerPayload)),
                    'CustomerUpdated'
                );

                return to_route('customers.index');
            }
        }

        /**
         * validate
         */
        $validated = $request->validate([
            'name'    => 'required',
            'phone'   => 'required|unique:customers,phone,' . $customer->id,
            'email'   => 'nullable|email',
            'address' => 'nullable',
        ]);

        //update customer
        $customer->update([
            'name'    => $validated['name'],
            'phone'   => $validated['phone'],
            'email'   => $validated['email'] ?? null,
            'address' => $validated['address'] ?? null,
        ]);

        // Broadcast customer updated event
        $this->dispatchBroadcastSafely(
            fn () => event(new CustomerUpdated([
                'id' => $customer->id,
                'name' => $customer->name,
                'phone' => $customer->phone,
                'email' => $customer->email,
                'address' => $customer->address,
            ])),
            'CustomerUpdated'
        );

        //redirect
        return to_route('customers.index');
    }

    private function customerUpdateViaGo(Request $request, int $customerId): ?array
    {
        $validated = $request->validate([
            'name'    => 'required',
            'phone'   => 'required|unique:customers,phone,' . $customerId,
            'email'   => 'nullable|email',
            'address' => 'nullable',
        ]);

        try {
            $baseUrl = config('go_backend.base_url');
            $response = \Illuminate\Support\Facades\Http::timeout(config('go_backend.timeout_seconds'))
                ->acceptJson()
                ->put($baseUrl . '/api/v1/customers/' . $customerId, $validated);

            $json = $response->json();
            if (! is_array($json)) {
                Log::warning('Customer update Go bridge returned a non-array response', [
                    'status' => $response->status(),
                ]);
                return null;
            }

            if ($response->status() === 404) {
                return [
                    'status' => 'not_found',
                    'message' => $json['message'] ?? 'Pelanggan tidak ditemukan.',
                ];
            }

            if ($response->status() === 422) {
                return [
                    'status' => 'validation_error',
                    'message' => $json['message'] ?? 'Data pelanggan tidak valid.',
                    'errors' => $json['errors'] ?? [],
                ];
            }

            if (! $response->successful()) {
                Log::warning('Customer update Go bridge returned an invalid response', [
                    'status' => $response->status(),
                    'keys' => array_keys($json),
                ]);
                return null;
            }

            return [
                'status' => 'ok',
                'message' => $json['message'] ?? 'Pelanggan berhasil diperbarui.',
                'customer' => $json['customer'] ?? null,
            ];
        } catch (\Exception $e) {
            Log::warning('Customer update proxy failed', ['error' => $e->getMessage()]);
        }

        return null;
    }

    /**
     * Remove the specified resource from storage.
     *
     * @param  int  $id
     * @return \Illuminate\Http\Response
     */
    public function destroy($id)
    {
        if ((bool) config('go_backend.features.customer_destroy', false)) {
            $proxied = $this->customerDestroyViaGo(request(), (int) $id);
            if ($proxied !== null) {
                if ($proxied['status'] === 'not_found') {
                    abort(404);
                }

                $customerId = (int) ($proxied['customer_id'] ?? $id);
                if ($customerId > 0) {
                    $this->dispatchBroadcastSafely(
                        fn () => event(new CustomerDeleted($customerId)),
                        'CustomerDeleted'
                    );
                }

                return back();
            }
        }

        //find customer by ID
        $customer = Customer::findOrFail($id);

        $customerId = $customer->id;

        //delete customer
        $customer->delete();

        // Broadcast customer deleted event
        $this->dispatchBroadcastSafely(
            fn () => event(new CustomerDeleted($customerId)),
            'CustomerDeleted'
        );

        //redirect
        return back();
    }

    private function customerDestroyViaGo(Request $request, int $customerId): ?array
    {
        try {
            $baseUrl = config('go_backend.base_url');
            $response = \Illuminate\Support\Facades\Http::timeout(config('go_backend.timeout_seconds'))
                ->acceptJson()
                ->delete($baseUrl . '/api/v1/customers/' . $customerId);

            $json = $response->json();
            if (! is_array($json)) {
                Log::warning('Customer destroy Go bridge returned a non-array response', [
                    'status' => $response->status(),
                ]);
                return null;
            }

            if ($response->status() === 404) {
                return [
                    'status' => 'not_found',
                    'message' => $json['message'] ?? 'Pelanggan tidak ditemukan.',
                ];
            }

            if (! $response->successful()) {
                Log::warning('Customer destroy Go bridge returned an invalid response', [
                    'status' => $response->status(),
                    'keys' => array_keys($json),
                ]);
                return null;
            }

            return [
                'status' => 'ok',
                'message' => $json['message'] ?? 'Pelanggan berhasil dihapus.',
                'customer_id' => $json['customer_id'] ?? $customerId,
            ];
        } catch (\Exception $e) {
            Log::warning('Customer destroy proxy failed', ['error' => $e->getMessage()]);
        }

        return null;
    }

    /**
     * Search customers (JSON) for async selectors.
     *
     * @param Request $request
     * @return \Illuminate\Http\JsonResponse
     */
    public function search(Request $request)
    {
        if ((bool) config('go_backend.features.customer_search', false)) {
            $proxied = $this->customerSearchViaGo($request);
            if ($proxied !== null) {
                return response()->json($proxied);
            }
        }

        $q = (string) $request->get('q', '');
        $limit = (int) $request->get('limit', 20);

        $customers = Customer::query()
            ->when($q !== '', function ($query) use ($q) {
                $query->where('name', 'like', "%$q%")
                      ->orWhere('phone', 'like', "%$q%");
            })
            ->orderBy('name')
            ->limit($limit)
            ->get(['id', 'name', 'phone']);

        return response()->json([
            'data' => $customers->map(fn($c) => [
                'id' => $c->id,
                'name' => $c->name,
                'phone' => $c->phone,
            ]),
        ]);
    }

    private function customerSearchViaGo(Request $request): ?array
    {
        try {
            $baseUrl = config('go_backend.base_url');
            $response = \Illuminate\Support\Facades\Http::timeout(config('go_backend.timeout_seconds'))
                ->acceptJson()
                ->get($baseUrl . '/api/v1/customers/search', $request->only(['q', 'limit']));

            $json = $response->json();
            if (! $response->successful() || ! is_array($json)) {
                Log::warning('Customer search Go bridge returned an invalid response', [
                    'status' => $response->status(),
                    'body' => $response->body(),
                ]);
                return null;
            }

            if (! isset($json['data']) || ! is_array($json['data'])) {
                Log::warning('Customer search Go bridge response is missing expected keys', [
                    'keys' => array_keys($json),
                ]);
                return null;
            }

            return $json;
        } catch (\Exception $e) {
            Log::warning('Customer search proxy failed', ['error' => $e->getMessage()]);
        }

        return null;
    }
}
