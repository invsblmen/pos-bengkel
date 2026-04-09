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
use App\Models\PartStockMovement;
use App\Models\User;
use App\Models\Voucher;
use App\Notifications\PartSaleOrderReadyNotification;
use App\Services\CashChangeSuggestionService;
use App\Services\DiscountTaxService;
use App\Services\VoucherService;
use App\Services\WarrantyRegistrationService;
use App\Support\DispatchesBroadcastSafely;
use Carbon\Carbon;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;

class PartSaleController extends Controller
{
    use DispatchesBroadcastSafely;

    protected $discountTaxService;
    protected $cashChangeSuggestionService;
    protected $warrantyRegistrationService;
    protected $voucherService;

    public function __construct(
        DiscountTaxService $discountTaxService,
        CashChangeSuggestionService $cashChangeSuggestionService,
        WarrantyRegistrationService $warrantyRegistrationService,
        VoucherService $voucherService
    )
    {
        $this->discountTaxService = $discountTaxService;
        $this->cashChangeSuggestionService = $cashChangeSuggestionService;
        $this->warrantyRegistrationService = $warrantyRegistrationService;
        $this->voucherService = $voucherService;
    }

    public function index(Request $request)
    {
        if ((bool) config('go_backend.features.part_sale_index', false)) {
            $proxied = $this->partSaleIndexViaGo($request);
            if ($proxied !== null) {
                return Inertia::render('Dashboard/Parts/Sales/Index', $proxied);
            }
        }

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

    private function partSaleIndexViaGo(Request $request): ?array
    {
        $baseUrl = rtrim((string) config('go_backend.base_url', 'http://127.0.0.1:8081'), '/');
        $timeout = (int) config('go_backend.timeout_seconds', 5);
        $requestId = (string) ($request->header('X-Request-Id') ?: Str::uuid());

        try {
            $response = Http::timeout($timeout)
                ->acceptJson()
                ->withHeaders([
                    'X-Request-Id' => $requestId,
                ])
                ->get($baseUrl . '/api/v1/part-sales', $request->query());

            $json = $response->json();
            if (! $response->successful() || ! is_array($json)) {
                Log::warning('Part sale index Go bridge returned an invalid response', [
                    'status' => $response->status(),
                ]);

                return null;
            }

            if (! isset($json['sales'], $json['filters'])) {
                Log::warning('Part sale index Go bridge response is missing expected keys', [
                    'keys' => array_keys($json),
                ]);

                return null;
            }

            return $json;
        } catch (\Throwable $e) {
            return null;
        }
    }

    public function warranties(Request $request)
    {
        if ((bool) config('go_backend.features.part_sale_warranties_index', false)) {
            $proxied = $this->partSaleWarrantiesIndexViaGo($request);
            if ($proxied !== null) {
                return Inertia::render('Dashboard/Parts/Sales/Warranties/Index', $proxied);
            }
        }

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

    private function partSaleWarrantiesIndexViaGo(Request $request): ?array
    {
        $baseUrl = rtrim((string) config('go_backend.base_url', 'http://127.0.0.1:8081'), '/');
        $timeout = (int) config('go_backend.timeout_seconds', 5);
        $requestId = (string) ($request->header('X-Request-Id') ?: Str::uuid());

        try {
            $response = Http::timeout($timeout)
                ->acceptJson()
                ->withHeaders([
                    'X-Request-Id' => $requestId,
                ])
                ->get($baseUrl . '/api/v1/part-sales/warranties', $request->query());

            $json = $response->json();
            if (! $response->successful() || ! is_array($json)) {
                Log::warning('Part sale warranties index Go bridge returned an invalid response', [
                    'status' => $response->status(),
                ]);

                return null;
            }

            if (! isset($json['warranties'], $json['summary'], $json['filters'])) {
                Log::warning('Part sale warranties index Go bridge response is missing expected keys', [
                    'keys' => array_keys($json),
                ]);

                return null;
            }

            $json['customers'] = is_array($json['customers'] ?? null) ? $json['customers'] : [];
            $json['vehicles'] = is_array($json['vehicles'] ?? null) ? $json['vehicles'] : [];
            $json['mechanics'] = is_array($json['mechanics'] ?? null) ? $json['mechanics'] : [];

            return $json;
        } catch (\Throwable $e) {
            return null;
        }
    }

    public function exportWarranties(Request $request)
    {
        if ((bool) config('go_backend.features.part_sale_warranties_export', false)) {
            $proxied = $this->partSaleWarrantiesExportViaGo($request);
            if ($proxied !== null) {
                return $proxied;
            }
        }

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

    private function partSaleWarrantiesExportViaGo(Request $request): ?\Illuminate\Http\Response
    {
        $baseUrl = rtrim((string) config('go_backend.base_url', 'http://127.0.0.1:8081'), '/');
        $timeout = (int) config('go_backend.timeout_seconds', 5);
        $requestId = (string) ($request->header('X-Request-Id') ?: Str::uuid());

        try {
            $response = Http::timeout($timeout)
                ->withHeaders([
                    'X-Request-Id' => $requestId,
                ])
                ->get($baseUrl . '/api/v1/part-sales/warranties/export', $request->query());

            if (! $response->successful()) {
                Log::warning('Part sale warranties export Go bridge returned an invalid response', [
                    'status' => $response->status(),
                ]);

                return null;
            }

            $contentType = (string) $response->header('Content-Type', 'text/csv');
            $contentDisposition = (string) $response->header('Content-Disposition', 'attachment; filename=unified-warranties-export.csv');

            return response($response->body(), $response->status(), [
                'Content-Type' => $contentType,
                'Content-Disposition' => $contentDisposition,
            ]);
        } catch (\Throwable $e) {
            return null;
        }
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
            'availableVouchers' => Voucher::query()
                ->where('is_active', true)
                ->orderBy('code')
                ->get(['id', 'code', 'name', 'scope']),
        ]);
    }

    public function store(Request $request)
    {
        if ((bool) config('go_backend.features.part_sale_store', false)) {
            $proxied = $this->partSaleStoreViaGo($request);
            if ($proxied !== null) {
                return $proxied;
            }
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
                $detail = PartSaleDetail::create([
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

                $this->warrantyRegistrationService->registerFromPartSaleDetail($sale, $detail, $part);

            }

            $voucherResult = $this->voucherService->validateForTransaction($request->voucher_code, [
                'customer_id' => (int) $request->customer_id,
                'subtotal' => $subtotalForVoucher,
                'part_ids' => array_values(array_unique($partIdsForVoucher)),
                'part_category_ids' => array_values(array_unique($partCategoryIdsForVoucher)),
                'service_ids' => [],
                'service_category_ids' => [],
                'transaction_discount_type' => $request->discount_type ?? 'none',
                'transaction_discount_value' => $request->discount_value ?? 0,
            ]);

            $voucher = $voucherResult['voucher'];
            $voucherDiscountAmount = (int) ($voucherResult['discount_amount'] ?? 0);

            $sale->update([
                'voucher_id' => $voucher?->id,
                'voucher_code' => $voucher?->code,
                'voucher_discount_amount' => $voucher ? $voucherDiscountAmount : 0,
            ]);

            // Recalculate totals
            $sale->recalculateTotals()->save();

            if ($voucher) {
                $this->voucherService->markUsed(
                    $voucher,
                    PartSale::class,
                    (int) $sale->id,
                    (int) $sale->customer_id,
                    $voucherDiscountAmount,
                    [
                        'sale_number' => $sale->sale_number,
                    ]
                );
            }

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

    private function partSaleStoreViaGo(Request $request): ?\Illuminate\Http\RedirectResponse
    {
        $baseUrl = rtrim((string) config('go_backend.base_url', 'http://127.0.0.1:8081'), '/');
        $timeout = (int) config('go_backend.timeout_seconds', 5);
        $requestId = (string) ($request->header('X-Request-Id') ?: Str::uuid());

        try {
            $payload = $request->all();
            $payload['actor_user_id'] = $request->user()?->id;

            $response = Http::timeout($timeout)
                ->acceptJson()
                ->withHeaders([
                    'X-Request-Id' => $requestId,
                    'Content-Type' => 'application/json',
                ])
                ->post($baseUrl . '/api/v1/part-sales', $payload);

            $json = $response->json();
            if (! is_array($json)) {
                Log::warning('Part sale store Go bridge returned non JSON object response', [
                    'status' => $response->status(),
                ]);

                return null;
            }

            if ($response->successful()) {
                $saleID = (int) ($json['sale_id'] ?? 0);
                if ($saleID <= 0) {
                    Log::warning('Part sale store Go bridge successful response missing sale id', [
                        'status' => $response->status(),
                        'keys' => array_keys($json),
                    ]);

                    return null;
                }

                return redirect()
                    ->route('part-sales.show', ['partSale' => $saleID])
                    ->with('success', (string) ($json['message'] ?? 'Penjualan berhasil dibuat'));
            }

            if ($response->status() === 422 && isset($json['errors']) && is_array($json['errors'])) {
                throw ValidationException::withMessages($json['errors']);
            }

            return back()
                ->withInput()
                ->withErrors([
                    'error' => (string) ($json['message'] ?? 'Gagal membuat penjualan.'),
                ]);
        } catch (ValidationException $e) {
            throw $e;
        } catch (\Throwable $e) {
            return null;
        }
    }

    public function show(Request $request, PartSale $partSale)
    {
        $this->tryFulfillWaitingStock($partSale);

        if ((bool) config('go_backend.features.part_sale_show', false)) {
            $proxied = $this->partSaleShowViaGo($request, $partSale);
            if ($proxied !== null) {
                return Inertia::render('Dashboard/Parts/Sales/Show', $proxied);
            }
        }

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

    private function partSaleShowViaGo(Request $request, PartSale $partSale): ?array
    {
        $baseUrl = rtrim((string) config('go_backend.base_url', 'http://127.0.0.1:8081'), '/');
        $timeout = (int) config('go_backend.timeout_seconds', 5);
        $requestId = (string) ($request->header('X-Request-Id') ?: Str::uuid());

        try {
            $response = Http::timeout($timeout)
                ->acceptJson()
                ->withHeaders([
                    'X-Request-Id' => $requestId,
                ])
                ->get($baseUrl . '/api/v1/part-sales/' . $partSale->id);

            $json = $response->json();
            if (! $response->successful() || ! is_array($json)) {
                Log::warning('Part sale show Go bridge returned an invalid response', [
                    'status' => $response->status(),
                    'part_sale_id' => $partSale->id,
                ]);

                return null;
            }

            if (! isset($json['sale']) || ! is_array($json['sale'])) {
                Log::warning('Part sale show Go bridge missing sale payload', [
                    'part_sale_id' => $partSale->id,
                ]);

                return null;
            }

            $json['cashDenominations'] = is_array($json['cashDenominations'] ?? null)
                ? $json['cashDenominations']
                : [];

            return $json;
        } catch (\Throwable $e) {
            return null;
        }
    }

    public function print(Request $request, PartSale $partSale)
    {
        $this->tryFulfillWaitingStock($partSale);

        if ((bool) config('go_backend.features.part_sale_print', false)) {
            $proxied = $this->partSalePrintViaGo($request, $partSale);
            if ($proxied !== null) {
                return Inertia::render('Dashboard/Parts/Sales/Print', $proxied);
            }
        }

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

    private function partSalePrintViaGo(Request $request, PartSale $partSale): ?array
    {
        $baseUrl = rtrim((string) config('go_backend.base_url', 'http://127.0.0.1:8081'), '/');
        $timeout = (int) config('go_backend.timeout_seconds', 5);
        $requestId = (string) ($request->header('X-Request-Id') ?: Str::uuid());

        try {
            $response = Http::timeout($timeout)
                ->acceptJson()
                ->withHeaders([
                    'X-Request-Id' => $requestId,
                ])
                ->get($baseUrl . '/api/v1/part-sales/' . $partSale->id . '/print');

            $json = $response->json();
            if (! $response->successful() || ! is_array($json)) {
                Log::warning('Part sale print Go bridge returned an invalid response', [
                    'status' => $response->status(),
                    'part_sale_id' => $partSale->id,
                ]);

                return null;
            }

            if (! isset($json['sale']) || ! is_array($json['sale'])) {
                Log::warning('Part sale print Go bridge missing sale payload', [
                    'part_sale_id' => $partSale->id,
                ]);

                return null;
            }

            return $json;
        } catch (\Throwable $e) {
            return null;
        }
    }

    public function edit(PartSale $partSale)
    {
        // Only allow editing draft sales
        if ($partSale->status !== 'draft') {
            return back()->withErrors(['error' => 'Hanya penjualan draft yang bisa diedit']);
        }

        if ((bool) config('go_backend.features.part_sale_edit', false)) {
            $proxied = $this->partSaleEditViaGo(request(), $partSale);
            if ($proxied !== null) {
                return Inertia::render('Dashboard/Parts/Sales/Edit', $proxied);
            }
        }

        $partSale->load('details.part');
        $customers = Customer::orderBy('name')->get();
        $parts = Part::orderBy('name')->get();

        return Inertia::render('Dashboard/Parts/Sales/Edit', [
            'sale' => $partSale,
            'customers' => $customers,
            'parts' => $parts,
            'availableVouchers' => Voucher::query()
                ->where('is_active', true)
                ->orderBy('code')
                ->get(['id', 'code', 'name', 'scope']),
        ]);
    }

    private function partSaleEditViaGo(Request $request, PartSale $partSale): ?array
    {
        $baseUrl = rtrim((string) config('go_backend.base_url', 'http://127.0.0.1:8081'), '/');
        $timeout = (int) config('go_backend.timeout_seconds', 5);
        $requestId = (string) ($request->header('X-Request-Id') ?: Str::uuid());

        try {
            $response = Http::timeout($timeout)
                ->acceptJson()
                ->withHeaders([
                    'X-Request-Id' => $requestId,
                ])
                ->get($baseUrl . '/api/v1/part-sales/' . $partSale->id . '/edit');

            $json = $response->json();
            if (! $response->successful() || ! is_array($json)) {
                Log::warning('Part sale edit Go bridge returned an invalid response', [
                    'status' => $response->status(),
                    'part_sale_id' => $partSale->id,
                ]);

                return null;
            }

            if (! isset($json['sale']) || ! is_array($json['sale'])) {
                Log::warning('Part sale edit Go bridge response is missing sale payload', [
                    'part_sale_id' => $partSale->id,
                ]);

                return null;
            }

            $json['customers'] = is_array($json['customers'] ?? null) ? $json['customers'] : [];
            $json['parts'] = is_array($json['parts'] ?? null) ? $json['parts'] : [];
            $json['availableVouchers'] = is_array($json['availableVouchers'] ?? null) ? $json['availableVouchers'] : [];

            return $json;
        } catch (\Throwable $e) {
            return null;
        }
    }

    public function update(Request $request, PartSale $partSale)
    {
        // Only allow updating draft sales
        if ($partSale->status !== 'draft') {
            return back()->withErrors(['error' => 'Hanya penjualan draft yang bisa diupdate']);
        }

        if ((bool) config('go_backend.features.part_sale_update', false)) {
            $proxied = $this->partSaleUpdateViaGo($request, $partSale);
            if ($proxied !== null) {
                return $proxied;
            }
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
                'discount_type' => $request->discount_type ?? 'none',
                'discount_value' => $request->discount_value ?? 0,
                'tax_type' => $request->tax_type ?? 'none',
                'tax_value' => $request->tax_value ?? 0,
                'paid_amount' => $request->paid_amount ?? $partSale->paid_amount,
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
                    'cost_price' => $part?->buy_price ?? 0,
                    'selling_price' => $item['unit_price'],
                    'warranty_period_days' => $warrantyData['warranty_period_days'],
                    'warranty_start_date' => $warrantyData['warranty_start_date'],
                    'warranty_end_date' => $warrantyData['warranty_end_date'],
                    'warranty_claimed_at' => null,
                    'warranty_claim_notes' => null,
                ]);

                $this->warrantyRegistrationService->registerFromPartSaleDetail($partSale, $detail, $part);
            }

            $voucherResult = $this->voucherService->validateForTransaction($request->voucher_code, [
                'customer_id' => (int) $request->customer_id,
                'subtotal' => $subtotalForVoucher,
                'part_ids' => array_values(array_unique($partIdsForVoucher)),
                'part_category_ids' => array_values(array_unique($partCategoryIdsForVoucher)),
                'service_ids' => [],
                'service_category_ids' => [],
                'transaction_discount_type' => $request->discount_type ?? 'none',
                'transaction_discount_value' => $request->discount_value ?? 0,
            ]);

            $voucher = $voucherResult['voucher'];
            $voucherDiscountAmount = (int) ($voucherResult['discount_amount'] ?? 0);

            $partSale->update([
                'voucher_id' => $voucher?->id,
                'voucher_code' => $voucher?->code,
                'voucher_discount_amount' => $voucher ? $voucherDiscountAmount : 0,
            ]);

            // Recalculate totals
            $partSale->recalculateTotals()->save();

            if ($voucher) {
                $this->voucherService->markUsed(
                    $voucher,
                    PartSale::class,
                    (int) $partSale->id,
                    (int) $partSale->customer_id,
                    $voucherDiscountAmount,
                    [
                        'sale_number' => $partSale->sale_number,
                    ]
                );
            }

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

    private function partSaleUpdateViaGo(Request $request, PartSale $partSale): ?\Illuminate\Http\RedirectResponse
    {
        $baseUrl = rtrim((string) config('go_backend.base_url', 'http://127.0.0.1:8081'), '/');
        $timeout = (int) config('go_backend.timeout_seconds', 5);
        $requestId = (string) ($request->header('X-Request-Id') ?: Str::uuid());

        try {
            $payload = $request->all();
            $payload['actor_user_id'] = $request->user()?->id;

            $response = Http::timeout($timeout)
                ->acceptJson()
                ->withHeaders([
                    'X-Request-Id' => $requestId,
                    'Content-Type' => 'application/json',
                ])
                ->put($baseUrl . '/api/v1/part-sales/' . $partSale->id, $payload);

            $json = $response->json();
            if (! is_array($json)) {
                Log::warning('Part sale update Go bridge returned non JSON object response', [
                    'status' => $response->status(),
                    'part_sale_id' => $partSale->id,
                ]);

                return null;
            }

            if ($response->successful()) {
                $saleID = (int) ($json['sale_id'] ?? $partSale->id);
                if ($saleID <= 0) {
                    $saleID = $partSale->id;
                }

                return redirect()
                    ->route('part-sales.show', ['partSale' => $saleID])
                    ->with('success', (string) ($json['message'] ?? 'Penjualan berhasil diupdate'));
            }

            if ($response->status() === 422 && isset($json['errors']) && is_array($json['errors'])) {
                throw ValidationException::withMessages($json['errors']);
            }

            return back()
                ->withInput()
                ->withErrors([
                    'error' => (string) ($json['message'] ?? 'Gagal mengupdate penjualan.'),
                ]);
        } catch (ValidationException $e) {
            throw $e;
        } catch (\Throwable $e) {
            return null;
        }
    }

    public function destroy(Request $request, PartSale $partSale)
    {
        if ((bool) config('go_backend.features.part_sale_destroy', false)) {
            $proxied = $this->partSaleDestroyViaGo($request, $partSale);
            if ($proxied !== null) {
                return $proxied;
            }
        }

        // Only allow deleting draft sales
        if ($partSale->status !== 'draft') {
            return back()->withErrors(['error' => 'Hanya penjualan draft yang bisa dihapus']);
        }

        DB::beginTransaction();
        try {
            $this->warrantyRegistrationService->removeByPartSale($partSale->id);
            $this->voucherService->clearUsageBySource(PartSale::class, (int) $partSale->id);

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

    private function partSaleDestroyViaGo(Request $request, PartSale $partSale): ?\Illuminate\Http\RedirectResponse
    {
        $baseUrl = rtrim((string) config('go_backend.base_url', 'http://127.0.0.1:8081'), '/');
        $timeout = (int) config('go_backend.timeout_seconds', 5);
        $requestId = (string) ($request->header('X-Request-Id') ?: Str::uuid());

        try {
            $response = Http::timeout($timeout)
                ->acceptJson()
                ->withHeaders([
                    'X-Request-Id' => $requestId,
                ])
                ->delete($baseUrl . '/api/v1/part-sales/' . $partSale->id);

            $json = $response->json();
            if (! is_array($json)) {
                Log::warning('Part sale destroy Go bridge returned non JSON object response', [
                    'status' => $response->status(),
                    'part_sale_id' => $partSale->id,
                ]);

                return null;
            }

            if ($response->successful()) {
                return redirect()
                    ->route('part-sales.index')
                    ->with('success', (string) ($json['message'] ?? 'Penjualan berhasil dihapus'));
            }

            if ($response->status() === 422 && isset($json['errors']) && is_array($json['errors'])) {
                throw ValidationException::withMessages($json['errors']);
            }

            return back()->withErrors([
                'error' => (string) ($json['message'] ?? 'Gagal menghapus penjualan.'),
            ]);
        } catch (ValidationException $e) {
            throw $e;
        } catch (\Throwable $e) {
            return null;
        }
    }

    public function updatePayment(Request $request, PartSale $partSale)
    {
        if ((bool) config('go_backend.features.part_sale_update_payment', false)) {
            $proxied = $this->partSaleUpdatePaymentViaGo($request, $partSale);
            if ($proxied !== null) {
                return $proxied;
            }
        }

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

    private function partSaleUpdatePaymentViaGo(Request $request, PartSale $partSale): ?\Illuminate\Http\RedirectResponse
    {
        $baseUrl = rtrim((string) config('go_backend.base_url', 'http://127.0.0.1:8081'), '/');
        $timeout = (int) config('go_backend.timeout_seconds', 5);
        $requestId = (string) ($request->header('X-Request-Id') ?: Str::uuid());

        try {
            $payload = $request->all();
            $payload['actor_user_id'] = $request->user()?->id;

            $response = Http::timeout($timeout)
                ->acceptJson()
                ->withHeaders([
                    'X-Request-Id' => $requestId,
                    'Content-Type' => 'application/json',
                ])
                ->post($baseUrl . '/api/v1/part-sales/' . $partSale->id . '/update-payment', $payload);

            $json = $response->json();
            if (! is_array($json)) {
                Log::warning('Part sale update payment Go bridge returned non JSON object response', [
                    'status' => $response->status(),
                    'part_sale_id' => $partSale->id,
                ]);

                return null;
            }

            if ($response->successful()) {
                return back()->with('success', (string) ($json['message'] ?? 'Pembayaran berhasil dicatat'));
            }

            if ($response->status() === 422 && isset($json['errors']) && is_array($json['errors'])) {
                throw ValidationException::withMessages($json['errors']);
            }

            return back()->withErrors([
                'error' => (string) ($json['message'] ?? 'Gagal mencatat pembayaran penjualan.'),
            ]);
        } catch (ValidationException $e) {
            throw $e;
        } catch (\Throwable $e) {
            return null;
        }
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
        if ((bool) config('go_backend.features.part_sale_update_status', false)) {
            $proxied = $this->partSaleUpdateStatusViaGo($request, $partSale);
            if ($proxied !== null) {
                return $proxied;
            }
        }

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

    private function partSaleUpdateStatusViaGo(Request $request, PartSale $partSale): ?\Illuminate\Http\RedirectResponse
    {
        $baseUrl = rtrim((string) config('go_backend.base_url', 'http://127.0.0.1:8081'), '/');
        $timeout = (int) config('go_backend.timeout_seconds', 5);
        $requestId = (string) ($request->header('X-Request-Id') ?: Str::uuid());

        try {
            $payload = $request->all();
            $payload['actor_user_id'] = $request->user()?->id;

            $response = Http::timeout($timeout)
                ->acceptJson()
                ->withHeaders([
                    'X-Request-Id' => $requestId,
                    'Content-Type' => 'application/json',
                ])
                ->post($baseUrl . '/api/v1/part-sales/' . $partSale->id . '/update-status', $payload);

            $json = $response->json();
            if (! is_array($json)) {
                Log::warning('Part sale update status Go bridge returned non JSON object response', [
                    'status' => $response->status(),
                    'part_sale_id' => $partSale->id,
                ]);

                return null;
            }

            if ($response->successful()) {
                return back()->with('success', (string) ($json['message'] ?? 'Status penjualan berhasil diperbarui'));
            }

            if ($response->status() === 422 && isset($json['errors']) && is_array($json['errors'])) {
                throw ValidationException::withMessages($json['errors']);
            }

            return back()->withErrors([
                'error' => (string) ($json['message'] ?? 'Gagal memperbarui status penjualan.'),
            ]);
        } catch (ValidationException $e) {
            throw $e;
        } catch (\Throwable $e) {
            return null;
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
        if ((bool) config('go_backend.features.part_sale_create_from_order', false)) {
            $proxied = $this->partSaleCreateFromOrderViaGo($request);
            if ($proxied !== null) {
                return $proxied;
            }
        }

        $request->validate([
            'sales_order_id' => 'required|exists:part_sales_orders,id',
        ]);

        return redirect()->route('part-sales.create', [
            'sales_order_id' => $request->sales_order_id
        ]);
    }

    private function partSaleCreateFromOrderViaGo(Request $request): ?\Illuminate\Http\RedirectResponse
    {
        $baseUrl = rtrim((string) config('go_backend.base_url', 'http://127.0.0.1:8081'), '/');
        $timeout = (int) config('go_backend.timeout_seconds', 5);
        $requestId = (string) ($request->header('X-Request-Id') ?: Str::uuid());

        try {
            $payload = $request->only(['sales_order_id']);
            $payload['actor_user_id'] = $request->user()?->id;

            $response = Http::timeout($timeout)
                ->acceptJson()
                ->withHeaders([
                    'X-Request-Id' => $requestId,
                    'Content-Type' => 'application/json',
                ])
                ->post($baseUrl . '/api/v1/part-sales/create-from-order', $payload);

            $json = $response->json();
            if (! is_array($json)) {
                Log::warning('Part sale create-from-order Go bridge returned non JSON object response', [
                    'status' => $response->status(),
                ]);

                return null;
            }

            if ($response->successful()) {
                return redirect()->route('part-sales.create', [
                    'sales_order_id' => $json['sales_order_id'] ?? $request->sales_order_id,
                ]);
            }

            if ($response->status() === 422 && isset($json['errors']) && is_array($json['errors'])) {
                throw ValidationException::withMessages($json['errors']);
            }

            return back()->withErrors([
                'error' => (string) ($json['message'] ?? 'Gagal memuat data sales order.'),
            ]);
        } catch (ValidationException $e) {
            throw $e;
        } catch (\Throwable $e) {
            return null;
        }
    }

    public function claimWarranty(Request $request, PartSale $partSale, PartSaleDetail $detail)
    {
        if ((bool) config('go_backend.features.part_sale_claim_warranty', false)) {
            $proxied = $this->partSaleClaimWarrantyViaGo($request, $partSale, $detail);
            if ($proxied !== null) {
                return $proxied;
            }
        }

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

        return back()->with('success', 'Klaim garansi berhasil dicatat');
    }

    private function partSaleClaimWarrantyViaGo(Request $request, PartSale $partSale, PartSaleDetail $detail): ?\Illuminate\Http\RedirectResponse
    {
        $baseUrl = rtrim((string) config('go_backend.base_url', 'http://127.0.0.1:8081'), '/');
        $timeout = (int) config('go_backend.timeout_seconds', 5);
        $requestId = (string) ($request->header('X-Request-Id') ?: Str::uuid());

        try {
            $payload = $request->only(['warranty_claim_notes']);
            $payload['actor_user_id'] = $request->user()?->id;

            $response = Http::timeout($timeout)
                ->acceptJson()
                ->withHeaders([
                    'X-Request-Id' => $requestId,
                    'Content-Type' => 'application/json',
                ])
                ->post($baseUrl . '/api/v1/part-sales/' . $partSale->id . '/details/' . $detail->id . '/claim-warranty', $payload);

            $json = $response->json();
            if (! is_array($json)) {
                Log::warning('Part sale claim warranty Go bridge returned non JSON object response', [
                    'status' => $response->status(),
                    'part_sale_id' => $partSale->id,
                    'detail_id' => $detail->id,
                ]);

                return null;
            }

            if ($response->successful()) {
                return back()->with('success', (string) ($json['message'] ?? 'Klaim garansi berhasil dicatat'));
            }

            if ($response->status() === 422 && isset($json['errors']) && is_array($json['errors'])) {
                throw ValidationException::withMessages($json['errors']);
            }

            return back()->withErrors([
                'error' => (string) ($json['message'] ?? 'Gagal mencatat klaim garansi.'),
            ]);
        } catch (ValidationException $e) {
            throw $e;
        } catch (\Throwable $e) {
            return null;
        }
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
}
