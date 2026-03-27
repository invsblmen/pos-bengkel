<?php

namespace App\Http\Controllers;

use App\Events\PartSaleCreated;
use App\Models\BusinessProfile;
use App\Models\CashDenomination;
use App\Models\CashDrawerDenomination;
use App\Models\CashTransaction;
use App\Models\CashTransactionItem;
use App\Models\PartSale;
use App\Models\PartSaleDetail;
use App\Models\PartSalesOrder;
use App\Models\Part;
use App\Models\Customer;
use App\Models\PartStockMovement;
use App\Models\User;
use App\Notifications\PartSaleOrderReadyNotification;
use App\Services\CashChangeSuggestionService;
use App\Services\DiscountTaxService;
use Carbon\Carbon;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;

class PartSaleController extends Controller
{
    protected $discountTaxService;
    protected $cashChangeSuggestionService;

    public function __construct(
        DiscountTaxService $discountTaxService,
        CashChangeSuggestionService $cashChangeSuggestionService
    )
    {
        $this->discountTaxService = $discountTaxService;
        $this->cashChangeSuggestionService = $cashChangeSuggestionService;
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

    public function warranties(Request $request)
    {
        $search = trim((string) $request->input('search', ''));
        $status = (string) $request->input('warranty_status', 'all');
        $expiringIn = (int) $request->input('expiring_in_days', 30);
        $expiringIn = max(1, min($expiringIn, 365));

        $today = now()->startOfDay();
        $expiringDate = (clone $today)->addDays($expiringIn)->endOfDay();

        $query = $this->applyWarrantyFilters(
            PartSaleDetail::query()
                ->with([
                    'part:id,name,part_number',
                    'partSale:id,sale_number,sale_date,customer_id,status,payment_status',
                    'partSale.customer:id,name',
                ]),
            $search,
            $status,
            $today,
            $expiringDate
        );

        $warranties = $query
            ->orderByRaw('CASE WHEN warranty_claimed_at IS NULL THEN 0 ELSE 1 END ASC')
            ->orderBy('warranty_end_date')
            ->paginate(15)
            ->withQueryString();

        $summaryBase = $this->applyWarrantyFilters(
            PartSaleDetail::query(),
            $search,
            'all',
            $today,
            $expiringDate
        );

        $summary = [
            'all' => (clone $summaryBase)->count(),
            'active' => (clone $summaryBase)
                ->whereNull('warranty_claimed_at')
                ->whereDate('warranty_end_date', '>=', $today)
                ->count(),
            'expiring' => (clone $summaryBase)
                ->whereNull('warranty_claimed_at')
                ->whereBetween('warranty_end_date', [$today, $expiringDate])
                ->count(),
            'expired' => (clone $summaryBase)
                ->whereNull('warranty_claimed_at')
                ->whereDate('warranty_end_date', '<', $today)
                ->count(),
            'claimed' => (clone $summaryBase)
                ->whereNotNull('warranty_claimed_at')
                ->count(),
        ];

        return Inertia::render('Dashboard/Parts/Sales/Warranties/Index', [
            'warranties' => $warranties,
            'summary' => $summary,
            'filters' => [
                'search' => $search,
                'warranty_status' => $status,
                'expiring_in_days' => $expiringIn,
            ],
        ]);
    }

    public function exportWarranties(Request $request)
    {
        $search = trim((string) $request->input('search', ''));
        $status = (string) $request->input('warranty_status', 'all');
        $expiringIn = (int) $request->input('expiring_in_days', 30);
        $expiringIn = max(1, min($expiringIn, 365));

        $today = now()->startOfDay();
        $expiringDate = (clone $today)->addDays($expiringIn)->endOfDay();

        $warranties = $this->applyWarrantyFilters(
            PartSaleDetail::query()->with([
                'part:id,name,part_number',
                'partSale:id,sale_number,sale_date,customer_id,status,payment_status',
                'partSale.customer:id,name',
            ]),
            $search,
            $status,
            $today,
            $expiringDate
        )
            ->orderByRaw('CASE WHEN warranty_claimed_at IS NULL THEN 0 ELSE 1 END ASC')
            ->orderBy('warranty_end_date')
            ->get();

        $filename = 'sparepart-warranties-' . now()->format('Y-m-d-His') . '.csv';

        return response()->streamDownload(function () use ($warranties, $expiringIn) {
            $file = fopen('php://output', 'w');

            fputcsv($file, [
                'No Transaksi',
                'Tanggal Transaksi',
                'Pelanggan',
                'Sparepart',
                'Nomor Part',
                'Periode Garansi (Hari)',
                'Mulai Garansi',
                'Akhir Garansi',
                'Status Garansi',
                'Tanggal Klaim',
                'Catatan Klaim',
            ]);

            foreach ($warranties as $item) {
                $statusLabel = $this->resolveWarrantyStatusLabel($item, $expiringIn);

                fputcsv($file, [
                    $item->partSale?->sale_number ?? '-',
                    optional($item->partSale?->sale_date)->format('Y-m-d') ?? ($item->partSale?->sale_date ?? '-'),
                    $item->partSale?->customer?->name ?? '-',
                    $item->part?->name ?? '-',
                    $item->part?->part_number ?? '-',
                    (int) ($item->warranty_period_days ?? 0),
                    optional($item->warranty_start_date)->format('Y-m-d') ?? '-',
                    optional($item->warranty_end_date)->format('Y-m-d') ?? '-',
                    $statusLabel,
                    optional($item->warranty_claimed_at)->format('Y-m-d H:i:s') ?? '-',
                    $item->warranty_claim_notes ?? '-',
                ]);
            }

            fclose($file);
        }, $filename, [
            'Content-Type' => 'text/csv',
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
            'items.*.warranty_period_days' => 'nullable|integer|min:0|max:3650',
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
                $warrantyData = $this->buildWarrantyData($item, $request->sale_date);

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
                    'warranty_period_days' => $warrantyData['warranty_period_days'],
                    'warranty_start_date' => $warrantyData['warranty_start_date'],
                    'warranty_end_date' => $warrantyData['warranty_end_date'],
                    'warranty_claimed_at' => null,
                    'warranty_claim_notes' => null,
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

            event(new PartSaleCreated([
                'id' => $sale->id,
                'sale_number' => $sale->sale_number,
                'status' => $sale->status,
                'payment_status' => $sale->payment_status,
                'grand_total' => $sale->grand_total,
                'created_at' => $sale->created_at?->toISOString(),
            ]));

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
            'cashDenominations' => CashDenomination::query()
                ->with('drawerStock')
                ->where('is_active', true)
                ->orderBy('value')
                ->get()
                ->map(function ($denomination) {
                    return [
                        'id' => $denomination->id,
                        'value' => (int) $denomination->value,
                        'quantity' => (int) ($denomination->drawerStock->quantity ?? 0),
                    ];
                })
                ->values(),
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
            'items.*.warranty_period_days' => 'nullable|integer|min:0|max:3650',
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
                $warrantyData = $this->buildWarrantyData($item, $request->sale_date);

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
                    'warranty_period_days' => $warrantyData['warranty_period_days'],
                    'warranty_start_date' => $warrantyData['warranty_start_date'],
                    'warranty_end_date' => $warrantyData['warranty_end_date'],
                    'warranty_claimed_at' => null,
                    'warranty_claim_notes' => null,
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
        $validated = $request->validate([
            'payment_amount' => 'required|integer|min:1',
            'received_denominations' => 'nullable|array',
            'received_denominations.*.denomination_id' => 'required_with:received_denominations|exists:cash_denominations,id',
            'received_denominations.*.quantity' => 'required_with:received_denominations|integer|min:0',
        ]);

        $paymentAmount = (int) $validated['payment_amount'];
        $remainingBeforePayment = max(0, (int) $partSale->grand_total - (int) $partSale->paid_amount);
        $changeFromThisPayment = max(0, $paymentAmount - $remainingBeforePayment);

        $receivedRows = collect($validated['received_denominations'] ?? [])
            ->map(function ($row) {
                return [
                    'denomination_id' => (int) $row['denomination_id'],
                    'quantity' => (int) $row['quantity'],
                ];
            })
            ->filter(fn ($row) => $row['quantity'] > 0)
            ->values();

        if ($receivedRows->isNotEmpty()) {
            $denominationValues = CashDenomination::query()
                ->whereIn('id', $receivedRows->pluck('denomination_id'))
                ->pluck('value', 'id');

            $receivedTotal = (int) $receivedRows->sum(function ($row) use ($denominationValues) {
                return ((int) ($denominationValues[$row['denomination_id']] ?? 0)) * (int) $row['quantity'];
            });

            if ($receivedTotal !== $paymentAmount) {
                throw ValidationException::withMessages([
                    'payment_amount' => ['Total pecahan uang diterima harus sama dengan jumlah pembayaran.'],
                ]);
            }
        }

        DB::transaction(function () use ($partSale, $paymentAmount, $changeFromThisPayment, $receivedRows, $request) {
            if ($receivedRows->isNotEmpty()) {
                $this->recordCashPaymentWithDenominations(
                    $partSale,
                    $paymentAmount,
                    $changeFromThisPayment,
                    $receivedRows,
                    (int) $request->user()->id
                );
            }

            $newPaidAmount = (int) $partSale->paid_amount + $paymentAmount;

            $partSale->update([
                'paid_amount' => $newPaidAmount,
                'remaining_amount' => max(0, (int) $partSale->grand_total - $newPaidAmount),
                'payment_status' => $newPaidAmount >= (int) $partSale->grand_total ? 'paid' : ($newPaidAmount > 0 ? 'partial' : 'unpaid'),
            ]);
        });

        return back()->with('success', 'Pembayaran berhasil dicatat');
    }

    private function recordCashPaymentWithDenominations(
        PartSale $partSale,
        int $paymentAmount,
        int $changeAmount,
        $receivedRows,
        int $userId
    ): void {
        $receivedRows = collect($receivedRows)->values();

        $denominationValues = CashDenomination::query()
            ->whereIn('id', $receivedRows->pluck('denomination_id'))
            ->pluck('value', 'id')
            ->map(fn ($value) => (int) $value)
            ->toArray();

        $availableByValue = CashDrawerDenomination::query()
            ->join('cash_denominations', 'cash_drawer_denominations.denomination_id', '=', 'cash_denominations.id')
            ->selectRaw('cash_denominations.value as value, cash_drawer_denominations.quantity as quantity')
            ->get()
            ->mapWithKeys(fn ($row) => [(int) $row->value => (int) $row->quantity])
            ->toArray();

        foreach ($receivedRows as $row) {
            $value = (int) ($denominationValues[(int) $row['denomination_id']] ?? 0);
            if ($value <= 0) {
                continue;
            }
            $availableByValue[$value] = (int) ($availableByValue[$value] ?? 0) + (int) $row['quantity'];
        }

        $changeSuggestion = $this->cashChangeSuggestionService->suggest($changeAmount, $availableByValue);
        if ($changeAmount > 0 && !$changeSuggestion['exact']) {
            throw ValidationException::withMessages([
                'payment_amount' => ['Stok kas tidak cukup untuk memberikan kembalian pas.'],
            ]);
        }

        $valueToId = CashDenomination::query()
            ->pluck('id', 'value')
            ->map(fn ($id) => (int) $id)
            ->toArray();

        $receivedTransaction = CashTransaction::create([
            'transaction_type' => 'income',
            'amount' => $paymentAmount,
            'source' => 'part-sale-payment',
            'description' => "Pembayaran cash penjualan {$partSale->sale_number}",
            'meta' => [
                'part_sale_id' => $partSale->id,
                'sale_number' => $partSale->sale_number,
            ],
            'happened_at' => now(),
            'created_by' => $userId,
        ]);

        foreach ($receivedRows as $row) {
            $denominationId = (int) $row['denomination_id'];
            $quantity = (int) $row['quantity'];
            $value = (int) ($denominationValues[$denominationId] ?? 0);
            if ($quantity <= 0 || $value <= 0) {
                continue;
            }

            CashTransactionItem::create([
                'cash_transaction_id' => $receivedTransaction->id,
                'denomination_id' => $denominationId,
                'direction' => 'in',
                'quantity' => $quantity,
                'line_total' => $value * $quantity,
            ]);

            $drawer = CashDrawerDenomination::firstOrCreate(
                ['denomination_id' => $denominationId],
                ['quantity' => 0]
            );
            $drawer->update(['quantity' => (int) $drawer->quantity + $quantity]);
        }

        if ($changeAmount > 0) {
            $changeTransaction = CashTransaction::create([
                'transaction_type' => 'change_given',
                'amount' => $changeAmount,
                'source' => 'part-sale-change',
                'description' => "Kembalian cash penjualan {$partSale->sale_number}",
                'meta' => [
                    'part_sale_id' => $partSale->id,
                    'sale_number' => $partSale->sale_number,
                ],
                'happened_at' => now(),
                'created_by' => $userId,
            ]);

            foreach ($changeSuggestion['items'] as $item) {
                $value = (int) $item['value'];
                $quantity = (int) $item['quantity'];
                $denominationId = (int) ($valueToId[$value] ?? 0);
                if ($denominationId <= 0 || $quantity <= 0) {
                    continue;
                }

                $drawer = CashDrawerDenomination::firstOrCreate(
                    ['denomination_id' => $denominationId],
                    ['quantity' => 0]
                );

                $newQty = (int) $drawer->quantity - $quantity;
                if ($newQty < 0) {
                    throw ValidationException::withMessages([
                        'payment_amount' => ['Stok kas pecahan tidak mencukupi untuk kembalian.'],
                    ]);
                }

                CashTransactionItem::create([
                    'cash_transaction_id' => $changeTransaction->id,
                    'denomination_id' => $denominationId,
                    'direction' => 'out',
                    'quantity' => $quantity,
                    'line_total' => $value * $quantity,
                ]);

                $drawer->update(['quantity' => $newQty]);
            }
        }
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

    public function claimWarranty(Request $request, PartSale $partSale, PartSaleDetail $detail)
    {
        if ((int) $detail->part_sale_id !== (int) $partSale->id) {
            throw ValidationException::withMessages([
                'error' => ['Detail garansi tidak valid untuk transaksi ini.'],
            ]);
        }

        $validated = $request->validate([
            'warranty_claim_notes' => 'nullable|string|max:1000',
        ]);

        if ((int) ($detail->warranty_period_days ?? 0) <= 0 || empty($detail->warranty_end_date)) {
            throw ValidationException::withMessages([
                'error' => ['Item ini tidak memiliki garansi.'],
            ]);
        }

        if (!empty($detail->warranty_claimed_at)) {
            throw ValidationException::withMessages([
                'error' => ['Garansi item ini sudah pernah diklaim.'],
            ]);
        }

        $endDate = Carbon::parse($detail->warranty_end_date)->startOfDay();
        if (now()->startOfDay()->gt($endDate)) {
            throw ValidationException::withMessages([
                'error' => ['Masa garansi item ini sudah berakhir.'],
            ]);
        }

        $detail->update([
            'warranty_claimed_at' => now(),
            'warranty_claim_notes' => $validated['warranty_claim_notes'] ?? null,
        ]);

        return back()->with('success', 'Klaim garansi berhasil dicatat');
    }

    private function applyWarrantyFilters($query, string $search, string $status, Carbon $today, Carbon $expiringDate)
    {
        $query->where('warranty_period_days', '>', 0);

        if ($search !== '') {
            $query->where(function ($q) use ($search) {
                $q->whereHas('part', function ($partQuery) use ($search) {
                    $partQuery->where('name', 'like', '%' . $search . '%')
                        ->orWhere('part_number', 'like', '%' . $search . '%');
                })->orWhereHas('partSale', function ($saleQuery) use ($search) {
                    $saleQuery->where('sale_number', 'like', '%' . $search . '%')
                        ->orWhereHas('customer', function ($customerQuery) use ($search) {
                            $customerQuery->where('name', 'like', '%' . $search . '%');
                        });
                });
            });
        }

        if ($status === 'active') {
            $query->whereNull('warranty_claimed_at')
                ->whereDate('warranty_end_date', '>=', $today);
        } elseif ($status === 'expiring') {
            $query->whereNull('warranty_claimed_at')
                ->whereBetween('warranty_end_date', [$today, $expiringDate]);
        } elseif ($status === 'expired') {
            $query->whereNull('warranty_claimed_at')
                ->whereDate('warranty_end_date', '<', $today);
        } elseif ($status === 'claimed') {
            $query->whereNotNull('warranty_claimed_at');
        }

        return $query;
    }

    private function resolveWarrantyStatusLabel(PartSaleDetail $detail, int $expiringInDays): string
    {
        if (!empty($detail->warranty_claimed_at)) {
            return 'Sudah Diklaim';
        }

        $today = now()->startOfDay();
        $endDate = $detail->warranty_end_date ? Carbon::parse($detail->warranty_end_date)->startOfDay() : null;

        if (!$endDate || $endDate->lt($today)) {
            return 'Expired';
        }

        $threshold = (clone $today)->addDays(max(1, $expiringInDays));
        if ($endDate->lte($threshold)) {
            return 'Akan Expired';
        }

        return 'Aktif';
    }

    private function buildWarrantyData(array $item, string $saleDate): array
    {
        $periodDays = (int) ($item['warranty_period_days'] ?? 0);
        if ($periodDays <= 0) {
            return [
                'warranty_period_days' => 0,
                'warranty_start_date' => null,
                'warranty_end_date' => null,
            ];
        }

        $startDate = Carbon::parse($saleDate)->startOfDay();
        $endDate = (clone $startDate)->addDays($periodDays);

        return [
            'warranty_period_days' => $periodDays,
            'warranty_start_date' => $startDate->toDateString(),
            'warranty_end_date' => $endDate->toDateString(),
        ];
    }
}
