<?php
namespace App\Http\Controllers\Apps;

use App\Http\Controllers\Controller;
use App\Models\Customer;
use App\Models\Transaction;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Inertia\Inertia;

class CustomerController extends Controller
{
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

        //delete customer
        $customer->delete();

        //redirect
        return back();
    }

    /**
     * Get customer purchase history
     *
     * @param  Customer $customer
     * @return \Illuminate\Http\JsonResponse
     */
    public function getHistory(Customer $customer)
    {
        // Get transaction statistics
        $stats = Transaction::where('customer_id', $customer->id)
            ->selectRaw('
                COUNT(*) as total_transactions,
                SUM(grand_total) as total_spent,
                MAX(created_at) as last_visit
            ')
            ->first();

        // Get recent transactions (last 5)
        $recentTransactions = Transaction::where('customer_id', $customer->id)
            ->select('id', 'invoice', 'grand_total', 'payment_method', 'created_at')
            ->orderByDesc('created_at')
            ->limit(5)
            ->get()
            ->map(fn($t) => [
                'id'             => $t->id,
                'invoice'        => $t->invoice,
                'total'          => $t->grand_total,
                'payment_method' => $t->payment_method,
                'date'           => \Carbon\Carbon::parse($t->created_at)->format('d M Y H:i'),
            ]);

        // Get frequently purchased products
        $frequentProducts = Transaction::where('customer_id', $customer->id)
            ->join('transaction_details', 'transactions.id', '=', 'transaction_details.transaction_id')
            ->join('products', 'transaction_details.product_id', '=', 'products.id')
            ->selectRaw('products.id, products.title, SUM(transaction_details.qty) as total_qty')
            ->groupBy('products.id', 'products.title')
            ->orderByDesc('total_qty')
            ->limit(3)
            ->get();

        return response()->json([
            'success'             => true,
            'customer'            => [
                'id'    => $customer->id,
                'name'  => $customer->name,
                'phone' => $customer->no_telp,
            ],
            'stats'               => [
                'total_transactions' => (int) ($stats->total_transactions ?? 0),
                'total_spent'        => (int) ($stats->total_spent ?? 0),
                'last_visit'         => $stats->last_visit ? \Carbon\Carbon::parse($stats->last_visit)->format('d M Y') : null,
            ],
            'recent_transactions' => $recentTransactions,
            'frequent_products'   => $frequentProducts,
        ]);
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
