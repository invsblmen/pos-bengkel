<?php

namespace App\Http\Controllers\Apps;

use App\Events\PartPurchaseCreated;
use App\Events\PartPurchaseUpdated;
use App\Http\Controllers\Controller;
use App\Models\BusinessProfile;
use App\Models\Part;
use App\Models\PartPurchase;
use App\Models\PartPurchaseDetail;
use App\Models\PartStockMovement;
use App\Models\Supplier;
use App\Models\User;
use App\Notifications\PartPurchasePendingNotification;
use App\Services\DiscountTaxService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Notification;

class PartPurchaseController extends Controller
{
    public function index(Request $request)
    {
        $query = PartPurchase::with(['supplier', 'details'])
            ->orderBy('purchase_date', 'desc')
            ->orderBy('created_at', 'desc');

        // Filter by supplier
        if ($request->filled('supplier_id')) {
            $query->where('supplier_id', $request->supplier_id);
        }

        // Filter by status
        if ($request->filled('status')) {
            $query->where('status', $request->status);
        }

        // Filter by date range
        if ($request->filled('date_from')) {
            $query->whereDate('purchase_date', '>=', $request->date_from);
        }
        if ($request->filled('date_to')) {
            $query->whereDate('purchase_date', '<=', $request->date_to);
        }

        // Search
        if ($request->filled('q')) {
            $q = $request->q;
            $query->where(function ($sub) use ($q) {
                $sub->where('purchase_number', 'like', "%{$q}%")
                    ->orWhere('notes', 'like', "%{$q}%")
                    ->orWhereHas('supplier', function ($supplierQuery) use ($q) {
                        $supplierQuery->where('name', 'like', "%{$q}%");
                    });
            });
        }

        $purchases = $query->paginate(15)->withQueryString();

        $suppliers = Supplier::orderBy('name')->get();

        return inertia('Dashboard/PartPurchases/Index', [
            'purchases' => $purchases,
            'suppliers' => $suppliers,
            'filters' => [
                'q' => $request->q,
                'supplier_id' => $request->supplier_id,
                'status' => $request->status,
                'date_from' => $request->date_from,
                'date_to' => $request->date_to,
            ],
        ]);
    }

    public function create()
    {
        $suppliers = Supplier::orderBy('name')->get();
        $parts = Part::with('category')
            ->where('status', 'active')
            ->orderBy('name')
            ->get();
        $categories = \App\Models\PartCategory::orderBy('name')->get();

        return inertia('Dashboard/PartPurchases/Create', [
            'suppliers' => $suppliers,
            'parts' => $parts,
            'categories' => $categories,
        ]);
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'supplier_id' => 'required|exists:suppliers,id',
            'purchase_date' => 'required|date',
            'expected_delivery_date' => 'nullable|date',
            'notes' => 'nullable|string',
            'items' => 'required|array|min:1',
            'items.*.part_id' => 'required|exists:parts,id',
            'items.*.quantity' => 'required|integer|min:1',
            'items.*.unit_price' => 'required|integer|min:0',
            'items.*.discount_type' => 'nullable|in:none,percent,fixed',
            'items.*.discount_value' => 'nullable|numeric|min:0',
            // Margin fields for profit calculation (per supplier per part)
            'items.*.margin_type' => 'required|in:percent,fixed',
            'items.*.margin_value' => 'required|numeric|min:0',
            // Promo discount
            'items.*.promo_discount_type' => 'nullable|in:none,percent,fixed',
            'items.*.promo_discount_value' => 'nullable|numeric|min:0',
            'discount_type' => 'nullable|in:none,percent,fixed',
            'discount_value' => 'nullable|numeric|min:0',
            'tax_type' => 'nullable|in:none,percent,fixed',
            'tax_value' => 'nullable|numeric|min:0',
        ]);

        DB::beginTransaction();
        try {
            // Calculate total with item discounts
            $totalAmount = 0;
            $itemsWithDetails = [];

            foreach ($validated['items'] as $item) {
                $subtotal = $item['quantity'] * $item['unit_price'];

                // Calculate item discount
                $finalAmount = DiscountTaxService::calculateAmountWithDiscount(
                    $subtotal,
                    $item['discount_type'] ?? 'none',
                    $item['discount_value'] ?? 0
                );

                $itemsWithDetails[] = array_merge($item, [
                    'subtotal' => $subtotal,
                    'final_amount' => $finalAmount
                ]);

                $totalAmount += $finalAmount;
            }

            // Create purchase
            $purchase = PartPurchase::create([
                'supplier_id' => $validated['supplier_id'],
                'purchase_date' => $validated['purchase_date'],
                'expected_delivery_date' => $validated['expected_delivery_date'] ?? null,
                'status' => 'pending',
                'total_amount' => $totalAmount,
                'notes' => $validated['notes'] ?? null,
                'discount_type' => $validated['discount_type'] ?? 'none',
                'discount_value' => $validated['discount_value'] ?? 0,
                'tax_type' => $validated['tax_type'] ?? 'none',
                'tax_value' => $validated['tax_value'] ?? 0,
                // Store first item's unit cost as reference (will use FIFO)
                'unit_cost' => $itemsWithDetails[0]['unit_price'] ?? 0,
                'margin_type' => $itemsWithDetails[0]['margin_type'] ?? 'percent',
                'margin_value' => $itemsWithDetails[0]['margin_value'] ?? 0,
                'promo_discount_type' => $itemsWithDetails[0]['promo_discount_type'] ?? 'none',
                'promo_discount_value' => $itemsWithDetails[0]['promo_discount_value'] ?? 0,
            ]);

            // Create purchase details with comprehensive price calculations
            foreach ($itemsWithDetails as $item) {
                $detail = PartPurchaseDetail::create([
                    'part_purchase_id' => $purchase->id,
                    'part_id' => $item['part_id'],
                    'quantity' => $item['quantity'],
                    'unit_price' => $item['unit_price'],
                    'subtotal' => $item['subtotal'],
                    'discount_type' => $item['discount_type'] ?? 'none',
                    'discount_value' => $item['discount_value'] ?? 0,
                    'margin_type' => $item['margin_type'] ?? 'percent',
                    'margin_value' => $item['margin_value'] ?? 0,
                    'promo_discount_type' => $item['promo_discount_type'] ?? 'none',
                    'promo_discount_value' => $item['promo_discount_value'] ?? 0,
                    'created_by' => Auth::id(),
                ]);

                // Calculate all pricing fields comprehensively
                $detail->calculateAllPrices()->save();
            }

            // Calculate totals with discount and tax
            $purchase->recalculateTotals()->save();

            DB::commit();

            broadcast(new PartPurchaseCreated($purchase->fresh()->toArray()));

            $this->notifyPendingPurchase($purchase, 'created');

            return redirect()
                ->route('part-purchases.show', $purchase->id)
                ->with('success', 'Purchase created successfully with number: ' . $purchase->purchase_number);
        } catch (\Exception $e) {
            DB::rollBack();
            return back()
                ->withInput()
                ->withErrors(['error' => 'Failed to create purchase: ' . $e->getMessage()]);
        }
    }

    public function show($id)
    {
        $purchase = PartPurchase::with(['supplier', 'details.part.category'])
            ->findOrFail($id);

        return inertia('Dashboard/PartPurchases/Show', [
            'purchase' => $purchase,
        ]);
    }

    public function print($id)
    {
        $purchase = PartPurchase::with(['supplier', 'details.part.category'])
            ->findOrFail($id);

        return inertia('Dashboard/PartPurchases/Print', [
            'purchase' => $purchase,
            'businessProfile' => BusinessProfile::first(),
        ]);
    }

    public function edit($id)
    {
        $purchase = PartPurchase::with(['supplier', 'details.part.category'])
            ->findOrFail($id);

        // Only allow editing pending or ordered purchases
        if (!in_array($purchase->status, ['pending', 'ordered'])) {
            return redirect()->route('part-purchases.show', $id)
                ->with('error', 'Cannot edit purchase with status: ' . $purchase->status);
        }

        $suppliers = Supplier::orderBy('name')->get();
        $parts = Part::with('category')
            ->where('status', 'active')
            ->orderBy('name')
            ->get();
        $categories = \App\Models\PartCategory::orderBy('name')->get();

        return inertia('Dashboard/PartPurchases/Edit', [
            'purchase' => $purchase,
            'suppliers' => $suppliers,
            'parts' => $parts,
            'categories' => $categories,
        ]);
    }

    public function update(Request $request, $id)
    {
        $purchase = PartPurchase::findOrFail($id);

        // Only allow updating pending or ordered purchases
        if (!in_array($purchase->status, ['pending', 'ordered'])) {
            return back()->withErrors(['error' => 'Cannot update purchase with status: ' . $purchase->status]);
        }

        $validated = $request->validate([
            'supplier_id' => 'required|exists:suppliers,id',
            'purchase_date' => 'required|date',
            'expected_delivery_date' => 'nullable|date',
            'notes' => 'nullable|string',
            'items' => 'required|array|min:1',
            'items.*.part_id' => 'required|exists:parts,id',
            'items.*.quantity' => 'required|integer|min:1',
            'items.*.unit_price' => 'required|integer|min:0',
            'items.*.discount_type' => 'nullable|in:none,percent,fixed',
            'items.*.discount_value' => 'nullable|numeric|min:0',
            'items.*.margin_type' => 'required|in:percent,fixed',
            'items.*.margin_value' => 'required|numeric|min:0',
            'items.*.promo_discount_type' => 'nullable|in:none,percent,fixed',
            'items.*.promo_discount_value' => 'nullable|numeric|min:0',
            'discount_type' => 'nullable|in:none,percent,fixed',
            'discount_value' => 'nullable|numeric|min:0',
            'tax_type' => 'nullable|in:none,percent,fixed',
            'tax_value' => 'nullable|numeric|min:0',
        ]);

        DB::beginTransaction();
        try {
            // Update purchase header
            $purchase->update([
                'supplier_id' => $validated['supplier_id'],
                'purchase_date' => $validated['purchase_date'],
                'expected_delivery_date' => $validated['expected_delivery_date'],
                'notes' => $validated['notes'],
                'discount_type' => $validated['discount_type'] ?? 'none',
                'discount_value' => $validated['discount_value'] ?? 0,
                'tax_type' => $validated['tax_type'] ?? 'none',
                'tax_value' => $validated['tax_value'] ?? 0,
                'updated_by' => Auth::id(),
            ]);

            // Delete old details and create new ones
            $purchase->details()->delete();

            // Create new details with comprehensive price calculations
            foreach ($validated['items'] as $itemData) {
                $subtotal = $itemData['quantity'] * $itemData['unit_price'];
                $detail = PartPurchaseDetail::create([
                    'part_purchase_id' => $purchase->id,
                    'part_id' => $itemData['part_id'],
                    'quantity' => $itemData['quantity'],
                    'unit_price' => $itemData['unit_price'],
                    'subtotal' => $subtotal,
                    'discount_type' => $itemData['discount_type'] ?? 'none',
                    'discount_value' => $itemData['discount_value'] ?? 0,
                    'margin_type' => $itemData['margin_type'] ?? 'percent',
                    'margin_value' => $itemData['margin_value'] ?? 0,
                    'promo_discount_type' => $itemData['promo_discount_type'] ?? 'none',
                    'promo_discount_value' => $itemData['promo_discount_value'] ?? 0,
                    'created_by' => Auth::id(),
                ]);

                // Calculate all pricing fields comprehensively (consistent with store)
                $detail->calculateAllPrices()->save();
            }

            // Recalculate totals (consistent with store)
            $purchase->recalculateTotals()->save();

            DB::commit();

            broadcast(new PartPurchaseUpdated($purchase->fresh()->toArray()));

            return redirect()->route('part-purchases.show', $purchase->id)
                ->with('success', 'Purchase updated successfully');
        } catch (\Exception $e) {
            DB::rollBack();
            return back()->withErrors(['error' => 'Failed to update purchase: ' . $e->getMessage()])
                ->withInput();
        }
    }

    public function updateStatus(Request $request, $id)
    {
        $validated = $request->validate([
            'status' => 'required|in:pending,ordered,received,cancelled',
            'actual_delivery_date' => 'nullable|date',
        ]);

        $purchase = PartPurchase::with('details.part')->findOrFail($id);

        DB::beginTransaction();
        try {
            $oldStatus = $purchase->status;
            $newStatus = $validated['status'];

            $shouldNotifyPending = $newStatus === 'pending' && $oldStatus !== 'pending';

            // Update purchase status
            $purchase->status = $newStatus;
            if ($newStatus === 'received' && $request->filled('actual_delivery_date')) {
                $purchase->actual_delivery_date = $validated['actual_delivery_date'];
            }
            $purchase->save();

            // If status changed to 'received', update stock and buy_price
            if ($newStatus === 'received' && $oldStatus !== 'received') {
                foreach ($purchase->details as $detail) {
                    $part = $detail->part;
                    $beforeStock = $part->stock;
                    $afterStock = $beforeStock + $detail->quantity;

                    // Calculate buy price after discount
                    $priceAfterDiscount = DiscountTaxService::calculateAmountWithDiscount(
                        $detail->unit_price,
                        $detail->discount_type ?? 'none',
                        $detail->discount_value ?? 0
                    );

                    // Update part stock and buy_price
                    $part->stock = $afterStock;
                    $part->buy_price = $priceAfterDiscount;
                    $part->save();

                    // Create stock movement
                    PartStockMovement::create([
                        'part_id' => $part->id,
                        'type' => 'purchase',
                        'qty' => $detail->quantity,
                        'before_stock' => $beforeStock,
                        'after_stock' => $afterStock,
                        'unit_price' => $priceAfterDiscount,
                        'supplier_id' => $purchase->supplier_id,
                        'reference_type' => 'App\Models\PartPurchase',
                        'reference_id' => $purchase->id,
                        'notes' => "Purchase from {$purchase->supplier->name} - {$purchase->purchase_number}",
                        'created_by' => Auth::id(),
                    ]);
                }
            }

            DB::commit();

            if ($shouldNotifyPending) {
                $this->notifyPendingPurchase($purchase, 'status-change');
            }

            return back()->with('success', 'Purchase status updated to: ' . $newStatus);
        } catch (\Exception $e) {
            DB::rollBack();
            return back()->withErrors(['error' => 'Failed to update status: ' . $e->getMessage()]);
        }
    }

    private function notifyPendingPurchase(PartPurchase $purchase, string $context): void
    {
        if ($purchase->status !== 'pending') {
            return;
        }

        $recipients = User::role(['cashier', 'super-admin'])->get();
        if ($recipients->isEmpty()) {
            return;
        }

        Notification::send($recipients, new PartPurchasePendingNotification($purchase, $context));
    }
}
