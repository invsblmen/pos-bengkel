<?php

namespace App\Http\Controllers\Apps;

use App\Events\PartPurchaseCreated;
use App\Events\PartPurchaseUpdated;
use App\Http\Controllers\Controller;
use App\Models\BusinessProfile;
use App\Models\CashDenomination;
use App\Models\Part;
use App\Models\PartPurchase;
use App\Models\PartPurchaseDetail;
use App\Models\PartStockMovement;
use App\Models\Supplier;
use App\Models\User;
use App\Notifications\PartPurchasePendingNotification;
use App\Services\DiscountTaxService;
use App\Support\DispatchesBroadcastSafely;
use App\Models\CashDrawerDenomination;
use App\Models\CashTransaction;
use App\Models\CashTransactionItem;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Notification;
use Illuminate\Validation\ValidationException;
use App\Http\Controllers\Concerns\RespondsWithJsonOrRedirect;
use Throwable;

class PartPurchaseController extends Controller
{
    use DispatchesBroadcastSafely;
    use RespondsWithJsonOrRedirect;
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
            'cashDenominations' => $this->getCashDenominations(),
        ]);
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'supplier_id' => 'required|exists:suppliers,id',
            'purchase_date' => 'required|date',
            'expected_delivery_date' => 'nullable|date',
            'notes' => 'nullable|string',
            'payment_method' => 'nullable|in:cash,credit,mixed',
            'applied_amount' => 'nullable|integer|min:0',
            'paid_amount' => 'nullable|integer|min:0',
            'payment_meta' => 'nullable|array',
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
            'transfer_destination' => 'nullable|in:qris,bni,bca,bri,edc_bri,transfer_bni,transfer_bca,transfer_bri',
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
                'payment_method' => $validated['payment_method'] ?? 'cash',
                'paid_amount' => $validated['applied_amount'] ?? $validated['paid_amount'] ?? 0,
                'transfer_destination' => $validated['transfer_destination'] ?? null,
                'payment_meta' => $validated['payment_meta'] ?? null,
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

            $this->dispatchBroadcastSafely(fn () => broadcast(new PartPurchaseCreated($purchase->fresh()->toArray())), PartPurchaseCreated::class);

            $this->notifyPendingPurchase($purchase, 'created');

            return $this->jsonOrRedirect('part-purchases.show', [$purchase->id], 'Purchase created successfully with number: ' . $purchase->purchase_number, $purchase->toArray());
        } catch (\Exception $e) {
            DB::rollBack();
            return $this->errorResponse('Failed to create purchase: ' . $e->getMessage(), ['error' => ['Failed to create purchase: ' . $e->getMessage()]], 422);
        }
    }

    public function show($id)
    {
        $purchase = PartPurchase::with(['supplier', 'details.part.category'])
            ->findOrFail($id);

        return inertia('Dashboard/PartPurchases/Show', [
            'purchase' => $purchase,
            'cashDenominations' => $this->getCashDenominations(),
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
            return $this->jsonOrRedirect('part-purchases.show', [$id], 'Cannot edit purchase with status: ' . $purchase->status, null, 302, 'error');
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
            'cashDenominations' => $this->getCashDenominations(),
        ]);
    }

    public function update(Request $request, $id)
    {
        $purchase = PartPurchase::findOrFail($id);

        // Only allow updating pending or ordered purchases
        if (!in_array($purchase->status, ['pending', 'ordered'])) {
            throw ValidationException::withMessages(['error' => 'Cannot update purchase with status: ' . $purchase->status]);
        }

        $validated = $request->validate([
            'supplier_id' => 'required|exists:suppliers,id',
            'purchase_date' => 'required|date',
            'expected_delivery_date' => 'nullable|date',
            'notes' => 'nullable|string',
            'payment_method' => 'nullable|in:cash,credit,mixed',
            'paid_amount' => 'nullable|integer|min:0',
            'payment_meta' => 'nullable|array',
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
            'transfer_destination' => 'nullable|in:qris,bni,bca,bri,edc_bri,transfer_bni,transfer_bca,transfer_bri',
        ]);

        DB::beginTransaction();
        try {
            // Update purchase header
            $purchase->update([
                'supplier_id' => $validated['supplier_id'],
                'purchase_date' => $validated['purchase_date'],
                'expected_delivery_date' => $validated['expected_delivery_date'],
                'notes' => $validated['notes'],
                'transfer_destination' => $validated['transfer_destination'] ?? $purchase->transfer_destination ?? null,
                'payment_method' => $validated['payment_method'] ?? $purchase->payment_method ?? 'cash',
                'paid_amount' => $validated['applied_amount'] ?? $validated['paid_amount'] ?? $purchase->paid_amount ?? 0,
                'payment_meta' => $validated['payment_meta'] ?? $purchase->payment_meta ?? null,
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

            $this->dispatchBroadcastSafely(fn () => broadcast(new PartPurchaseUpdated($purchase->fresh()->toArray())), PartPurchaseUpdated::class);

            return $this->jsonOrRedirect('part-purchases.show', [$purchase->id], 'Purchase updated successfully', $purchase->toArray());
        } catch (\Exception $e) {
            DB::rollBack();
            return $this->errorResponse('Failed to update purchase: ' . $e->getMessage(), ['error' => ['Failed to update purchase: ' . $e->getMessage()]], 422);
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

            return $this->jsonOrRedirect(null, [], 'Purchase status updated to: ' . $newStatus, $purchase->toArray());
        } catch (\Exception $e) {
            DB::rollBack();
            return $this->errorResponse('Failed to update status: ' . $e->getMessage(), ['error' => ['Failed to update status: ' . $e->getMessage()]], 422);
        }
    }

    public function updatePayment(Request $request, $id)
    {
        $purchase = PartPurchase::findOrFail($id);

        $validated = $request->validate([
            'payment_amount' => 'required|integer|min:1',
            'applied_amount' => 'nullable|integer|min:0',
            'payment_method' => 'nullable|in:cash,credit,mixed',
            'transfer_destination' => 'nullable|in:qris,bni,bca,bri,edc_bri,transfer_bni,transfer_bca,transfer_bri',
            'payment_meta' => 'nullable|array',
            'given_denominations' => 'nullable|array',
            'given_denominations.*.denomination_id' => 'required_with:given_denominations|exists:cash_denominations,id',
            'given_denominations.*.quantity' => 'required_with:given_denominations|integer|min:0',
        ]);

        $paymentAmount = (int) $validated['payment_amount'];
        $paymentMeta = is_array($validated['payment_meta'] ?? null) ? $validated['payment_meta'] : [];

        $paymentState = clone $purchase;
        $paymentState->payment_meta = $paymentMeta;
        $settlementTotal = $paymentState->getPaymentSettlementTotal();
        $remainingBeforePayment = max(0, $settlementTotal - (int) $purchase->paid_amount);

        $appliedAmount = isset($validated['applied_amount'])
            ? max(0, (int) $validated['applied_amount'])
            : min($paymentAmount, $remainingBeforePayment);

        $netPaymentAmount = min($appliedAmount, $remainingBeforePayment);

        $givenRows = collect($validated['given_denominations'] ?? [])
            ->map(fn ($row) => [
                'denomination_id' => (int) ($row['denomination_id'] ?? 0),
                'quantity' => (int) ($row['quantity'] ?? 0),
            ])
            ->filter(fn ($row) => $row['denomination_id'] > 0 && $row['quantity'] > 0)
            ->values();

        if ($givenRows->isNotEmpty()) {
            $denominationValues = CashDenomination::query()
                ->whereIn('id', $givenRows->pluck('denomination_id'))
                ->pluck('value', 'id');

            $givenTotal = (int) $givenRows->sum(function ($row) use ($denominationValues) {
                return ((int) ($denominationValues[$row['denomination_id']] ?? 0)) * (int) $row['quantity'];
            });

            if ($givenTotal !== $paymentAmount) {
                throw ValidationException::withMessages([
                    'payment_amount' => ['Total pecahan uang yang diserahkan harus sama dengan jumlah uang yang dibayarkan.'],
                ]);
            }
        }

        DB::transaction(function () use ($purchase, $paymentAmount, $paymentMeta, $netPaymentAmount, $validated, $givenRows) {
            $purchase->payment_meta = $paymentMeta ?: $purchase->payment_meta;

            if ($givenRows->isNotEmpty()) {
                $changeAmount = max(0, $paymentAmount - $netPaymentAmount);

                $this->recordCashPaymentWithDenominations(
                    $purchase,
                    $netPaymentAmount,
                    $changeAmount,
                    $givenRows,
                    (int) Auth::id()
                );
            } else {
                $this->recordCashPaymentFromMeta($purchase, (int) Auth::id());
            }

            $purchase->paid_amount = (int) $purchase->paid_amount + $netPaymentAmount;
            $purchase->payment_method = $validated['payment_method'] ?? $purchase->payment_method;
            $purchase->transfer_destination = $validated['transfer_destination'] ?? $purchase->transfer_destination;
            $purchase->applyPaymentSettlementStatus()->save();
        });

        return $this->jsonOrRedirect(null, [], 'Pembayaran berhasil dicatat');
    }

    private function recordCashPaymentWithDenominations(
        PartPurchase $purchase,
        int $netPaymentAmount,
        int $changeAmount,
        $givenRows,
        int $userId
    ): void {
        $givenRows = collect($givenRows)->values();

        $denominationValues = CashDenomination::query()
            ->whereIn('id', $givenRows->pluck('denomination_id'))
            ->pluck('value', 'id')
            ->map(fn ($v) => (int) $v)
            ->toArray();

        $givenTotal = (int) $givenRows->sum(function ($row) use ($denominationValues) {
            $denominationId = (int) $row['denomination_id'];
            $value = (int) ($denominationValues[$denominationId] ?? 0);
            return $value * (int) $row['quantity'];
        });

        $outgoingTransaction = CashTransaction::create([
            'transaction_type' => 'expense',
            'amount' => $givenTotal,
            'source' => 'part-purchase-payment',
            'description' => "Pembayaran cash pembelian {$purchase->purchase_number}",
            'meta' => [
                'part_purchase_id' => $purchase->id,
                'purchase_number' => $purchase->purchase_number,
                'net_payment_amount' => $netPaymentAmount,
                'given_total' => $givenTotal,
                'change_amount' => $changeAmount,
            ],
            'happened_at' => now(),
            'created_by' => $userId,
        ]);

        foreach ($givenRows as $row) {
            $denominationId = (int) $row['denomination_id'];
            $quantity = (int) $row['quantity'];
            $value = (int) ($denominationValues[$denominationId] ?? 0);

            if ($quantity <= 0 || $value <= 0) {
                continue;
            }

            $drawer = CashDrawerDenomination::firstOrCreate(
                ['denomination_id' => $denominationId],
                ['quantity' => 0]
            );

            $newQty = (int) $drawer->quantity - $quantity;
            if ($newQty < 0) {
                throw ValidationException::withMessages([
                    'payment_amount' => ['Stok kas pecahan tidak mencukupi untuk pembayaran pembelian.'],
                ]);
            }

            CashTransactionItem::create([
                'cash_transaction_id' => $outgoingTransaction->id,
                'denomination_id' => $denominationId,
                'direction' => 'out',
                'quantity' => $quantity,
                'line_total' => $value * $quantity,
            ]);

            $drawer->update(['quantity' => $newQty]);
        }

        if ($changeAmount <= 0) {
            return;
        }

        $availableByValue = CashDenomination::query()
            ->where('is_active', true)
            ->pluck('value', 'id')
            ->mapWithKeys(fn ($value) => [(int) $value => 999999])
            ->toArray();

        $changeSuggestion = app()->make(\App\Services\CashChangeSuggestionService::class)
            ->suggest($changeAmount, $availableByValue);

        $effectiveChangeAmount = (int) $changeSuggestion['allocated_amount'];
        if ($effectiveChangeAmount !== $changeAmount) {
            throw ValidationException::withMessages([
                'payment_amount' => ['Denominasi kas tidak mencukupi untuk membentuk kembalian pembelian.'],
            ]);
        }

        $valueToId = CashDenomination::query()
            ->pluck('id', 'value')
            ->map(fn ($id) => (int) $id)
            ->toArray();

        $changeTransaction = CashTransaction::create([
            'transaction_type' => 'income',
            'amount' => $effectiveChangeAmount,
            'source' => 'part-purchase-change',
            'description' => "Kembalian cash pembelian {$purchase->purchase_number}",
            'meta' => [
                'part_purchase_id' => $purchase->id,
                'purchase_number' => $purchase->purchase_number,
                'requested_change_amount' => $changeAmount,
                'allocated_change_amount' => $effectiveChangeAmount,
            ],
            'happened_at' => now(),
            'created_by' => $userId,
        ]);

        foreach ($changeSuggestion['items'] as $item) {
            $value = (int) ($item['value'] ?? 0);
            $quantity = (int) ($item['quantity'] ?? 0);
            $denominationId = (int) ($valueToId[$value] ?? 0);

            if ($denominationId <= 0 || $quantity <= 0) {
                continue;
            }

            CashTransactionItem::create([
                'cash_transaction_id' => $changeTransaction->id,
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
    }

    private function recordCashPaymentFromMeta(PartPurchase $purchase, int $userId): void
    {
        $meta = $purchase->payment_meta ?? [];

        if (is_string($meta)) {
            $meta = json_decode($meta, true) ?: [];
        }

        if (!is_array($meta) || !in_array(($meta['payment_method'] ?? null), ['cash', 'mixed'], true)) {
            return;
        }

        $givenRows = collect($meta['cash_breakdown'] ?? $meta['cash_given_breakdown'] ?? [])
            ->map(fn ($row) => [
                'denomination_id' => (int) ($row['denomination_id'] ?? 0),
                'quantity' => (int) ($row['quantity'] ?? 0),
            ])
            ->filter(fn ($row) => $row['denomination_id'] > 0 && $row['quantity'] > 0)
            ->values();

        if ($givenRows->isEmpty()) {
            return;
        }

        $givenTotal = max(0, (int) ($meta['cash_given_total'] ?? 0));
        $changeAmount = max(0, (int) ($meta['cash_change_amount'] ?? $meta['cash_change'] ?? 0));
        $netPaymentAmount = max(0, $givenTotal - $changeAmount);

        if ($givenTotal <= 0 || $netPaymentAmount <= 0) {
            return;
        }

        $this->recordCashPaymentWithDenominations(
            $purchase,
            $netPaymentAmount,
            $changeAmount,
            $givenRows,
            $userId
        );
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

    private function getCashDenominations()
    {
        return CashDenomination::query()
            ->with('drawerStock')
            ->where('is_active', true)
            ->orderBy('value')
            ->get(['id', 'value'])
            ->map(function ($denomination) {
                return [
                    'id' => $denomination->id,
                    'value' => (int) $denomination->value,
                    'quantity' => (int) ($denomination->drawerStock->quantity ?? 0),
                ];
            })
            ->values();
    }

    // Broadcasting for PartPurchase is handled via DispatchesBroadcastSafely trait.
}
