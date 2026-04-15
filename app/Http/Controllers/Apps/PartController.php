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
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;

class PartController extends Controller
{
    use DispatchesBroadcastSafely;

    public function index(Request $request)
    {
        $q = $request->query('q', '');
        $categoryId = $request->query('category_id', '');
        $supplierId = $request->query('supplier_id', '');
        $stockStatus = $request->query('stock_status', '');
        $sortBy = $request->query('sort_by', 'name');
        $sortDirection = $request->query('sort_direction', 'asc');
        $perPage = $request->query('per_page', 10);

        $query = Part::with(['supplier', 'category']);

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

        // Category filter
        if ($categoryId) {
            $query->where('part_category_id', $categoryId);
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

    public function edit($id)
    {
        $part = Part::findOrFail($id);
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
        $part->load('supplier', 'category');

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

        // Inertia requests must receive an Inertia-compatible redirect response.
        if ($request->header('X-Inertia')) {
            return redirect()
                ->route('parts.index')
                ->with('success', 'Part created successfully.')
                ->with('flash', ['part' => $part]);
        }

        // For AJAX/modal flows, keep JSON contract.
        if ($request->expectsJson() || $request->wantsJson() || $request->ajax()) {
            return response()->json([
                'success' => true,
                'message' => 'Part created successfully.',
                'part' => $part,
            ], 201);
        }

        return redirect()
            ->route('parts.index')
            ->with('success', 'Part created successfully.');
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
            'supplier_id' => 'nullable|exists:suppliers,id',
            'buy_price' => 'nullable|numeric|min:0',
            'sell_price' => 'nullable|numeric|min:0',
            'stock' => 'nullable|integer|min:0',
            'description' => 'nullable|string',
            'has_warranty' => 'nullable|boolean',
            'warranty_duration_days' => 'nullable|integer|min:0',
            'warranty_terms' => 'nullable|string',
        ]);

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

        return redirect()->back()->with([
            'success' => 'Part updated successfully.',
            'flash' => ['part' => $part]
        ]);
    }

    public function show($id)
    {
        $part = Part::with(['supplier', 'category'])->findOrFail($id);

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

        return redirect()->back()->with('success', 'Part deleted successfully.');
    }
}
