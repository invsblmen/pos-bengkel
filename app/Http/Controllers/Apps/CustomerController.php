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
    public function index()
    {
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

    /**
     * Store a newly created customer via AJAX (returns JSON, no redirect)
     *
     * @param  \Illuminate\Http\Request  $request
     * @return \Illuminate\Http\JsonResponse
     */
    public function storeAjax(Request $request)
    {
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

    /**
     * Update the specified resource in storage.
     *
     * @param  \Illuminate\Http\Request  $request
     * @param  int  $id
     * @return \Illuminate\Http\Response
     */
    public function update(Request $request, Customer $customer)
    {
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

    /**
     * Remove the specified resource from storage.
     *
     * @param  int  $id
     * @return \Illuminate\Http\Response
     */
    public function destroy($id)
    {
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

    /**
     * Search customers (JSON) for async selectors.
     *
     * @param Request $request
     * @return \Illuminate\Http\JsonResponse
     */
    public function search(Request $request)
    {
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
}
