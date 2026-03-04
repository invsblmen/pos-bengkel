<?php

namespace App\Http\Controllers;

use App\Models\BusinessProfile;
use App\Models\PartSale;
use App\Models\PartSaleDetail;
use App\Models\PartSalesOrder;
use App\Models\Part;
use App\Models\Customer;
use App\Models\PartStockMovement;
use App\Models\User;
use App\Notifications\PartSaleOrderReadyNotification;
use App\Services\DiscountTaxService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;

class PartSaleController extends Controller
{
    protected $discountTaxService;

    public function __construct(DiscountTaxService $discountTaxService)
    {
        $this->discountTaxService = $discountTaxService;
    }

    public function index(Request $request)
    {
        $this->syncWaitingStockOrders();

        $query = PartSale::with(['customer', 'creator', 'salesOrder'])
            ->orderBy('created_at', 'desc');

        // Filter by status
        if ($request->filled('status')) {
            $query->where('status', $request->status);
        }

        // Filter by payment status
        if ($request->filled('payment_status')) {
            $query->where('payment_status', $request->payment_status);
        }

        // Filter by customer
        if ($request->filled('customer_id')) {
            $query->where('customer_id', $request->customer_id);
        }

        // Search by sale number
        if ($request->filled('search')) {
            $query->where('sale_number', 'like', '%' . $request->search . '%');
        }

        $sales = $query->paginate(15)->withQueryString();

        return Inertia::render('Dashboard/Parts/Sales/Index', [
            'sales' => $sales,
            'filters' => $request->only(['status', 'payment_status', 'customer_id', 'search']),
            'customers' => Customer::orderBy('name')->get(),
        ]);
    }

    public function create(Request $request)
    {
        $customers = Customer::orderBy('name')->get();
        $parts = Part::orderBy('name')->get();

        // If fulfilling from sales order
        $salesOrder = null;
        if ($request->filled('sales_order_id')) {
            $salesOrder = PartSalesOrder::with(['customer', 'details.part'])
                ->findOrFail($request->sales_order_id);
        }

        return Inertia::render('Dashboard/Parts/Sales/Create', [
            'customers' => $customers,
            'parts' => $parts,
            'salesOrder' => $salesOrder,
        ]);
    }

    public function store(Request $request)
    {
        $request->validate([
            'customer_id' => 'required|exists:customers,id',
            'sale_date' => 'required|date',
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
            'paid_amount' => 'nullable|integer|min:0',
            'status' => 'nullable|in:draft,confirmed,waiting_stock,ready_to_notify,waiting_pickup,completed,cancelled',
            'notes' => 'nullable|string',
            'part_sales_order_id' => 'nullable|exists:part_sales_orders,id',
        ]);

        DB::beginTransaction();
        try {
            $status = $request->status ?? 'confirmed';

            // Check stock availability (for direct-sale style statuses)
            if (in_array($status, ['confirmed', 'ready_to_notify', 'waiting_pickup', 'completed'], true)) {
                foreach ($request->items as $item) {
                    $part = Part::findOrFail($item['part_id']);
                    if ($part->stock < $item['quantity']) {
                        throw new \Exception("Stock {$part->name} tidak mencukupi. Tersedia: {$part->stock}, diminta: {$item['quantity']}");
                    }
                }
            }

            // Create sale
            $sale = PartSale::create([
                'sale_number' => PartSale::generateSaleNumber(),
                'customer_id' => $request->customer_id,
                'sale_date' => $request->sale_date,
                'part_sales_order_id' => $request->part_sales_order_id,
                'discount_type' => $request->discount_type ?? 'none',
                'discount_value' => $request->discount_value ?? 0,
                'tax_type' => $request->tax_type ?? 'none',
                'tax_value' => $request->tax_value ?? 0,
                'paid_amount' => $request->paid_amount ?? 0,
                'notes' => $request->notes,
                'status' => $status,
                'created_by' => Auth::id(),
            ]);

            // Create sale details and update stock
            foreach ($request->items as $item) {
                $part = Part::findOrFail($item['part_id']);

                $subtotal = $item['quantity'] * $item['unit_price'];

                // Calculate item discount
                $discountAmount = 0;
                $discountType = $item['discount_type'] ?? 'none';
                $discountValue = $item['discount_value'] ?? 0;

                if ($discountType !== 'none' && $discountValue > 0) {
                    $discountAmount = DiscountTaxService::calculateDiscount(
                        $subtotal,
                        $discountType,
                        $discountValue
                    );
                }

                $finalAmount = $subtotal - $discountAmount;

                // Reserve stock based on unified status flow
                $reservedQty = 0;
                if (in_array($status, ['confirmed', 'ready_to_notify', 'waiting_pickup', 'completed'], true)) {
                    $beforeStock = $part->stock;
                    $afterStock = max(0, $beforeStock - $item['quantity']);
                    $part->update(['stock' => $afterStock]);
                    $reservedQty = $item['quantity'];

                    PartStockMovement::create([
                        'part_id' => $part->id,
                        'reference_type' => PartSale::class,
                        'reference_id' => $sale->id,
                        'type' => 'out',
                        'qty' => $item['quantity'],
                        'before_stock' => $beforeStock,
                        'after_stock' => $afterStock,
                        'unit_price' => $item['unit_price'],
                        'notes' => "Penjualan #{$sale->sale_number}",
                        'created_by' => Auth::id(),
                    ]);
                } elseif ($status === 'waiting_stock' && $part->stock >= $item['quantity']) {
                    // Full reserve for this line if stock available now; else wait for incoming stock
                    $beforeStock = $part->stock;
                    $afterStock = max(0, $beforeStock - $item['quantity']);
                    $part->update(['stock' => $afterStock]);
                    $reservedQty = $item['quantity'];

                    PartStockMovement::create([
                        'part_id' => $part->id,
                        'reference_type' => PartSale::class,
                        'reference_id' => $sale->id,
                        'type' => 'out',
                        'qty' => $item['quantity'],
                        'before_stock' => $beforeStock,
                        'after_stock' => $afterStock,
                        'unit_price' => $item['unit_price'],
                        'notes' => "Reservasi Pesanan #{$sale->sale_number}",
                        'created_by' => Auth::id(),
                    ]);
                }

                // Create detail
                PartSaleDetail::create([
                    'part_sale_id' => $sale->id,
                    'part_id' => $part->id,
                    'quantity' => $item['quantity'],
                    'reserved_quantity' => $reservedQty,
                    'unit_price' => $item['unit_price'],
                    'subtotal' => $subtotal,
                    'discount_type' => $discountType,
                    'discount_value' => $discountValue,
                    'discount_amount' => $discountAmount,
                    'final_amount' => $finalAmount,
                    'cost_price' => $part->buy_price ?? 0,
                    'selling_price' => $item['unit_price'],
                ]);

            }

            // Recalculate totals
            $sale->recalculateTotals()->save();

            if ($sale->status === 'waiting_stock') {
                $this->tryFulfillWaitingStock($sale);
            }

            // If fulfilling a sales order, update SO status
            if ($request->filled('part_sales_order_id')) {
                $salesOrder = PartSalesOrder::findOrFail($request->part_sales_order_id);
                $salesOrder->update(['status' => 'fulfilled']);
            }

            DB::commit();

            return redirect()
                ->route('part-sales.show', $sale)
                ->with('success', 'Penjualan berhasil dibuat');

        } catch (\Exception $e) {
            DB::rollBack();
            return back()
                ->withInput()
                ->withErrors(['error' => $e->getMessage()]);
        }
    }

    public function show(PartSale $partSale)
    {
        $this->tryFulfillWaitingStock($partSale);

        $partSale->load([
            'customer',
            'salesOrder',
            'details.part',
            'creator',
            'stockMovements.part',
        ]);

        return Inertia::render('Dashboard/Parts/Sales/Show', [
            'sale' => $partSale,
            'businessProfile' => BusinessProfile::first(),
        ]);
    }

    public function print(PartSale $partSale)
    {
        $this->tryFulfillWaitingStock($partSale);

        $partSale->load([
            'customer',
            'details.part',
            'creator',
        ]);

        return Inertia::render('Dashboard/Parts/Sales/Print', [
            'sale' => $partSale,
            'businessProfile' => BusinessProfile::first(),
        ]);
    }

    public function edit(PartSale $partSale)
    {
        // Only allow editing draft sales
        if ($partSale->status !== 'draft') {
            return back()->withErrors(['error' => 'Hanya penjualan draft yang bisa diedit']);
        }

        $partSale->load('details.part');
        $customers = Customer::orderBy('name')->get();
        $parts = Part::orderBy('name')->get();

        return Inertia::render('Dashboard/Parts/Sales/Edit', [
            'sale' => $partSale,
            'customers' => $customers,
            'parts' => $parts,
        ]);
    }

    public function update(Request $request, PartSale $partSale)
    {
        // Only allow updating draft sales
        if ($partSale->status !== 'draft') {
            return back()->withErrors(['error' => 'Hanya penjualan draft yang bisa diupdate']);
        }

        $request->validate([
            'customer_id' => 'required|exists:customers,id',
            'sale_date' => 'required|date',
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
            'paid_amount' => 'nullable|integer|min:0',
            'status' => 'nullable|in:draft,confirmed,waiting_stock,ready_to_notify,waiting_pickup,completed,cancelled',
            'notes' => 'nullable|string',
        ]);

        DB::beginTransaction();
        try {
            // Delete old details
            $partSale->details()->delete();

            // Update sale
            $status = $request->status ?? $partSale->status;
            $partSale->update([
                'customer_id' => $request->customer_id,
                'sale_date' => $request->sale_date,
                'discount_type' => $request->discount_type ?? 'none',
                'discount_value' => $request->discount_value ?? 0,
                'tax_type' => $request->tax_type ?? 'none',
                'tax_value' => $request->tax_value ?? 0,
                'paid_amount' => $request->paid_amount ?? $partSale->paid_amount,
                'status' => $status,
                'notes' => $request->notes,
            ]);

            // Create new details
            foreach ($request->items as $item) {
                $subtotal = $item['quantity'] * $item['unit_price'];

                $discountAmount = 0;
                $discountType = $item['discount_type'] ?? 'none';
                $discountValue = $item['discount_value'] ?? 0;

                if ($discountType !== 'none' && $discountValue > 0) {
                    $discountAmount = DiscountTaxService::calculateDiscount(
                        $subtotal,
                        $discountType,
                        $discountValue
                    );
                }

                $finalAmount = $subtotal - $discountAmount;

                PartSaleDetail::create([
                    'part_sale_id' => $partSale->id,
                    'part_id' => $item['part_id'],
                    'quantity' => $item['quantity'],
                    'reserved_quantity' => 0,
                    'unit_price' => $item['unit_price'],
                    'subtotal' => $subtotal,
                    'discount_type' => $discountType,
                    'discount_value' => $discountValue,
                    'discount_amount' => $discountAmount,
                    'final_amount' => $finalAmount,
                    'cost_price' => Part::find($item['part_id'])?->buy_price ?? 0,
                    'selling_price' => $item['unit_price'],
                ]);
            }

            // Recalculate totals
            $partSale->recalculateTotals()->save();

            if (in_array($status, ['confirmed', 'ready_to_notify', 'waiting_pickup', 'completed'], true)) {
                $this->reserveAllDetailsOrFail($partSale, "Konfirmasi Penjualan #{$partSale->sale_number}");
            } elseif ($status === 'waiting_stock') {
                $this->tryFulfillWaitingStock($partSale);
            }

            DB::commit();

            return redirect()
                ->route('part-sales.show', $partSale)
                ->with('success', 'Penjualan berhasil diupdate');

        } catch (\Exception $e) {
            DB::rollBack();
            return back()
                ->withInput()
                ->withErrors(['error' => $e->getMessage()]);
        }
    }

    public function destroy(PartSale $partSale)
    {
        // Only allow deleting draft sales
        if ($partSale->status !== 'draft') {
            return back()->withErrors(['error' => 'Hanya penjualan draft yang bisa dihapus']);
        }

        DB::beginTransaction();
        try {
            $partSale->details()->delete();
            $partSale->delete();

            DB::commit();

            return redirect()
                ->route('part-sales.index')
                ->with('success', 'Penjualan berhasil dihapus');

        } catch (\Exception $e) {
            DB::rollBack();
            return back()->withErrors(['error' => $e->getMessage()]);
        }
    }

    public function updatePayment(Request $request, PartSale $partSale)
    {
        $request->validate([
            'payment_amount' => 'required|integer|min:1',
        ]);

        $newPaidAmount = $partSale->paid_amount + $request->payment_amount;

        $partSale->update([
            'paid_amount' => $newPaidAmount,
            'remaining_amount' => max(0, $partSale->grand_total - $newPaidAmount),
            'payment_status' => $newPaidAmount >= $partSale->grand_total ? 'paid' : ($newPaidAmount > 0 ? 'partial' : 'unpaid'),
        ]);

        return back()->with('success', 'Pembayaran berhasil dicatat');
    }

    public function updateStatus(Request $request, PartSale $partSale)
    {
        $request->validate([
            'status' => 'required|in:draft,confirmed,waiting_stock,ready_to_notify,waiting_pickup,completed,cancelled',
        ]);

        $newStatus = $request->status;
        $currentStatus = $partSale->status;

        if ($newStatus === $currentStatus) {
            return back()->with('success', 'Status tidak berubah');
        }

        if (in_array($currentStatus, ['completed', 'cancelled'], true)) {
            return back()->withErrors(['error' => 'Status sudah final dan tidak bisa diubah']);
        }

        DB::beginTransaction();
        try {
            $partSale->load('details.part');

            if ($newStatus === 'waiting_stock') {
                $this->releaseReservedStock($partSale, "Penyesuaian ke Waiting Stock #{$partSale->sale_number}");
                $this->tryFulfillWaitingStock($partSale);
            }

            if (in_array($newStatus, ['confirmed', 'ready_to_notify', 'waiting_pickup', 'completed'], true)) {
                $this->reserveAllDetailsOrFail($partSale, "Update Status Penjualan #{$partSale->sale_number}");
            }

            if ($newStatus === 'cancelled') {
                $this->releaseReservedStock($partSale, "Pembatalan Penjualan #{$partSale->sale_number}");
            }

            $partSale->update(['status' => $newStatus]);

            DB::commit();
            return back()->with('success', 'Status penjualan berhasil diperbarui');
        } catch (\Exception $e) {
            DB::rollBack();
            return back()->withErrors(['error' => $e->getMessage()]);
        }
    }

    private function syncWaitingStockOrders(): void
    {
        PartSale::query()
            ->where('status', 'waiting_stock')
            ->with('details.part')
            ->orderBy('created_at')
            ->get()
            ->each(function (PartSale $sale) {
                $this->tryFulfillWaitingStock($sale);
            });
    }

    private function tryFulfillWaitingStock(PartSale $sale): void
    {
        if ($sale->status !== 'waiting_stock') {
            return;
        }

        $sale->loadMissing('details.part', 'customer');

        $allReserved = true;

        foreach ($sale->details as $detail) {
            $part = $detail->part;
            if (!$part) {
                continue;
            }

            $need = max(0, (int) $detail->quantity - (int) ($detail->reserved_quantity ?? 0));

            if ($need <= 0) {
                continue;
            }

            if ((int) $part->stock >= $need) {
                $beforeStock = (int) $part->stock;
                $afterStock = max(0, $beforeStock - $need);

                $part->update(['stock' => $afterStock]);
                $detail->update([
                    'reserved_quantity' => ((int) ($detail->reserved_quantity ?? 0)) + $need,
                ]);

                PartStockMovement::create([
                    'part_id' => $part->id,
                    'reference_type' => PartSale::class,
                    'reference_id' => $sale->id,
                    'type' => 'out',
                    'qty' => $need,
                    'before_stock' => $beforeStock,
                    'after_stock' => $afterStock,
                    'unit_price' => $detail->unit_price,
                    'notes' => "Reservasi Pesanan #{$sale->sale_number}",
                    'created_by' => Auth::id() ?? $sale->created_by,
                ]);
            } else {
                $allReserved = false;
            }
        }

        $sale->refresh()->load('details');
        foreach ($sale->details as $detail) {
            if ((int) ($detail->reserved_quantity ?? 0) < (int) $detail->quantity) {
                $allReserved = false;
                break;
            }
        }

        if ($allReserved && $sale->status === 'waiting_stock') {
            $sale->update(['status' => 'ready_to_notify']);

            $users = User::query()->get();
            foreach ($users as $user) {
                $user->notify(new PartSaleOrderReadyNotification($sale));
            }
        }
    }

    private function reserveAllDetailsOrFail(PartSale $sale, string $notePrefix): void
    {
        $sale->loadMissing('details.part');

        foreach ($sale->details as $detail) {
            $part = $detail->part;
            if (!$part) {
                throw ValidationException::withMessages(['items' => ['Sparepart tidak ditemukan']]);
            }

            $need = max(0, (int) $detail->quantity - (int) ($detail->reserved_quantity ?? 0));
            if ($need <= 0) {
                continue;
            }

            if ((int) $part->stock < $need) {
                throw ValidationException::withMessages([
                    'items' => ["Stock {$part->name} tidak mencukupi. Tersedia: {$part->stock}, dibutuhkan tambahan: {$need}"],
                ]);
            }

            $beforeStock = (int) $part->stock;
            $afterStock = max(0, $beforeStock - $need);

            $part->update(['stock' => $afterStock]);
            $detail->update(['reserved_quantity' => ((int) ($detail->reserved_quantity ?? 0)) + $need]);

            PartStockMovement::create([
                'part_id' => $part->id,
                'reference_type' => PartSale::class,
                'reference_id' => $sale->id,
                'type' => 'out',
                'qty' => $need,
                'before_stock' => $beforeStock,
                'after_stock' => $afterStock,
                'unit_price' => $detail->unit_price,
                'notes' => $notePrefix,
                'created_by' => Auth::id() ?? $sale->created_by,
            ]);
        }
    }

    private function releaseReservedStock(PartSale $sale, string $notePrefix): void
    {
        $sale->loadMissing('details.part');

        foreach ($sale->details as $detail) {
            $part = $detail->part;
            $reserved = (int) ($detail->reserved_quantity ?? 0);

            if (!$part || $reserved <= 0) {
                continue;
            }

            $beforeStock = (int) $part->stock;
            $afterStock = $beforeStock + $reserved;

            $part->update(['stock' => $afterStock]);
            $detail->update(['reserved_quantity' => 0]);

            PartStockMovement::create([
                'part_id' => $part->id,
                'reference_type' => PartSale::class,
                'reference_id' => $sale->id,
                'type' => 'in',
                'qty' => $reserved,
                'before_stock' => $beforeStock,
                'after_stock' => $afterStock,
                'unit_price' => $detail->unit_price,
                'notes' => $notePrefix,
                'created_by' => Auth::id() ?? $sale->created_by,
            ]);
        }
    }

    public function createFromOrder(Request $request)
    {
        $request->validate([
            'sales_order_id' => 'required|exists:part_sales_orders,id',
        ]);

        return redirect()->route('part-sales.create', [
            'sales_order_id' => $request->sales_order_id
        ]);
    }
}
