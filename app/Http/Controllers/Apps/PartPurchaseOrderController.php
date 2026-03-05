<?php

namespace App\Http\Controllers\Apps;

use App\Events\PartPurchaseOrderCreated;
use App\Http\Controllers\Controller;
use App\Models\Part;
use App\Models\PartPurchaseOrder;
use App\Models\PartPurchaseOrderDetail;
use App\Models\PartStockMovement;
use App\Models\Supplier;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Illuminate\Support\Facades\DB;

class PartPurchaseOrderController extends Controller
{
    public function index(Request $request)
    {
        $query = PartPurchaseOrder::with(['supplier'])
            ->withCount('details')
            ->orderBy('po_date', 'desc');

        if ($request->filled('q')) {
            $search = $request->q;
            $query->where(function ($q) use ($search) {
                $q->where('po_number', 'like', "%{$search}%")
                    ->orWhere('notes', 'like', "%{$search}%")
                    ->orWhereHas('supplier', fn ($q) => $q->where('name', 'like', "%{$search}%"));
            });
        }

        if ($request->filled('supplier_id')) {
            $query->where('supplier_id', $request->supplier_id);
        }

        if ($request->filled('status')) {
            $query->where('status', $request->status);
        }

        if ($request->filled('date_from')) {
            $query->whereDate('po_date', '>=', $request->date_from);
        }

        if ($request->filled('date_to')) {
            $query->whereDate('po_date', '<=', $request->date_to);
        }

        $orders = $query->paginate(15);

        return Inertia::render('Dashboard/PartPurchaseOrders/Index', [
            'orders' => $orders,
            'suppliers' => Supplier::orderBy('name')->get(['id', 'name']),
            'filters' => $request->only(['q', 'supplier_id', 'status', 'date_from', 'date_to']),
        ]);
    }

    public function create()
    {
        return Inertia::render('Dashboard/PartPurchaseOrders/Create', [
            'suppliers' => Supplier::orderBy('name')->get(['id', 'name']),
            'parts' => Part::with('category')->orderBy('name')->get(),
        ]);
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'supplier_id' => 'required|exists:suppliers,id',
            'po_date' => 'required|date',
            'expected_delivery_date' => 'nullable|date',
            'notes' => 'nullable|string',
            'items' => 'required|array|min:1',
            'items.*.part_id' => 'required|exists:parts,id',
            'items.*.quantity' => 'required|integer|min:1',
            'items.*.unit_price' => 'required|integer|min:0',
        ]);

        try {
            DB::beginTransaction();

            $totalAmount = 0;
            foreach ($validated['items'] as $item) {
                $totalAmount += $item['quantity'] * $item['unit_price'];
            }

            $order = PartPurchaseOrder::create([
                'supplier_id' => $validated['supplier_id'],
                'po_date' => $validated['po_date'],
                'expected_delivery_date' => $validated['expected_delivery_date'],
                'status' => 'pending',
                'total_amount' => $totalAmount,
                'notes' => $validated['notes'],
            ]);

            foreach ($validated['items'] as $item) {
                $subtotal = $item['quantity'] * $item['unit_price'];
                PartPurchaseOrderDetail::create([
                    'part_purchase_order_id' => $order->id,
                    'part_id' => $item['part_id'],
                    'quantity' => $item['quantity'],
                    'unit_price' => $item['unit_price'],
                    'subtotal' => $subtotal,
                ]);
            }

            DB::commit();

            PartPurchaseOrderCreated::dispatch($order->load(['supplier', 'details.part'])->toArray());

            return redirect()->route('part-purchase-orders.show', $order->id)
                ->with('success', 'Purchase order created successfully');
        } catch (\Exception $e) {
            DB::rollBack();
            return back()->with('error', 'Failed to create purchase order: ' . $e->getMessage());
        }
    }

    public function show(PartPurchaseOrder $partPurchaseOrder)
    {
        return Inertia::render('Dashboard/PartPurchaseOrders/Show', [
            'order' => $partPurchaseOrder->load(['supplier', 'details.part']),
        ]);
    }

    public function updateStatus(Request $request, PartPurchaseOrder $partPurchaseOrder)
    {
        $validated = $request->validate([
            'status' => 'required|in:pending,approved,received,cancelled',
            'actual_delivery_date' => 'nullable|date',
        ]);

        $oldStatus = $partPurchaseOrder->status;
        $newStatus = $validated['status'];

        try {
            DB::beginTransaction();

            // Stock increase when status changes to 'received'
            if ($newStatus === 'received' && $oldStatus !== 'received') {
                foreach ($partPurchaseOrder->details as $detail) {
                    $part = Part::find($detail->part_id);
                    $beforeStock = $part->stock;
                    $afterStock = $beforeStock + $detail->quantity;
                    $part->stock = $afterStock;
                    $part->save();

                    PartStockMovement::create([
                        'type' => 'purchase_order_received',
                        'qty' => $detail->quantity,
                        'before_stock' => $beforeStock,
                        'after_stock' => $afterStock,
                        'reference_type' => 'App\Models\PartPurchaseOrder',
                        'reference_id' => $partPurchaseOrder->id,
                        'part_id' => $detail->part_id,
                        'notes' => "PO {$partPurchaseOrder->po_number} received",
                    ]);
                }
            }

            // Reversal logic: if changed from 'received' to other status
            if ($oldStatus === 'received' && $newStatus !== 'received') {
                foreach ($partPurchaseOrder->details as $detail) {
                    $part = Part::find($detail->part_id);
                    $beforeStock = $part->stock;
                    $afterStock = $beforeStock - $detail->quantity;
                    $part->stock = $afterStock;
                    $part->save();

                    PartStockMovement::create([
                        'type' => 'purchase_order_reversal',
                        'qty' => -$detail->quantity,
                        'before_stock' => $beforeStock,
                        'after_stock' => $afterStock,
                        'reference_type' => 'App\Models\PartPurchaseOrder',
                        'reference_id' => $partPurchaseOrder->id,
                        'part_id' => $detail->part_id,
                        'notes' => "PO {$partPurchaseOrder->po_number} status changed to {$newStatus}",
                    ]);
                }
            }

            $partPurchaseOrder->update([
                'status' => $newStatus,
                'actual_delivery_date' => $validated['actual_delivery_date'],
            ]);

            DB::commit();

            return redirect()->route('part-purchase-orders.show', $partPurchaseOrder->id)
                ->with('success', 'Purchase order status updated successfully');
        } catch (\Exception $e) {
            DB::rollBack();
            return back()->withErrors(['error' => 'Failed to update status: ' . $e->getMessage()]);
        }
    }
}

