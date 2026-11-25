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
use App\Models\Service;
use App\Models\ServiceOrder;
use App\Models\WarrantyRegistration;
use App\Models\User;
use App\Models\Voucher;
use App\Notifications\PartSaleOrderReadyNotification;
use App\Services\CashChangeSuggestionService;
use App\Services\DiscountTaxService;
use App\Services\FIFOCostingService;
use App\Services\VoucherService;
use App\Services\VoucherApplier;
use App\Services\WarrantyRegistrationService;
use App\Services\WhatsAppMessageService;
use App\Support\DispatchesBroadcastSafely;
use Carbon\Carbon;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;
use App\Http\Controllers\Concerns\RespondsWithJsonOrRedirect;

class PartSaleController extends Controller
{
    use DispatchesBroadcastSafely;
    use RespondsWithJsonOrRedirect;

    protected $discountTaxService;
    protected $cashChangeSuggestionService;
    protected $warrantyRegistrationService;
    protected $voucherService;

    public function __construct(
        DiscountTaxService $discountTaxService,
        CashChangeSuggestionService $cashChangeSuggestionService,
        WarrantyRegistrationService $warrantyRegistrationService,
        VoucherService $voucherService,
        VoucherApplier $voucherApplier
    )
    {
        $this->discountTaxService = $discountTaxService;
        $this->cashChangeSuggestionService = $cashChangeSuggestionService;
        $this->warrantyRegistrationService = $warrantyRegistrationService;
        $this->voucherService = $voucherService;
        $this->voucherApplier = $voucherApplier;
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
        $sourceType = (string) $request->input('source_type', 'all');
        $itemType = (string) $request->input('item_type', 'all');
        $customerId = $request->filled('customer_id') ? (int) $request->input('customer_id') : null;
        $vehicleId = $request->filled('vehicle_id') ? (int) $request->input('vehicle_id') : null;
        $mechanicId = $request->filled('mechanic_id') ? (int) $request->input('mechanic_id') : null;
        $dateFrom = $request->input('date_from');
        $dateTo = $request->input('date_to');
        $expiringIn = (int) $request->input('expiring_in_days', 30);
        $expiringIn = max(1, min($expiringIn, 365));

        $today = now()->startOfDay();
        $expiringDate = (clone $today)->addDays($expiringIn)->endOfDay();

        $query = $this->applyUnifiedWarrantyFilters(
            WarrantyRegistration::query()->with(['customer:id,name', 'vehicle:id,plate_number,brand,model']),
            $search,
            $status,
            $sourceType,
            $itemType,
            $customerId,
            $vehicleId,
            $mechanicId,
            $dateFrom,
            $dateTo,
            $today,
            $expiringDate
        );

        $warranties = $query
            ->orderByRaw('CASE WHEN claimed_at IS NULL THEN 0 ELSE 1 END ASC')
            ->orderBy('warranty_end_date')
            ->paginate(15)
            ->withQueryString();

        $sourceIdsByType = [
            PartSale::class => [],
            ServiceOrder::class => [],
        ];

        foreach ($warranties->items() as $registration) {
            if (isset($sourceIdsByType[$registration->source_type])) {
                $sourceIdsByType[$registration->source_type][] = (int) $registration->source_id;
            }
        }

        $partSaleMap = PartSale::query()
            ->whereIn('id', array_values(array_unique($sourceIdsByType[PartSale::class])))
            ->with('customer:id,name')
            ->get(['id', 'sale_number', 'sale_date', 'customer_id'])
            ->keyBy('id');

        $serviceOrderMap = ServiceOrder::query()
            ->whereIn('id', array_values(array_unique($sourceIdsByType[ServiceOrder::class])))
            ->with(['customer:id,name', 'mechanic:id,name'])
            ->get(['id', 'order_number', 'customer_id', 'vehicle_id', 'mechanic_id', 'created_at'])
            ->keyBy('id');

        $warranties->getCollection()->transform(function (WarrantyRegistration $registration) use ($partSaleMap, $serviceOrderMap, $expiringIn) {
            $source = null;
            if ($registration->source_type === PartSale::class) {
                $source = $partSaleMap->get((int) $registration->source_id);
            } elseif ($registration->source_type === ServiceOrder::class) {
                $source = $serviceOrderMap->get((int) $registration->source_id);
            }

            return [
                'id' => $registration->id,
                'source_type' => $registration->source_type,
                'source_id' => (int) $registration->source_id,
                'source_detail_id' => (int) $registration->source_detail_id,
                'reference_number' => $registration->source_type === PartSale::class
                    ? ($source->sale_number ?? '-')
                    : ($source->order_number ?? '-'),
                'source_date' => $registration->source_type === PartSale::class
                    ? optional($source?->sale_date)?->toDateString()
                    : optional($source?->created_at)?->toDateString(),
                'source_label' => $registration->source_type === PartSale::class ? 'Part Sale' : 'Service Order',
                'customer_name' => $registration->customer?->name
                    ?? $source?->customer?->name
                    ?? '-',
                'vehicle_label' => $registration->vehicle
                    ? trim(($registration->vehicle->plate_number ?? '-') . ' ' . ($registration->vehicle->brand ?? '') . ' ' . ($registration->vehicle->model ?? ''))
                    : '-',
                'mechanic_name' => $registration->source_type === ServiceOrder::class
                    ? ($source?->mechanic?->name ?? '-')
                    : '-',
                'item_name' => $registration->metadata['item_name']
                    ?? $registration->metadata['part_name']
                    ?? '-',
                'item_number' => $registration->metadata['part_number'] ?? '-',
                'item_type' => $registration->warrantable_type === Service::class ? 'service' : 'part',
                'warranty_period_days' => (int) $registration->warranty_period_days,
                'warranty_start_date' => optional($registration->warranty_start_date)?->toDateString(),
                'warranty_end_date' => optional($registration->warranty_end_date)?->toDateString(),
                'claimed_at' => optional($registration->claimed_at)?->toISOString(),
                'claim_notes' => $registration->claim_notes,
                'resolved_status' => $this->resolveUnifiedWarrantyStatusLabel($registration, $expiringIn),
            ];
        });

        $summaryBase = $this->applyUnifiedWarrantyFilters(
            WarrantyRegistration::query(),
            $search,
            'all',
            $sourceType,
            $itemType,
            $customerId,
            $vehicleId,
            $mechanicId,
            $dateFrom,
            $dateTo,
            $today,
            $expiringDate
        );

        $summary = [
            'all' => (clone $summaryBase)->count(),
            'active' => (clone $summaryBase)
                ->whereNull('claimed_at')
                ->whereDate('warranty_end_date', '>=', $today)
                ->count(),
            'expiring' => (clone $summaryBase)
                ->whereNull('claimed_at')
                ->whereBetween('warranty_end_date', [$today, $expiringDate])
                ->count(),
            'expired' => (clone $summaryBase)
                ->whereNull('claimed_at')
                ->whereDate('warranty_end_date', '<', $today)
                ->count(),
            'claimed' => (clone $summaryBase)
                ->whereNotNull('claimed_at')
                ->count(),
        ];

        return Inertia::render('Dashboard/Parts/Sales/Warranties/Index', [
            'warranties' => $warranties,
            'summary' => $summary,
            'filters' => [
                'search' => $search,
                'warranty_status' => $status,
                'source_type' => $sourceType,
                'item_type' => $itemType,
                'customer_id' => $customerId,
                'vehicle_id' => $vehicleId,
                'mechanic_id' => $mechanicId,
                'date_from' => $dateFrom,
                'date_to' => $dateTo,
                'expiring_in_days' => $expiringIn,
            ],
            'customers' => Customer::orderBy('name')->get(['id', 'name']),
            'vehicles' => \App\Models\Vehicle::orderBy('plate_number')->get(['id', 'plate_number', 'brand', 'model']),
            'mechanics' => \App\Models\Mechanic::orderBy('name')->get(['id', 'name']),
        ]);
    }

    public function exportWarranties(Request $request)
    {
        $search = trim((string) $request->input('search', ''));
        $status = (string) $request->input('warranty_status', 'all');
        $sourceType = (string) $request->input('source_type', 'all');
        $itemType = (string) $request->input('item_type', 'all');
        $customerId = $request->filled('customer_id') ? (int) $request->input('customer_id') : null;
        $vehicleId = $request->filled('vehicle_id') ? (int) $request->input('vehicle_id') : null;
        $mechanicId = $request->filled('mechanic_id') ? (int) $request->input('mechanic_id') : null;
        $dateFrom = $request->input('date_from');
        $dateTo = $request->input('date_to');
        $expiringIn = (int) $request->input('expiring_in_days', 30);
        $expiringIn = max(1, min($expiringIn, 365));

        $today = now()->startOfDay();
        $expiringDate = (clone $today)->addDays($expiringIn)->endOfDay();

        $warranties = $this->applyUnifiedWarrantyFilters(
            WarrantyRegistration::query()->with(['customer:id,name', 'vehicle:id,plate_number,brand,model']),
            $search,
            $status,
            $sourceType,
            $itemType,
            $customerId,
            $vehicleId,
            $mechanicId,
            $dateFrom,
            $dateTo,
            $today,
            $expiringDate
        )
            ->orderByRaw('CASE WHEN claimed_at IS NULL THEN 0 ELSE 1 END ASC')
            ->orderBy('warranty_end_date')
            ->get();

        $sourceIdsByType = [
            PartSale::class => [],
            ServiceOrder::class => [],
        ];

        foreach ($warranties as $registration) {
            if (isset($sourceIdsByType[$registration->source_type])) {
                $sourceIdsByType[$registration->source_type][] = (int) $registration->source_id;
            }
        }

        $partSaleMap = PartSale::query()
            ->whereIn('id', array_values(array_unique($sourceIdsByType[PartSale::class])))
            ->with('customer:id,name')
            ->get(['id', 'sale_number', 'sale_date', 'customer_id'])
            ->keyBy('id');

        $serviceOrderMap = ServiceOrder::query()
            ->whereIn('id', array_values(array_unique($sourceIdsByType[ServiceOrder::class])))
            ->with(['customer:id,name', 'mechanic:id,name'])
            ->get(['id', 'order_number', 'customer_id', 'mechanic_id', 'created_at'])
            ->keyBy('id');

        $filename = 'unified-warranties-' . now()->format('Y-m-d-His') . '.csv';

        return response()->streamDownload(function () use ($warranties, $expiringIn, $partSaleMap, $serviceOrderMap) {
            $file = fopen('php://output', 'w');

            fputcsv($file, [
                'Sumber',
                'No Referensi',
                'Tanggal Referensi',
                'Pelanggan',
                'Kendaraan',
                'Mekanik',
                'Item',
                'Tipe Item',
                'Periode Garansi (Hari)',
                'Mulai Garansi',
                'Akhir Garansi',
                'Status Garansi',
                'Tanggal Klaim',
                'Catatan Klaim',
            ]);

            foreach ($warranties as $registration) {
                $source = $registration->source_type === PartSale::class
                    ? $partSaleMap->get((int) $registration->source_id)
                    : $serviceOrderMap->get((int) $registration->source_id);

                $statusLabel = $this->resolveUnifiedWarrantyStatusLabel($registration, $expiringIn);
                $sourceLabel = $registration->source_type === PartSale::class ? 'Part Sale' : 'Service Order';
                $referenceNumber = $registration->source_type === PartSale::class
                    ? ($source?->sale_number ?? '-')
                    : ($source?->order_number ?? '-');
                $referenceDate = $registration->source_type === PartSale::class
                    ? (optional($source?->sale_date)->format('Y-m-d') ?? '-')
                    : (optional($source?->created_at)->format('Y-m-d') ?? '-');
                $customerName = $registration->customer?->name ?? $source?->customer?->name ?? '-';
                $vehicleLabel = $registration->vehicle
                    ? trim(($registration->vehicle->plate_number ?? '-') . ' ' . ($registration->vehicle->brand ?? '') . ' ' . ($registration->vehicle->model ?? ''))
                    : '-';
                $mechanicName = $registration->source_type === ServiceOrder::class
                    ? ($source?->mechanic?->name ?? '-')
                    : '-';
                $itemName = $registration->metadata['item_name'] ?? $registration->metadata['part_name'] ?? '-';
                $itemType = $registration->warrantable_type === Service::class ? 'Service' : 'Sparepart';

                fputcsv($file, [
                    $sourceLabel,
                    $referenceNumber,
                    $referenceDate,
                    $customerName,
                    $vehicleLabel,
                    $mechanicName,
                    $itemName,
                    $itemType,
                    (int) ($registration->warranty_period_days ?? 0),
                    optional($registration->warranty_start_date)->format('Y-m-d') ?? '-',
                    optional($registration->warranty_end_date)->format('Y-m-d') ?? '-',
                    $statusLabel,
                    optional($registration->claimed_at)->format('Y-m-d H:i:s') ?? '-',
                    $registration->claim_notes ?? '-',
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
            'cashDenominations' => $this->getCashDenominations(),
            'availableVouchers' => Voucher::query()
                ->where('is_active', true)
                ->orderBy('code')
                ->get(['id', 'code', 'name', 'scope']),
        ]);
    }

    public function store(Request $request)
    {
        $request->validate([
            'customer_id' => 'required|exists:customers,id',
            'sale_date' => 'required|date',
            'payment_method' => 'nullable|in:cash,credit,mixed',
            'payment_meta' => 'nullable|array',
            'transfer_destination' => 'nullable|in:qris,bni,bca,bri,edc_bri,transfer_bni,transfer_bca,transfer_bri',
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
            'voucher_code' => 'nullable|string|max:50',
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
                'payment_method' => $request->payment_method ?? 'cash',
                'discount_type' => $request->discount_type ?? 'none',
                'discount_value' => $request->discount_value ?? 0,
                'tax_type' => $request->tax_type ?? 'none',
                'tax_value' => $request->tax_value ?? 0,
                'paid_amount' => $request->paid_amount ?? 0,
                'transfer_destination' => $request->transfer_destination ?? null,
                'payment_meta' => $request->payment_meta ?? null,
                'notes' => $request->notes,
                'status' => $status,
                'created_by' => Auth::id(),
            ]);

            // Create sale details and update stock
            $partIdsForVoucher = [];
            $partCategoryIdsForVoucher = [];
            $subtotalForVoucher = 0;

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
                $subtotalForVoucher += max(0, (int) $finalAmount);
                $partIdsForVoucher[] = (int) $part->id;
                if (!empty($part->part_category_id)) {
                    $partCategoryIdsForVoucher[] = (int) $part->part_category_id;
                }
                $warrantyData = $this->buildWarrantyData($item, $request->sale_date, $part);

                // Create detail
                $detail = PartSaleDetail::create([
                    'part_sale_id' => $sale->id,
                    'part_id' => $part->id,
                    'quantity' => $item['quantity'],
                    'reserved_quantity' => 0,
                    'unit_price' => $item['unit_price'],
                    'subtotal' => $subtotal,
                    'discount_type' => $discountType,
                    'discount_value' => $discountValue,
                    'discount_amount' => $discountAmount,
                    'final_amount' => $finalAmount,
                    'cost_price' => 0,
                    'selling_price' => $item['quantity'] > 0 ? (int) round($finalAmount / $item['quantity']) : $item['unit_price'],
                    'warranty_period_days' => $warrantyData['warranty_period_days'],
                    'warranty_start_date' => $warrantyData['warranty_start_date'],
                    'warranty_end_date' => $warrantyData['warranty_end_date'],
                    'warranty_claimed_at' => null,
                    'warranty_claim_notes' => null,
                ]);

                // Reserve stock based on FIFO batches after the detail exists.
                if (in_array($status, ['confirmed', 'ready_to_notify', 'waiting_pickup', 'completed'], true)) {
                    $pricing = FIFOCostingService::consumeStock(
                        $part,
                        (int) $item['quantity'],
                        PartSale::class,
                        (int) $sale->id,
                        "Penjualan #{$sale->sale_number}",
                        Auth::id(),
                        $detail,
                        null,
                        (int) $item['unit_price']
                    );
                    $detail->update([
                        'reserved_quantity' => (int) $item['quantity'],
                        'source_purchase_detail_id' => $pricing['source_purchase_detail_id'],
                        'cost_price' => $pricing['cost_price'],
                    ]);
                } elseif ($status === 'waiting_stock' && (int) $part->stock >= (int) $item['quantity']) {
                    try {
                        $pricing = FIFOCostingService::consumeStock(
                            $part,
                            (int) $item['quantity'],
                            PartSale::class,
                            (int) $sale->id,
                            "Reservasi Pesanan #{$sale->sale_number}",
                            Auth::id(),
                            $detail,
                            null,
                            (int) $item['unit_price']
                        );
                        $detail->update([
                            'reserved_quantity' => (int) $item['quantity'],
                            'source_purchase_detail_id' => $pricing['source_purchase_detail_id'],
                            'cost_price' => $pricing['cost_price'],
                        ]);
                    } catch (ValidationException $exception) {
                        // Keep the order waiting; stock may be manually corrected or received later.
                    }
                }

                $this->warrantyRegistrationService->registerFromPartSaleDetail($sale, $detail, $part);

            }

            $this->voucherApplier->applyToPartSale($sale, $request->voucher_code ?? null);

            $this->recordCashPaymentFromMeta($sale, (int) (Auth::id() ?? 0));

            if ($sale->status === 'waiting_stock') {
                $this->tryFulfillWaitingStock($sale);
            }

            // If fulfilling a sales order, update SO status
            if ($request->filled('part_sales_order_id')) {
                $salesOrder = PartSalesOrder::findOrFail($request->part_sales_order_id);
                $salesOrder->update(['status' => 'fulfilled']);
            }

            DB::commit();

            $this->dispatchBroadcastSafely(
                fn () => event(new PartSaleCreated([
                    'id' => $sale->id,
                    'sale_number' => $sale->sale_number,
                    'status' => $sale->status,
                    'payment_status' => $sale->payment_status,
                    'grand_total' => $sale->grand_total,
                    'created_at' => $sale->created_at?->toISOString(),
                ])),
                'PartSaleCreated'
            );

            return $this->jsonOrRedirect('part-sales.show', [$sale->id], 'Penjualan berhasil dibuat', $sale, 201);

        } catch (\Exception $e) {
            DB::rollBack();
            return $this->errorResponse('Gagal membuat penjualan: ' . $e->getMessage(), ['error' => [$e->getMessage()]], 500);
        }
    }

    public function show(Request $request, PartSale $partSale)
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

    public function print(Request $request, PartSale $partSale)
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
            throw ValidationException::withMessages(['error' => 'Hanya penjualan draft yang bisa diedit']);
        }

        $partSale->load('details.part');
        $customers = Customer::orderBy('name')->get();
        $parts = Part::orderBy('name')->get();

        return Inertia::render('Dashboard/Parts/Sales/Edit', [
            'sale' => $partSale,
            'customers' => $customers,
            'parts' => $parts,
            'cashDenominations' => $this->getCashDenominations(),
            'availableVouchers' => Voucher::query()
                ->where('is_active', true)
                ->orderBy('code')
                ->get(['id', 'code', 'name', 'scope']),
        ]);
    }

    public function update(Request $request, PartSale $partSale)
    {
        // Only allow updating draft sales
        if ($partSale->status !== 'draft') {
            throw ValidationException::withMessages(['error' => 'Hanya penjualan draft yang bisa diupdate']);
        }

        $request->validate([
            'customer_id' => 'required|exists:customers,id',
            'sale_date' => 'required|date',
            'payment_method' => 'nullable|in:cash,credit,mixed',
            'payment_meta' => 'nullable|array',
            'transfer_destination' => 'nullable|in:qris,bni,bca,bri,edc_bri,transfer_bni,transfer_bca,transfer_bri',
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
            'voucher_code' => 'nullable|string|max:50',
        ]);

        DB::beginTransaction();
        try {
            $this->warrantyRegistrationService->removeByPartSale($partSale->id);
            $this->voucherService->clearUsageBySource(PartSale::class, (int) $partSale->id);

            // Delete old details
            $partSale->details()->delete();

            // Update sale
            $status = $request->status ?? $partSale->status;
            $partSale->update([
                'customer_id' => $request->customer_id,
                'sale_date' => $request->sale_date,
                'transfer_destination' => $request->transfer_destination ?? $partSale->transfer_destination ?? null,
                'payment_method' => $request->payment_method ?? $partSale->payment_method ?? 'cash',
                'discount_type' => $request->discount_type ?? 'none',
                'discount_value' => $request->discount_value ?? 0,
                'tax_type' => $request->tax_type ?? 'none',
                'tax_value' => $request->tax_value ?? 0,
                'paid_amount' => $request->paid_amount ?? $partSale->paid_amount,
                'payment_meta' => $request->payment_meta ?? $partSale->payment_meta ?? null,
                'status' => $status,
                'notes' => $request->notes,
            ]);

            // Create new details
            $partIdsForVoucher = [];
            $partCategoryIdsForVoucher = [];
            $subtotalForVoucher = 0;

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
                $subtotalForVoucher += max(0, (int) $finalAmount);
                $part = Part::find($item['part_id']);
                if ($part) {
                    $partIdsForVoucher[] = (int) $part->id;
                    if (!empty($part->part_category_id)) {
                        $partCategoryIdsForVoucher[] = (int) $part->part_category_id;
                    }
                }
                $warrantyData = $this->buildWarrantyData($item, $request->sale_date, $part);

                $detail = PartSaleDetail::create([
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
                    'cost_price' => 0,
                    'selling_price' => $item['quantity'] > 0 ? (int) round($finalAmount / $item['quantity']) : $item['unit_price'],
                    'warranty_period_days' => $warrantyData['warranty_period_days'],
                    'warranty_start_date' => $warrantyData['warranty_start_date'],
                    'warranty_end_date' => $warrantyData['warranty_end_date'],
                    'warranty_claimed_at' => null,
                    'warranty_claim_notes' => null,
                ]);

                $this->warrantyRegistrationService->registerFromPartSaleDetail($partSale, $detail, $part);
            }

            $this->voucherApplier->applyToPartSale($partSale, $request->voucher_code ?? null);

            if (in_array($status, ['confirmed', 'ready_to_notify', 'waiting_pickup', 'completed'], true)) {
                $this->reserveAllDetailsOrFail($partSale, "Konfirmasi Penjualan #{$partSale->sale_number}");
            } elseif ($status === 'waiting_stock') {
                $this->tryFulfillWaitingStock($partSale);
            }

            DB::commit();

            return $this->jsonOrRedirect('part-sales.show', [$partSale->id], 'Penjualan berhasil diupdate', $partSale);

        } catch (\Exception $e) {
            DB::rollBack();
            return $this->errorResponse('Gagal mengupdate penjualan: ' . $e->getMessage(), ['error' => [$e->getMessage()]], 500);
        }
    }

    public function destroy(Request $request, PartSale $partSale)
    {
        // Only allow deleting draft sales
        if ($partSale->status !== 'draft') {
            throw ValidationException::withMessages(['error' => 'Hanya penjualan draft yang bisa dihapus']);
        }

        DB::beginTransaction();
        try {
            $this->warrantyRegistrationService->removeByPartSale($partSale->id);
            $this->voucherService->clearUsageBySource(PartSale::class, (int) $partSale->id);

            $partSale->details()->delete();
            $partSale->delete();

            DB::commit();

            return $this->jsonOrRedirect('part-sales.index', [], 'Penjualan berhasil dihapus');

        } catch (\Exception $e) {
            DB::rollBack();
            return $this->errorResponse('Gagal menghapus penjualan: ' . $e->getMessage(), ['error' => [$e->getMessage()]], 500);
        }
    }

    public function updatePayment(Request $request, PartSale $partSale)
    {
        $validated = $request->validate([
            'payment_amount' => 'required|integer|min:1',
            'applied_amount' => 'nullable|integer|min:0',
            'payment_method' => 'nullable|in:cash,credit,mixed',
            'transfer_destination' => 'nullable|in:qris,bni,bca,bri,edc_bri,transfer_bni,transfer_bca,transfer_bri',
            'payment_meta' => 'nullable|array',
            'received_denominations' => 'nullable|array',
            'received_denominations.*.denomination_id' => 'required_with:received_denominations|exists:cash_denominations,id',
            'received_denominations.*.quantity' => 'required_with:received_denominations|integer|min:0',
        ]);

        $paymentAmount = (int) $validated['payment_amount'];
        $paymentMeta = is_array($validated['payment_meta'] ?? null) ? $validated['payment_meta'] : [];

        $paymentState = clone $partSale;
        $paymentState->payment_meta = $paymentMeta;
        $settlementTotal = $paymentState->getPaymentSettlementTotal();
        $remainingBeforePayment = max(0, $settlementTotal - (int) $partSale->paid_amount);
        $appliedAmount = isset($validated['applied_amount'])
            ? max(0, (int) $validated['applied_amount'])
            : min($paymentAmount, $remainingBeforePayment);
        $netPaymentAmount = min($appliedAmount, $remainingBeforePayment);
        $changeFromThisPayment = max(0, $paymentAmount - $appliedAmount);

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

        DB::transaction(function () use ($partSale, $paymentAmount, $paymentMeta, $netPaymentAmount, $changeFromThisPayment, $receivedRows, $request, $validated) {
            if ($receivedRows->isNotEmpty()) {
                $this->recordCashPaymentWithDenominations(
                    $partSale,
                    $paymentAmount,
                    $changeFromThisPayment,
                    $receivedRows,
                    (int) $request->user()->id
                );
            }

            $newPaidAmount = (int) $partSale->paid_amount + $netPaymentAmount;

            $partSale->paid_amount = $newPaidAmount;
            $partSale->payment_method = $validated['payment_method'] ?? $partSale->payment_method;
            $partSale->transfer_destination = $validated['transfer_destination'] ?? $partSale->transfer_destination;
            $partSale->payment_meta = $paymentMeta ?: $partSale->payment_meta;
            $partSale->applyPaymentSettlementStatus()->save();
        });

        return $this->jsonOrRedirect(null, [], 'Pembayaran berhasil dicatat');
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

        $receivedTotal = (int) $receivedRows->sum(function ($row) use ($denominationValues) {
            $denominationId = (int) $row['denomination_id'];
            $value = (int) ($denominationValues[$denominationId] ?? 0);

            return $value * (int) $row['quantity'];
        });

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
        $effectiveChangeAmount = (int) $changeSuggestion['allocated_amount'];
        $changeShortage = max(0, $changeAmount - $effectiveChangeAmount);

        $valueToId = CashDenomination::query()
            ->pluck('id', 'value')
            ->map(fn ($id) => (int) $id)
            ->toArray();

        $receivedTransaction = CashTransaction::create([
            'transaction_type' => 'income',
            'amount' => $receivedTotal,
            'source' => 'part-sale-payment',
            'description' => "Pembayaran cash penjualan {$partSale->sale_number}",
            'meta' => [
                'part_sale_id' => $partSale->id,
                'sale_number' => $partSale->sale_number,
                'net_payment_amount' => $paymentAmount,
                'received_total' => $receivedTotal,
                'change_amount' => $changeAmount,
                'change_shortage' => $changeShortage,
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

        if ($effectiveChangeAmount > 0) {
            $changeTransaction = CashTransaction::create([
                'transaction_type' => 'change_given',
                'amount' => $effectiveChangeAmount,
                'source' => 'part-sale-change',
                'description' => "Kembalian cash penjualan {$partSale->sale_number}",
                'meta' => [
                    'part_sale_id' => $partSale->id,
                    'sale_number' => $partSale->sale_number,
                    'requested_change_amount' => $changeAmount,
                    'allocated_change_amount' => $effectiveChangeAmount,
                    'change_shortage' => $changeShortage,
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

    private function recordCashPaymentFromMeta(PartSale $partSale, int $userId): void
    {
        $meta = $partSale->payment_meta ?? [];

        if (is_string($meta)) {
            $meta = json_decode($meta, true) ?: [];
        }

        if (!is_array($meta) || !in_array(($meta['payment_method'] ?? null), ['cash', 'mixed'], true)) {
            return;
        }

        $receivedRows = collect($meta['cash_breakdown'] ?? [])
            ->map(fn ($row) => [
                'denomination_id' => (int) ($row['denomination_id'] ?? 0),
                'quantity' => (int) ($row['quantity'] ?? 0),
            ])
            ->filter(fn ($row) => $row['denomination_id'] > 0 && $row['quantity'] > 0)
            ->values();

        if ($receivedRows->isEmpty()) {
            return;
        }

        $cashDueAmount = max(0, (int) ($meta['cash_due_amount'] ?? 0));
        $changeAmount = max(0, (int) ($meta['cash_change_amount'] ?? 0));

        if ($cashDueAmount <= 0) {
            return;
        }

        $this->recordCashPaymentWithDenominations(
            $partSale,
            $cashDueAmount,
            $changeAmount,
            $receivedRows,
            $userId
        );
    }

    public function updateStatus(Request $request, PartSale $partSale)
    {
        $request->validate([
            'status' => 'required|in:draft,confirmed,waiting_stock,ready_to_notify,waiting_pickup,completed,cancelled',
        ]);

        $newStatus = $request->status;
        $currentStatus = $partSale->status;

        if ($newStatus === $currentStatus) {
            return $this->jsonOrRedirect(null, [], 'Status tidak berubah');
        }

        if (in_array($currentStatus, ['completed', 'cancelled'], true)) {
            throw ValidationException::withMessages(['error' => 'Status sudah final dan tidak bisa diubah']);
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
            return $this->jsonOrRedirect('part-sales.show', [$partSale->id], 'Status penjualan berhasil diperbarui', $partSale);
        } catch (\Exception $e) {
            DB::rollBack();
            return $this->errorResponse('Gagal memperbarui status: ' . $e->getMessage(), ['error' => [$e->getMessage()]], 500);
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
                try {
                    $pricing = FIFOCostingService::consumeStock(
                        $part,
                        $need,
                        PartSale::class,
                        (int) $sale->id,
                        "Reservasi Pesanan #{$sale->sale_number}",
                        Auth::id() ?? $sale->created_by,
                        $detail,
                        null,
                        (int) $detail->unit_price
                    );

                    $detail->update([
                        'reserved_quantity' => ((int) ($detail->reserved_quantity ?? 0)) + $need,
                        'source_purchase_detail_id' => $detail->source_purchase_detail_id ?: $pricing['source_purchase_detail_id'],
                        'cost_price' => $pricing['cost_price'] ?: $detail->cost_price,
                    ]);
                } catch (ValidationException $exception) {
                    $allReserved = false;
                }
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

            $this->notifyCustomerPartSaleReady($sale);
        }
    }

    /**
     * Antrekan WhatsApp "pesanan siap" ke konsumen. Dijalankan otomatis
     * saat penjualan menjadi ready_to_notify; kegagalan apa pun hanya
     * dicatat di log agar tidak menggagalkan pemuatan halaman penjualan.
     */
    private function notifyCustomerPartSaleReady(PartSale $sale): void
    {
        try {
            if (!config('whatsapp.enabled')) {
                return;
            }

            if (!config('whatsapp.notifications.part_sale_order_ready', true)) {
                return;
            }

            $sale->loadMissing('details.part', 'customer');

            $outbound = app(WhatsAppMessageService::class)->sendPartSaleReadyNotification($sale);

            if ($outbound && config('whatsapp.notifications.part_sale_auto_waiting_pickup', true)) {
                $sale->update(['status' => 'waiting_pickup']);
            }
        } catch (\Throwable $e) {
            Log::warning('Gagal mengirim notifikasi WhatsApp pesanan siap.', [
                'part_sale_id' => $sale->id,
                'sale_number' => $sale->sale_number,
                'error' => $e->getMessage(),
            ]);
        }
    }

    /**
     * Kirim/ulang WhatsApp "pesanan siap" secara manual dari halaman
     * detail penjualan. Meniru ServiceOrderController::sendWhatsAppSummary.
     */
    public function sendWhatsAppReadyNotification($id, WhatsAppMessageService $whatsAppMessageService)
    {
        $sale = PartSale::with('customer', 'details.part')->findOrFail($id);

        $outbound = $whatsAppMessageService->sendPartSaleReadyNotification($sale);

        if (!$outbound) {
            return $this->errorResponse('Pelanggan belum memiliki nomor WhatsApp yang valid.', ['phone' => ['Nomor pelanggan kosong.']], 422);
        }

        if ($sale->status === 'ready_to_notify' && config('whatsapp.notifications.part_sale_auto_waiting_pickup', true)) {
            $sale->update(['status' => 'waiting_pickup']);
        }

        return $this->jsonOrRedirect('part-sales.show', [$sale->id], 'Pesan WhatsApp berhasil di-queue ke konsumen.');
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

            $pricing = FIFOCostingService::consumeStock(
                $part,
                $need,
                PartSale::class,
                (int) $sale->id,
                $notePrefix,
                Auth::id() ?? $sale->created_by,
                $detail,
                null,
                (int) $detail->unit_price
            );

            $detail->update([
                'reserved_quantity' => ((int) ($detail->reserved_quantity ?? 0)) + $need,
                'source_purchase_detail_id' => $detail->source_purchase_detail_id ?: $pricing['source_purchase_detail_id'],
                'cost_price' => $pricing['cost_price'] ?: $detail->cost_price,
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

            FIFOCostingService::releaseStockForReference(
                PartSale::class,
                (int) $sale->id,
                $notePrefix,
                Auth::id() ?? $sale->created_by,
                (int) $detail->id
            );
            $detail->update(['reserved_quantity' => 0]);
        }
    }

    public function createFromOrder(Request $request)
    {
        $request->validate([
            'sales_order_id' => 'required|exists:part_sales_orders,id',
        ]);

        return $this->jsonOrRedirect('part-sales.create', ['sales_order_id' => $request->sales_order_id]);
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

        $this->warrantyRegistrationService->markClaimedFromPartSaleDetail($detail, Auth::id());

        return $this->jsonOrRedirect(null, [], 'Klaim garansi berhasil dicatat');
    }

    private function applyUnifiedWarrantyFilters(
        $query,
        string $search,
        string $status,
        string $sourceType,
        string $itemType,
        ?int $customerId,
        ?int $vehicleId,
        ?int $mechanicId,
        ?string $dateFrom,
        ?string $dateTo,
        Carbon $today,
        Carbon $expiringDate
    )
    {
        $query->where('warranty_period_days', '>', 0);

        if ($sourceType === 'part_sale') {
            $query->where('source_type', PartSale::class);
        } elseif ($sourceType === 'service_order') {
            $query->where('source_type', ServiceOrder::class);
        }

        if ($itemType === 'part') {
            $query->where('warrantable_type', Part::class);
        } elseif ($itemType === 'service') {
            $query->where('warrantable_type', Service::class);
        }

        if ($customerId) {
            $query->where('customer_id', $customerId);
        }

        if ($vehicleId) {
            $query->where('vehicle_id', $vehicleId);
        }

        if ($mechanicId) {
            $serviceOrderIds = ServiceOrder::query()
                ->where('mechanic_id', $mechanicId)
                ->pluck('id');

            $query->where('source_type', ServiceOrder::class)
                ->whereIn('source_id', $serviceOrderIds);
        }

        if (!empty($dateFrom)) {
            $query->whereDate('warranty_start_date', '>=', $dateFrom);
        }

        if (!empty($dateTo)) {
            $query->whereDate('warranty_start_date', '<=', $dateTo);
        }

        if ($search !== '') {
            $query->where(function ($q) use ($search) {
                $q->where('metadata->item_name', 'like', '%' . $search . '%')
                    ->orWhere('metadata->part_name', 'like', '%' . $search . '%')
                    ->orWhere('metadata->part_number', 'like', '%' . $search . '%')
                    ->orWhere('metadata->part_sale_number', 'like', '%' . $search . '%')
                    ->orWhere('metadata->service_order_number', 'like', '%' . $search . '%')
                    ->orWhereHas('customer', function ($customerQuery) use ($search) {
                        $customerQuery->where('name', 'like', '%' . $search . '%');
                    });
            });
        }

        if ($status === 'active') {
            $query->whereNull('claimed_at')
                ->whereDate('warranty_end_date', '>=', $today);
        } elseif ($status === 'expiring') {
            $query->whereNull('claimed_at')
                ->whereBetween('warranty_end_date', [$today, $expiringDate]);
        } elseif ($status === 'expired') {
            $query->whereNull('claimed_at')
                ->whereDate('warranty_end_date', '<', $today);
        } elseif ($status === 'claimed') {
            $query->whereNotNull('claimed_at');
        }

        return $query;
    }

    private function resolveUnifiedWarrantyStatusLabel(WarrantyRegistration $registration, int $expiringInDays): string
    {
        if (!empty($registration->claimed_at)) {
            return 'Sudah Diklaim';
        }

        $today = now()->startOfDay();
        $endDate = $registration->warranty_end_date ? Carbon::parse($registration->warranty_end_date)->startOfDay() : null;

        if (!$endDate || $endDate->lt($today)) {
            return 'Expired';
        }

        $threshold = (clone $today)->addDays(max(1, $expiringInDays));
        if ($endDate->lte($threshold)) {
            return 'Akan Expired';
        }

        return 'Aktif';
    }

    private function buildWarrantyData(array $item, string $saleDate, ?Part $part = null): array
    {
        $periodDays = (int) ($item['warranty_period_days'] ?? 0);

        if ($periodDays <= 0 && $part && $part->has_warranty) {
            $periodDays = (int) ($part->warranty_duration_days ?? 0);
        }

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
}
