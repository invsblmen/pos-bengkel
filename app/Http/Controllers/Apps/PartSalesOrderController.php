<?php

namespace App\Http\Controllers\Apps;

use App\Events\PartSalesOrderCreated;
use App\Http\Controllers\Controller;
use App\Models\PartSalesOrder;
use App\Models\PartSalesOrderDetail;
use App\Models\Customer;
use App\Models\Part;
use App\Models\PartStockMovement;
use App\Support\DispatchesBroadcastSafely;
use App\Services\DiscountTaxService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;
use App\Http\Controllers\Concerns\RespondsWithJsonOrRedirect;
use Illuminate\Validation\ValidationException;

class PartSalesOrderController extends Controller
{
    use DispatchesBroadcastSafely;
    use RespondsWithJsonOrRedirect;

    public function index(Request $request)
    {
        $query = PartSalesOrder::with(['customer', 'details']);

        if ($request->filled('customer_id')) {
            $query->where('customer_id', $request->customer_id);
        }

        if ($request->filled('status')) {
            $query->where('status', $request->status);
        }

        if ($request->filled('date_from')) {
            $query->whereDate('order_date', '>=', $request->date_from);
        }
        if ($request->filled('date_to')) {
            $query->whereDate('order_date', '<=', $request->date_to);
        }

        if ($request->filled('q')) {
            $query->where(function ($q) use ($request) {
                $q->where('order_number', 'like', '%' . $request->q . '%')
                  ->orWhere('notes', 'like', '%' . $request->q . '%')
                  ->orWhereHas('customer', function ($q) use ($request) {
                      $q->where('name', 'like', '%' . $request->q . '%');
                  });
            });
        }

        $orders = $query->orderBy('created_at', 'desc')->paginate(15);

        return Inertia::render('Dashboard/PartSalesOrders/Index', [
            'orders' => $orders,
            'customers' => Customer::orderBy('name')->get(['id', 'name']),
            'filters' => $request->only(['q', 'customer_id', 'status', 'date_from', 'date_to']),
        ]);
    }

    public function create()
    {
        return Inertia::render('Dashboard/PartSalesOrders/Create', [
            'customers' => Customer::orderBy('name')->get(['id', 'name']),
            'parts' => Part::where('stock', '>', 0)->with('category')->orderBy('name')->get(),
        ]);
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'customer_id' => 'required|exists:customers,id',
            'order_date' => 'required|date',
            'expected_delivery_date' => 'nullable|date',
            'notes' => 'nullable|string',
            'items' => 'required|array|min:1',
            'items.*.part_id' => 'required|exists:parts,id',
            'items.*.quantity' => 'required|integer|min:1',
            'items.*.unit_price' => 'required|integer|min:0',
            'items.*.discount_type' => 'nullable|in:none,percent,fixed',
            'items.*.discount_value' => 'nullable|numeric|min:0',
            'discount_type' => 'nullable|in:none,percent,fixed',
            'discount_value' => 'nullable|numeric|min:0',
            'tax_type' => 'nullable|in:none,percent,fixed',
            'tax_value' => 'nullable|numeric|min:0',
        ]);

        DB::beginTransaction();
        try {
            $totalAmount = 0;
            foreach ($validated['items'] as $item) {
                $totalAmount += $item['quantity'] * $item['unit_price'];
            }

            $order = PartSalesOrder::create([
                'customer_id' => $validated['customer_id'],
                'order_date' => $validated['order_date'],
                'expected_delivery_date' => $validated['expected_delivery_date'] ?? null,
                'status' => 'pending',
                'total_amount' => $totalAmount,
                'notes' => $validated['notes'] ?? null,
                'discount_type' => $validated['discount_type'] ?? 'none',
                'discount_value' => $validated['discount_value'] ?? 0,
                'tax_type' => $validated['tax_type'] ?? 'none',
                'tax_value' => $validated['tax_value'] ?? 0,
            ]);

            foreach ($validated['items'] as $item) {
                PartSalesOrderDetail::create([
                    'part_sales_order_id' => $order->id,
                    'part_id' => $item['part_id'],
                    'quantity' => $item['quantity'],
                    'unit_price' => $item['unit_price'],
                    'subtotal' => $item['quantity'] * $item['unit_price'],
                ]);
            }

            // Calculate totals with discount and tax
            $order->recalculateTotals()->save();

            DB::commit();

            $this->dispatchBroadcastSafely(
                fn () => PartSalesOrderCreated::dispatch($order->load(['customer', 'details.part'])->toArray()),
                'PartSalesOrderCreated'
            );

            return $this->jsonOrRedirect('part-sales-orders.show', [$order->id], 'Sales order created successfully', $order, 201);
        } catch (\Exception $e) {
            DB::rollBack();
            return $this->errorResponse('Failed to create sales order: ' . $e->getMessage(), ['error' => ['Failed to create sales order: ' . $e->getMessage()]], 500);
        }
    }

    public function show($id)
    {
        $order = PartSalesOrder::with(['customer', 'details.part.category'])->findOrFail($id);

        return Inertia::render('Dashboard/PartSalesOrders/Show', [
            'order' => $order,
        ]);
    }

    public function updateStatus(Request $request, $id)
    {
        $validated = $request->validate([
            'status' => 'required|in:pending,confirmed,fulfilled,cancelled',
            'actual_delivery_date' => 'nullable|date',
        ]);

        $order = PartSalesOrder::with('details.part')->findOrFail($id);
        $oldStatus = $order->status;
        $newStatus = $validated['status'];

        DB::beginTransaction();
        try {
            if ($newStatus === 'fulfilled' && $oldStatus !== 'fulfilled') {
                foreach ($order->details as $detail) {
                    $part = $detail->part;
                    if ($part->stock < $detail->quantity) {
                        throw ValidationException::withMessages([
                            'error' => ["Insufficient stock for {$part->name}. Available: {$part->stock}, Required: {$detail->quantity}"]
                        ]);
                    }
                }

                foreach ($order->details as $detail) {
                    $part = $detail->part;
                    $beforeStock = $part->stock;
                    $afterStock = $beforeStock - $detail->quantity;

                    $part->stock = $afterStock;
                    $part->save();

                    PartStockMovement::create([
                        'part_id' => $part->id,
                        'type' => 'sales_order',
                        'qty' => -$detail->quantity,
                        'before_stock' => $beforeStock,
                        'after_stock' => $afterStock,
                        'unit_price' => $detail->unit_price,
                        'customer_id' => $order->customer_id,
                        'reference_type' => 'App\\Models\\PartSalesOrder',
                        'reference_id' => $order->id,
                        'notes' => "Sales order to {$order->customer->name} - {$order->order_number}",
                        'created_by' => Auth::id(),
                    ]);
                }

                $order->actual_delivery_date = $validated['actual_delivery_date'] ?? now();
            }

            if ($oldStatus === 'fulfilled' && $newStatus !== 'fulfilled') {
                foreach ($order->details as $detail) {
                    $part = $detail->part;
                    $beforeStock = $part->stock;
                    $afterStock = $beforeStock + $detail->quantity;

                    $part->stock = $afterStock;
                    $part->save();

                    PartStockMovement::create([
                        'part_id' => $part->id,
                        'type' => 'sales_order_reversal',
                        'qty' => $detail->quantity,
                        'before_stock' => $beforeStock,
                        'after_stock' => $afterStock,
                        'unit_price' => $detail->unit_price,
                        'customer_id' => $order->customer_id,
                        'reference_type' => 'App\\Models\\PartSalesOrder',
                        'reference_id' => $order->id,
                        'notes' => "Reversal - {$order->order_number} status changed from fulfilled to {$newStatus}",
                        'created_by' => Auth::id(),
                    ]);
                }
            }

            $order->status = $newStatus;
            if ($newStatus === 'fulfilled' && !empty($validated['actual_delivery_date'])) {
                $order->actual_delivery_date = $validated['actual_delivery_date'];
            }
            $order->save();

            DB::commit();

            return $this->jsonOrRedirect('part-sales-orders.show', [$order->id], 'Order status updated successfully', $order);
        } catch (\Exception $e) {
            DB::rollBack();
            return $this->errorResponse('Failed to update status: ' . $e->getMessage(), ['error' => ['Failed to update status: ' . $e->getMessage()]], 500);
        }
    }
}
