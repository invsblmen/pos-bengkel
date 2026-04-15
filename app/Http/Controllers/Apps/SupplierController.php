<?php

namespace App\Http\Controllers\Apps;

use App\Http\Controllers\Controller;
use App\Models\Supplier;
use App\Events\SupplierCreated;
use App\Events\SupplierUpdated;
use App\Events\SupplierDeleted;
use App\Support\DispatchesBroadcastSafely;
use Illuminate\Http\Request;

class SupplierController extends Controller
{
    use DispatchesBroadcastSafely;

    public function index(Request $request)
    {
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

    public function destroy($id)
    {
        $supplier = Supplier::findOrFail($id);
        $supplierId = $supplier->id;
        $supplier->delete();

        $this->dispatchBroadcastSafely(
            fn () => event(new SupplierDeleted($supplierId)),
            'SupplierDeleted'
        );

        return redirect()->back()->with('success', 'Supplier deleted successfully.');
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
