<?php

namespace App\Http\Controllers\Apps;

use App\Events\ServiceOrderCreated;
use App\Events\ServiceOrderUpdated;
use App\Events\ServiceOrderDeleted;
use App\Http\Controllers\Controller;
use App\Models\BusinessProfile;
use App\Models\CashDenomination;
use App\Models\CashDrawerDenomination;
use App\Models\CashTransaction;
use App\Models\CashTransactionItem;
use App\Models\Mechanic;
use App\Models\WarrantyRegistration;
use App\Models\ServiceOrder;
use App\Models\ServiceOrderDetail;
use App\Models\ServiceOrderStatusHistory;
use App\Models\Voucher;
use App\Services\CashChangeSuggestionService;
use App\Services\DiscountTaxService;
use App\Services\FIFOCostingService;
use App\Services\VoucherService;
use App\Services\WarrantyRegistrationService;
use App\Services\WorkshopPricingService;
use App\Support\DispatchesBroadcastSafely;
use Carbon\Carbon;
use Illuminate\Http\Request;
use Illuminate\Support\Str;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;
use App\Http\Controllers\Concerns\RespondsWithJsonOrRedirect;
use App\Services\WhatsAppMessageService;

class ServiceOrderController extends Controller
{
    use DispatchesBroadcastSafely;
    use RespondsWithJsonOrRedirect;

    public function __construct(
        private WarrantyRegistrationService $warrantyRegistrationService,
        private VoucherService $voucherService,
        private CashChangeSuggestionService $cashChangeSuggestionService
    ) {
    }

    public function index(Request $request)
    {
        $query = ServiceOrder::with('customer', 'vehicle', 'mechanic', 'details.service', 'details.part');

        // Search filter
        if ($request->search) {
            $query->where(function($q) use ($request) {
                $q->where('order_number', 'like', '%' . $request->search . '%')
                  ->orWhereHas('customer', function($q) use ($request) {
                      $q->where('name', 'like', '%' . $request->search . '%');
                  })
                  ->orWhereHas('vehicle', function($q) use ($request) {
                      $q->where('plate_number', 'like', '%' . $request->search . '%')
                        ->orWhere('brand', 'like', '%' . $request->search . '%')
                        ->orWhere('model', 'like', '%' . $request->search . '%');
                  });
            });
        }

        // Status filter
        if ($request->status && $request->status !== 'all') {
            $query->where('status', $request->status);
        }

        // Date range filter
        if ($request->date_from) {
            $query->whereDate('created_at', '>=', $request->date_from);
        }
        if ($request->date_to) {
            $query->whereDate('created_at', '<=', $request->date_to);
        }

        // Mechanic filter
        if ($request->mechanic_id && $request->mechanic_id !== 'all') {
            $query->where('mechanic_id', $request->mechanic_id);
        }

        // Payment status filter
        if ($request->payment_status && $request->payment_status !== 'all') {
            $query->where('payment_status', $request->payment_status);
        }

        $orders = $query->orderByDesc('created_at')->paginate(15)->withQueryString();

        // Stats for dashboard cards
        $stats = [
            'pending' => ServiceOrder::where('status', 'pending')->count(),
            'in_progress' => ServiceOrder::where('status', 'in_progress')->count(),
            'completed' => ServiceOrder::where('status', 'completed')->count(),
            'paid' => ServiceOrder::where('payment_status', 'paid')->count(),
            'total_revenue' => ServiceOrder::where('status', 'completed')->sum('total'),
        ];

        $payload = [
            'orders' => $orders,
            'stats' => $stats,
            'mechanics' => \App\Models\Mechanic::all(['id', 'name']),
            'filters' => $request->only(['search', 'status', 'date_from', 'date_to', 'mechanic_id', 'payment_status']),
        ];

        return inertia('Dashboard/ServiceOrders/Index', $payload);
    }

    public function create()
    {
        // Get active service orders (pending and in_progress) to prevent double booking
        $activeServiceOrders = ServiceOrder::whereIn('status', ['pending', 'in_progress'])
            ->get(['id', 'vehicle_id', 'status', 'order_number']);

        return inertia('Dashboard/ServiceOrders/Create', [
            'customers' => \App\Models\Customer::with('vehicles')->get(),
            'vehicles' => \App\Models\Vehicle::with('customer')->get(),
            'mechanics' => \App\Models\Mechanic::all(),
            'services' => \App\Models\Service::all(),
            'parts' => \App\Models\Part::with('category')->get(),
            'tags' => \App\Models\Tag::all(),
            'activeServiceOrders' => $activeServiceOrders,
            'cashDenominations' => $this->getCashDenominations(),
            'availableVouchers' => Voucher::query()
                ->where('is_active', true)
                ->orderBy('code')
                ->get(['id', 'code', 'name', 'scope']),
        ]);
    }

    public function createQuick()
    {
        return inertia('Dashboard/ServiceOrders/QuickIntake', [
            'mechanics' => Mechanic::all(['id', 'name']),
        ]);
    }

    public function edit($id)
    {
        $order = ServiceOrder::with('customer', 'vehicle', 'mechanic', 'details.service', 'details.part', 'tags')
            ->findOrFail($id);

        // Transform details to items format expected by Edit component
        // Group details: each service creates an item, and subsequent parts are added to that item
        $items = [];
        $currentItem = null;

        foreach ($order->details as $detail) {
            if ($detail->service_id) {
                // Start a new item if we encounter a service
                if ($currentItem) {
                    $items[] = $currentItem;
                }
                $currentItem = [
                    'service_id' => $detail->service_id,
                    'service_discount_type' => $detail->discount_type,
                    'service_discount_value' => $detail->discount_value,
                    'parts' => [],
                ];
            }

            // Add part if this detail has one
            if ($detail->part_id && $currentItem) {
                $currentItem['parts'][] = [
                    'part_id' => $detail->part_id,
                    'qty' => $detail->qty,
                    'price' => $detail->price,
                    'discount_type' => $detail->discount_type,
                    'discount_value' => $detail->discount_value,
                    'discount_amount' => $detail->discount_amount,
                    'final_amount' => $detail->final_amount,
                    'part_number' => $detail->part?->part_number,
                ];
            }
        }

        // Don't forget the last item
        if ($currentItem) {
            $items[] = $currentItem;
        }

        $order->items = $items;

        // Get active service orders for vehicle-in-service check
        $activeServiceOrders = ServiceOrder::query()
            ->where('id', '!=', $id)
            ->whereIn('status', ['pending', 'in_progress'])
            ->select('id', 'vehicle_id', 'order_number', 'status')
            ->get();

        return inertia('Dashboard/ServiceOrders/Edit', [
            'order' => $order,
            'customers' => \App\Models\Customer::with('vehicles')->get(),
            'vehicles' => \App\Models\Vehicle::with('customer')->get(),
            'mechanics' => \App\Models\Mechanic::all(),
            'services' => \App\Models\Service::all(),
            'parts' => \App\Models\Part::with('category')->get(),
            'tags' => \App\Models\Tag::all(),
            'activeServiceOrders' => $activeServiceOrders,
            'cashDenominations' => $this->getCashDenominations(),
            'availableVouchers' => Voucher::query()
                ->where('is_active', true)
                ->orderBy('code')
                ->get(['id', 'code', 'name', 'scope']),
        ]);
    }

    public function show($id)
    {
        $order = ServiceOrder::with('customer', 'vehicle', 'mechanic', 'details.service', 'details.part')
            ->findOrFail($id);

        $warrantyRegistrations = WarrantyRegistration::query()
            ->where('source_type', ServiceOrder::class)
            ->where('source_id', $order->id)
            ->get()
            ->keyBy('source_detail_id');

        $warrantyMap = $warrantyRegistrations->map(function (WarrantyRegistration $registration) {
            return [
                'id' => $registration->id,
                'status' => $registration->status,
                'warranty_period_days' => $registration->warranty_period_days,
                'warranty_start_date' => optional($registration->warranty_start_date)?->toDateString(),
                'warranty_end_date' => optional($registration->warranty_end_date)?->toDateString(),
                'claimed_at' => optional($registration->claimed_at)?->toISOString(),
                'claim_notes' => $registration->claim_notes,
            ];
        });

        // Gather permission context for SO-REF links (customer, vehicle, mechanic detail access)
        $user = Auth::user();
        $permissions = [
            'can_view_customers' => $user->can('customers-access'),
            'can_view_vehicles' => $user->can('vehicles-access'),
            'can_view_mechanics' => $user->can('mechanics-access'),
        ];

        return inertia('Dashboard/ServiceOrders/Show', [
            'order' => $order,
            'warrantyRegistrations' => $warrantyMap,
            'permissions' => $permissions,
            'cashDenominations' => $this->getCashDenominations(),
        ]);
    }

    public function sendWhatsAppSummary($id, WhatsAppMessageService $whatsAppMessageService)
    {
        $order = ServiceOrder::with('customer', 'vehicle', 'mechanic', 'details.service', 'details.part')
            ->findOrFail($id);

        $outbound = $whatsAppMessageService->sendServiceOrderSummary($order);

        if (!$outbound) {
            return $this->errorResponse('Pelanggan belum memiliki nomor WhatsApp yang valid.', ['phone' => ['Nomor pelanggan kosong.']], 422);
        }

        return $this->jsonOrRedirect('service-orders.show', [$order->id], 'Rincian service order berhasil di-queue ke WhatsApp pelanggan.');
    }

    public function print(Request $request, $id)
    {
        $order = ServiceOrder::with('customer', 'vehicle', 'mechanic', 'details.service', 'details.part')
            ->findOrFail($id);
        $businessProfile = BusinessProfile::first();
        $printMode = in_array($request->query('mode'), ['invoice', 'work_order', 'thermal80', 'thermal58'], true)
            ? $request->query('mode')
            : 'invoice';

        return inertia('Dashboard/ServiceOrders/Print', [
            'order' => $order,
            'businessProfile' => $businessProfile,
            'printMode' => $printMode,
        ]);
    }

    public function store(Request $request)
    {
        $request->validate([
            'submission_token' => 'required|string|max:100',
            'customer_id' => 'nullable|exists:customers,id',
            'vehicle_id' => 'nullable|exists:vehicles,id',
            'mechanic_id' => 'nullable|exists:mechanics,id',
            'status' => 'nullable|in:pending,in_progress,completed,cancelled',
            'odometer_km' => 'required|integer|min:0|max:1000000',
            'estimated_start_at' => 'nullable|date',
            'estimated_finish_at' => 'nullable|date',
            'labor_cost' => 'nullable|integer|min:0',
            'notes' => 'nullable|string',
            'maintenance_type' => 'nullable|string',
            'next_service_km' => 'nullable|integer|min:0',
            'next_service_date' => 'nullable|date',
            'payment_method' => 'nullable|in:cash,credit,mixed',
            'applied_amount' => 'nullable|integer|min:0',
            'paid_amount' => 'nullable|integer|min:0',
            'payment_meta' => 'nullable|array',
            'transfer_destination' => 'nullable|in:qris,bni,bca,bri,edc_bri,transfer_bni,transfer_bca,transfer_bri',
            'tags' => 'nullable|array',
            'tags.*' => 'integer|exists:tags,id',
            'items' => 'required|array|min:1',
            'items.*.service_id' => 'nullable|exists:services,id',
            'items.*.service_discount_type' => 'nullable|in:none,percent,fixed',
            'items.*.service_discount_value' => 'nullable|numeric|min:0',
            'items.*.parts' => 'nullable|array',
            'items.*.parts.*.part_id' => 'nullable|exists:parts,id',
            'items.*.parts.*.qty' => 'required|integer|min:1',
            'items.*.parts.*.price' => 'required|integer|min:0',
            'items.*.parts.*.discount_type' => 'nullable|in:none,percent,fixed',
            'items.*.parts.*.discount_value' => 'nullable|numeric|min:0',
            'discount_type' => 'nullable|in:none,percent,fixed',
            'discount_value' => 'nullable|numeric|min:0',
            'tax_type' => 'nullable|in:none,percent,fixed',
            'tax_value' => 'nullable|numeric|min:0',
            'voucher_code' => 'nullable|string|max:50',
        ]);

        Log::debug('Service Order Store - Request items', ['items' => $request->items]);

        $this->validateDiscountBounds($request);

        $submissionToken = (string) $request->input('submission_token');
        $userId = Auth::id() ?? 0;
        $processingKey = "service_order:store:processing:{$userId}:{$submissionToken}";
        $resultKey = "service_order:store:result:{$userId}:{$submissionToken}";

        $existingOrderId = Cache::get($resultKey);
        if ($existingOrderId) {
            return $this->jsonOrRedirect('service-orders.show', [$existingOrderId], 'Permintaan sudah diproses sebelumnya.', null, 200, 'info');
        }

        if (!Cache::add($processingKey, 1, now()->addSeconds(30))) {
            return $this->jsonOrRedirect(null, [], 'Permintaan sedang diproses. Mohon tunggu beberapa detik.', null, 429, 'warning');
        }

        try {

            $orderNumber = 'SO-' . strtoupper(Str::random(8));
            $appliedAmount = (int) ($request->input('applied_amount') ?? $request->paid_amount ?? 0);
            $paymentMeta = $this->normalizePaymentMeta($request->payment_meta, $appliedAmount);

            $order = ServiceOrder::create([
                'order_number' => $orderNumber,
                'customer_id' => $request->customer_id,
                'vehicle_id' => $request->vehicle_id,
                'mechanic_id' => $request->mechanic_id,
                'status' => $request->status ?? 'pending',
                'odometer_km' => $request->odometer_km,
                'estimated_start_at' => $request->estimated_start_at,
                'estimated_finish_at' => $request->estimated_finish_at,
                'labor_cost' => $request->labor_cost ?? 0,
                'notes' => $request->notes,
                'maintenance_type' => $request->maintenance_type,
                'next_service_km' => $request->next_service_km,
                'next_service_date' => $request->next_service_date,
                'payment_method' => $request->payment_method ?? 'cash',
                'paid_amount' => $appliedAmount,
                'transfer_destination' => $request->transfer_destination ?? null,
                'payment_meta' => $paymentMeta,
                'total' => 0,
                'discount_type' => $request->discount_type ?? 'none',
                'discount_value' => $request->discount_value ?? 0,
                'voucher_id' => null,
                'voucher_code' => null,
                'voucher_discount_amount' => 0,
                'tax_type' => $request->tax_type ?? 'none',
                'tax_value' => $request->tax_value ?? 0,
            ]);

            // Attach tags
            if ($request->tags) {
                $order->tags()->sync($request->tags);
            }

            // Validate odometer progression against previous records
            if ($order->vehicle_id && $order->odometer_km !== null) {
                $prevOrderKm = ServiceOrder::where('vehicle_id', $order->vehicle_id)
                    ->whereNotNull('odometer_km')
                    ->where('id', '!=', $order->id)
                    ->max('odometer_km');
                if ($prevOrderKm && $order->odometer_km < $prevOrderKm) {
                    $order->delete();
                    throw ValidationException::withMessages(['odometer_km' => 'Odometer tidak boleh kurang dari km sebelumnya (' . number_format($prevOrderKm, 0, ',', '.') . ' km).']);
                }
            }

            $this->calculateServiceOrderCosts($order, $request->items);
            $this->applyVoucherToServiceOrder($order, $request->voucher_code);

            // If created with completed status, deduct parts from inventory
            if ($order->status === 'completed') {
                $this->deductPartsFromInventory($order);
                $this->syncWarrantyRegistrationsForFinalizedOrder($order);
            }

            $this->dispatchBroadcastSafely(
                fn () => ServiceOrderCreated::dispatch($order->load(['customer', 'vehicle', 'mechanic', 'details.service', 'details.part'])->toArray()),
                'ServiceOrderCreated'
            );

            Cache::put($resultKey, $order->id, now()->addMinutes(10));

            return $this->jsonOrRedirect('service-orders.index', [], 'Service order created.', $order->load(['customer', 'vehicle', 'mechanic', 'details.service', 'details.part'])->toArray());
        } finally {
            Cache::forget($processingKey);
        }
    }

    public function storeQuick(Request $request)
    {
        $validated = $request->validate([
            'customer_name' => 'required|string|max:255',
            'customer_phone' => 'required|string|max:30',
            'plate_number' => 'required|string|max:20',
            'vehicle_brand' => 'nullable|string|max:100',
            'vehicle_model' => 'nullable|string|max:100',
            'odometer_km' => 'required|integer|min:0|max:1000000',
            'complaint' => 'nullable|string|max:2000',
            'mechanic_id' => 'nullable|exists:mechanics,id',
            'submit_mode' => 'nullable|in:view_detail,create_again',
        ]);

        $normalizedPlate = strtoupper(preg_replace('/\s+/', '', $validated['plate_number']));

        $vehicle = \App\Models\Vehicle::query()
            ->whereRaw("REPLACE(UPPER(plate_number), ' ', '') = ?", [$normalizedPlate])
            ->first();

        if ($vehicle) {
            $customer = $vehicle->customer;
            if ($customer) {
                $customer->update([
                    'name' => $validated['customer_name'],
                    'phone' => $validated['customer_phone'],
                ]);
            } else {
                $customer = \App\Models\Customer::create([
                    'name' => $validated['customer_name'],
                    'phone' => $validated['customer_phone'],
                ]);
                $vehicle->update(['customer_id' => $customer->id]);
            }

            if (!empty($validated['vehicle_brand']) || !empty($validated['vehicle_model'])) {
                $vehicle->update([
                    'brand' => $validated['vehicle_brand'] ?: $vehicle->brand,
                    'model' => $validated['vehicle_model'] ?: $vehicle->model,
                ]);
            }
        } else {
            $customer = \App\Models\Customer::create([
                'name' => $validated['customer_name'],
                'phone' => $validated['customer_phone'],
            ]);

            $vehicle = \App\Models\Vehicle::create([
                'customer_id' => $customer->id,
                'plate_number' => $normalizedPlate,
                'brand' => $validated['vehicle_brand'] ?? null,
                'model' => $validated['vehicle_model'] ?? null,
            ]);
        }

        $order = ServiceOrder::create([
            'order_number' => 'SO-' . strtoupper(Str::random(8)),
            'customer_id' => $vehicle->customer_id,
            'vehicle_id' => $vehicle->id,
            'mechanic_id' => $validated['mechanic_id'] ?? null,
            'status' => 'pending',
            'odometer_km' => $validated['odometer_km'],
            'estimated_start_at' => now(),
            'estimated_finish_at' => now(),
            'notes' => $validated['complaint'] ?? null,
            'total' => 0,
            'discount_type' => 'none',
            'discount_value' => 0,
            'tax_type' => 'none',
            'tax_value' => 0,
            'voucher_id' => null,
            'voucher_code' => null,
            'voucher_discount_amount' => 0,
            'labor_cost' => 0,
            'material_cost' => 0,
            'grand_total' => 0,
        ]);

        $this->dispatchBroadcastSafely(
            fn () => ServiceOrderCreated::dispatch($order->load(['customer', 'vehicle', 'mechanic'])->toArray()),
            'ServiceOrderCreated'
        );

        $submitMode = $validated['submit_mode'] ?? 'view_detail';

        if ($submitMode === 'create_again') {
            return $this->jsonOrRedirect('service-orders.quick-intake.create', [], 'Penerimaan konsumen berhasil dibuat.');
        }

        return $this->jsonOrRedirect('service-orders.show', [$order->id], 'Penerimaan konsumen berhasil dibuat.', $order->toArray());
    }

    public function update(Request $request, $id)
    {
        $request->validate([
            'customer_id' => 'nullable|exists:customers,id',
            'vehicle_id' => 'nullable|exists:vehicles,id',
            'mechanic_id' => 'nullable|exists:mechanics,id',
            'odometer_km' => 'required_if:status,completed|nullable|integer|min:0|max:1000000',
            'estimated_start_at' => 'nullable|date',
            'estimated_finish_at' => 'nullable|date',
            'labor_cost' => 'nullable|integer|min:0',
            'notes' => 'nullable|string',
            'maintenance_type' => 'nullable|string',
            'next_service_km' => 'nullable|integer|min:0',
            'next_service_date' => 'nullable|date',
            'payment_method' => 'nullable|in:cash,credit,mixed',
            'applied_amount' => 'nullable|integer|min:0',
            'paid_amount' => 'nullable|integer|min:0',
            'payment_meta' => 'nullable|array',
            'transfer_destination' => 'nullable|in:qris,bni,bca,bri,edc_bri,transfer_bni,transfer_bca,transfer_bri',
            'tags' => 'nullable|array',
            'tags.*' => 'integer|exists:tags,id',
            'items' => 'required|array|min:1',
            'items.*.service_id' => 'nullable|exists:services,id',
            'items.*.service_discount_type' => 'nullable|in:none,percent,fixed',
            'items.*.service_discount_value' => 'nullable|numeric|min:0',
            'items.*.parts' => 'nullable|array',
            'items.*.parts.*.part_id' => 'nullable|exists:parts,id',
            'items.*.parts.*.qty' => 'required|integer|min:1',
            'items.*.parts.*.price' => 'required|integer|min:0',
            'items.*.parts.*.discount_type' => 'nullable|in:none,percent,fixed',
            'items.*.parts.*.discount_value' => 'nullable|numeric|min:0',
            'discount_type' => 'nullable|in:none,percent,fixed',
            'discount_value' => 'nullable|numeric|min:0',
            'tax_type' => 'nullable|in:none,percent,fixed',
            'tax_value' => 'nullable|numeric|min:0',
            'voucher_code' => 'nullable|string|max:50',
        ]);

        $this->validateDiscountBounds($request);

        $order = ServiceOrder::findOrFail($id);
        $this->voucherService->clearUsageBySource(ServiceOrder::class, (int) $order->id);
        $appliedAmount = (int) ($request->input('applied_amount') ?? $request->paid_amount ?? $order->paid_amount ?? 0);

        $paymentMeta = $this->normalizePaymentMeta(
            $request->payment_meta ?? null,
            $appliedAmount,
            $order->payment_meta ?? null
        );

        $order->update([
            'customer_id' => $request->customer_id,
            'vehicle_id' => $request->vehicle_id,
            'mechanic_id' => $request->mechanic_id,
            'odometer_km' => $request->odometer_km,
            'estimated_start_at' => $request->estimated_start_at,
            'estimated_finish_at' => $request->estimated_finish_at,
            'labor_cost' => $request->labor_cost ?? $order->labor_cost,
            'notes' => $request->notes,
            'maintenance_type' => $request->maintenance_type,
            'next_service_km' => $request->next_service_km,
            'next_service_date' => $request->next_service_date,
            'payment_method' => $request->payment_method ?? $order->payment_method ?? 'cash',
            'paid_amount' => $appliedAmount,
            'transfer_destination' => $request->transfer_destination ?? $order->transfer_destination ?? null,
            'payment_meta' => $paymentMeta,
            'discount_type' => $request->discount_type ?? 'none',
            'discount_value' => $request->discount_value ?? 0,
            'voucher_id' => null,
            'voucher_code' => null,
            'voucher_discount_amount' => 0,
            'tax_type' => $request->tax_type ?? 'none',
            'tax_value' => $request->tax_value ?? 0,
        ]);

        // Sync tags
        if ($request->tags) {
            $order->tags()->sync($request->tags);
        } else {
            $order->tags()->detach();
        }

        // Validate odometer progression
        if ($order->vehicle_id && $order->odometer_km !== null) {
            $prevOrderKm = ServiceOrder::where('vehicle_id', $order->vehicle_id)
                ->whereNotNull('odometer_km')
                ->where('id', '!=', $order->id)
                ->max('odometer_km');
            if ($prevOrderKm && $order->odometer_km < $prevOrderKm) {
                throw ValidationException::withMessages(['odometer_km' => 'Odometer tidak boleh kurang dari km sebelumnya (' . number_format($prevOrderKm, 0, ',', '.') . ' km).']);
            }
        }

        // Delete old items and create new ones
        if ($order->status === 'completed') {
            FIFOCostingService::releaseStockForReference(
                ServiceOrder::class,
                (int) $order->id,
                "Revisi Service Order: {$order->order_number}",
                Auth::id()
            );
            $this->warrantyRegistrationService->removeByServiceOrder($order->id);
        }

        $order->details()->delete();

        $this->calculateServiceOrderCosts($order, $request->items);
        $this->applyVoucherToServiceOrder($order, $request->voucher_code);

        if ($order->status === 'completed') {
            $this->deductPartsFromInventory($order);
            $this->syncWarrantyRegistrationsForFinalizedOrder($order);
        }

        $this->dispatchBroadcastSafely(
            fn () => ServiceOrderUpdated::dispatch($order->load(['customer', 'vehicle', 'mechanic', 'details.service', 'details.part'])->toArray()),
            'ServiceOrderUpdated'
        );

        return $this->jsonOrRedirect('service-orders.show', [$order->id], 'Service order updated.', $order->load(['customer', 'vehicle', 'mechanic', 'details.service', 'details.part'])->toArray());
    }

    private function normalizePaymentMeta(?array $paymentMeta, int $paidAmount, ?array $fallbackMeta = null): ?array
    {
        $meta = array_merge($fallbackMeta ?? [], $paymentMeta ?? []);

        if ($paidAmount > 0 && empty($meta['payment_received_at'])) {
            $meta['payment_received_at'] = now()->toISOString();
        }

        return empty($meta) ? null : $meta;
    }

    public function updateStatus(Request $request, $id)
    {
        $request->validate([
            'status' => 'required|in:pending,in_progress,completed,cancelled',
            'odometer_km' => 'nullable|integer|min:0|max:1000000',
        ]);

        $order = ServiceOrder::findOrFail($id);
        $oldStatus = $order->status;

        // If moving to completed, require odometer (either existing or provided now)
        if ($request->status === 'completed') {
            if (is_null($order->odometer_km) && is_null($request->odometer_km)) {
                throw ValidationException::withMessages(['odometer_km' => 'Odometer (km) wajib diisi saat menyelesaikan order.']);
            }
            if (!is_null($request->odometer_km)) {
                // Validate progression vs previous
                if ($order->vehicle_id) {
                    $prevOrderKm = ServiceOrder::where('vehicle_id', $order->vehicle_id)
                        ->whereNotNull('odometer_km')
                        ->where('id', '!=', $order->id)
                        ->max('odometer_km');
                    if ($prevOrderKm && (int)$request->odometer_km < $prevOrderKm) {
                        throw ValidationException::withMessages(['odometer_km' => 'Odometer tidak boleh kurang dari km sebelumnya (' . number_format($prevOrderKm, 0, ',', '.') . ' km).']);
                    }
                }
                $order->odometer_km = $request->odometer_km;
            }
        }

        $order->status = $request->status;

        // When status changes to completed, deduct parts from inventory
        // Only deduct if previous status was not completed (to avoid double deduction)
        if ($oldStatus !== 'completed' && $request->status === 'completed') {
            $this->deductPartsFromInventory($order);
        }

        $order->save();

        // Record status history
        ServiceOrderStatusHistory::create([
            'service_order_id' => $order->id,
            'old_status' => $oldStatus,
            'new_status' => $request->status,
            'user_id' => Auth::id(),
            'notes' => $request->notes ?? null,
        ]);

        if ($oldStatus !== 'completed' && $request->status === 'completed') {
            $this->syncWarrantyRegistrationsForFinalizedOrder($order);
        }

        if ($oldStatus === 'completed' && $request->status !== 'completed') {
            FIFOCostingService::releaseStockForReference(
                ServiceOrder::class,
                (int) $order->id,
                "Pembatalan penyelesaian Service Order: {$order->order_number}",
                Auth::id()
            );
            $order->details()
                ->whereNotNull('part_id')
                ->update([
                    'source_purchase_detail_id' => null,
                    'cost_price' => 0,
                ]);
            $this->warrantyRegistrationService->removeByServiceOrder($order->id);
        }

        return $this->jsonOrRedirect(null, [], 'Status updated.', $order->toArray());
    }

    public function updatePayment(Request $request, $id)
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

        $order = ServiceOrder::findOrFail($id);
        $paymentAmount = (int) $validated['payment_amount'];
        $paymentMeta = is_array($validated['payment_meta'] ?? null) ? $validated['payment_meta'] : [];

        $paymentState = clone $order;
        $paymentState->payment_meta = $paymentMeta;
        $settlementTotal = $paymentState->getPaymentSettlementTotal();
        $remainingBeforePayment = max(0, $settlementTotal - (int) $order->paid_amount);
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

        DB::transaction(function () use ($order, $paymentAmount, $paymentMeta, $netPaymentAmount, $changeFromThisPayment, $receivedRows, $request, $validated) {
            if ($receivedRows->isNotEmpty()) {
                $this->recordCashPaymentWithDenominations(
                    $order,
                    $paymentAmount,
                    $changeFromThisPayment,
                    $receivedRows,
                    (int) $request->user()->id
                );
            }

            $newPaidAmount = (int) $order->paid_amount + $netPaymentAmount;

            $order->paid_amount = $newPaidAmount;
            $order->payment_method = $validated['payment_method'] ?? $order->payment_method;
            $order->transfer_destination = $validated['transfer_destination'] ?? $order->transfer_destination;
            $order->payment_meta = $paymentMeta ?: $order->payment_meta;
            $order->applyPaymentSettlementStatus()->save();
        });

        return $this->jsonOrRedirect(null, [], 'Pembayaran berhasil dicatat');
    }

    private function recordCashPaymentWithDenominations(
        ServiceOrder $order,
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
            'source' => 'service-order-payment',
            'description' => "Pembayaran cash service order {$order->order_number}",
            'meta' => [
                'service_order_id' => $order->id,
                'order_number' => $order->order_number,
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
                'source' => 'service-order-change',
                'description' => "Kembalian cash service order {$order->order_number}",
                'meta' => [
                    'service_order_id' => $order->id,
                    'order_number' => $order->order_number,
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

    public function claimWarranty(Request $request, $id, $detailId)
    {
        $order = ServiceOrder::findOrFail($id);
        $detail = ServiceOrderDetail::with(['service', 'part'])->findOrFail($detailId);

        if ((int) $detail->service_order_id !== (int) $order->id) {
            throw ValidationException::withMessages([
                'error' => ['Detail garansi tidak valid untuk service order ini.'],
            ]);
        }

        $validated = $request->validate([
            'claim_notes' => 'nullable|string|max:1000',
        ]);

        $registration = WarrantyRegistration::query()
            ->where('source_type', ServiceOrder::class)
            ->where('source_id', $order->id)
            ->where('source_detail_id', $detail->id)
            ->first();

        if (!$registration) {
            throw ValidationException::withMessages([
                'error' => ['Item ini tidak memiliki registri garansi.'],
            ]);
        }

        if (!empty($registration->claimed_at) || $registration->status === 'claimed') {
            throw ValidationException::withMessages([
                'error' => ['Garansi item ini sudah pernah diklaim.'],
            ]);
        }

        $endDate = Carbon::parse($registration->warranty_end_date)->startOfDay();
        if (now()->startOfDay()->gt($endDate)) {
            throw ValidationException::withMessages([
                'error' => ['Masa garansi item ini sudah berakhir.'],
            ]);
        }

        $registration->update([
            'status' => 'claimed',
            'claimed_at' => now(),
            'claimed_by' => Auth::id(),
            'claim_notes' => $validated['claim_notes'] ?? null,
        ]);
        return $this->jsonOrRedirect(null, [], 'Klaim garansi berhasil dicatat', $registration->toArray());
    }

    public function destroy($id)
    {
        $order = ServiceOrder::findOrFail($id);
        $orderId = $order->id;
        $this->voucherService->clearUsageBySource(ServiceOrder::class, (int) $order->id);
        $order->delete();

        $this->dispatchBroadcastSafely(
            fn () => ServiceOrderDeleted::dispatch($orderId),
            'ServiceOrderDeleted'
        );

        return $this->jsonOrRedirect('service-orders.index', [], 'Service order deleted.');
    }

    /**
     * Calculate and update service order costs
     */
    private function calculateServiceOrderCosts($order, $items)
    {
        $laborCost = 0;
        $materialCost = 0;

        $selectedServiceIds = collect($items)
            ->pluck('service_id')
            ->filter()
            ->map(fn ($id) => (int) $id)
            ->unique()
            ->values()
            ->all();

        $servicesById = \App\Models\Service::with(['priceAdjustments.triggerService', 'mechanicIncentives'])
            ->whereIn('id', $selectedServiceIds)
            ->get()
            ->keyBy('id');

        $mechanic = $order->mechanic_id ? Mechanic::find($order->mechanic_id) : null;

        foreach ($items as $item) {
            // Add service if exists
            if (!empty($item['service_id'])) {
                $service = $servicesById->get((int) $item['service_id']);
                $servicePrice = $service ? (int) $service->price : 0;

                $autoDiscount = $service
                    ? WorkshopPricingService::calculateAutoDiscount($service, $servicePrice, $selectedServiceIds)
                    : [
                        'discount_amount' => 0,
                        'adjusted_price' => $servicePrice,
                        'notes' => null,
                    ];

                $serviceAmount = (int) ($autoDiscount['adjusted_price'] ?? $servicePrice);
                $serviceDiscountType = $item['service_discount_type'] ?? 'none';
                $serviceDiscountValue = $item['service_discount_value'] ?? 0;
                $serviceFinal = DiscountTaxService::calculateAmountWithDiscount(
                    $serviceAmount,
                    $serviceDiscountType,
                    $serviceDiscountValue
                );
                $serviceDiscountAmount = max(0, $serviceAmount - $serviceFinal);

                $incentivePercentage = $service
                    ? WorkshopPricingService::resolveIncentivePercentage($service, $mechanic)
                    : 0;
                $incentiveAmount = WorkshopPricingService::calculateIncentiveAmount($serviceFinal, $incentivePercentage);

                $detail = ServiceOrderDetail::create([
                    'service_order_id' => $order->id,
                    'service_id' => $item['service_id'],
                    'part_id' => null,
                    'qty' => 1,
                    'price' => $servicePrice,
                    'amount' => $serviceAmount,
                    'base_amount' => $servicePrice,
                    'auto_discount_amount' => (int) ($autoDiscount['discount_amount'] ?? 0),
                    'auto_discount_notes' => $autoDiscount['notes'] ?? null,
                    'discount_type' => $serviceDiscountType,
                    'discount_value' => $serviceDiscountValue,
                    'discount_amount' => $serviceDiscountAmount,
                    'final_amount' => $serviceFinal,
                    'incentive_percentage' => $incentivePercentage,
                    'incentive_amount' => $incentiveAmount,
                ]);

                $detail->calculateFinalAmount()->save();

                $laborCost += $serviceFinal;
            }

            // Add parts if exists
            if (!empty($item['parts']) && is_array($item['parts'])) {
                foreach ($item['parts'] as $part) {
                    $partPrice = (int)($part['price'] ?? 0);
                    $partQty = (int)($part['qty'] ?? 1);
                    $partAmount = $partPrice * $partQty;
                    $partDiscountType = $part['discount_type'] ?? 'none';
                    $partDiscountValue = $part['discount_value'] ?? 0;
                    $partFinal = DiscountTaxService::calculateAmountWithDiscount(
                        $partAmount,
                        $partDiscountType,
                        $partDiscountValue
                    );
                    $partDiscountAmount = max(0, $partAmount - $partFinal);

                    $detail = ServiceOrderDetail::create([
                        'service_order_id' => $order->id,
                        'service_id' => null,
                        'part_id' => $part['part_id'] ?? null,
                        'source_purchase_detail_id' => null,
                        'cost_price' => 0,
                        'selling_price' => $partQty > 0 ? (int) round($partFinal / $partQty) : $partPrice,
                        'qty' => $partQty,
                        'price' => $partPrice,
                        'amount' => $partAmount,
                        'base_amount' => $partAmount,
                        'auto_discount_amount' => 0,
                        'auto_discount_notes' => null,
                        'discount_type' => $partDiscountType,
                        'discount_value' => $partDiscountValue,
                        'discount_amount' => $partDiscountAmount,
                        'final_amount' => $partFinal,
                        'incentive_percentage' => 0,
                        'incentive_amount' => 0,
                    ]);

                    $detail->calculateFinalAmount()->save();

                    $materialCost += $partFinal;
                }
            }
        }

        $order->labor_cost = $laborCost;
        $order->material_cost = $materialCost;
        $order->recalculateTotals()->save();
    }

    private function validateDiscountBounds(Request $request): void
    {
        $errors = [];

        $topLevelDiscountType = $request->input('discount_type', 'none');
        $topLevelDiscountValue = (float) $request->input('discount_value', 0);
        if ($topLevelDiscountType === 'percent' && $topLevelDiscountValue > 100) {
            $errors['discount_value'] = 'The discount percentage must not be greater than 100.';
        }

        $topLevelTaxType = $request->input('tax_type', 'none');
        $topLevelTaxValue = (float) $request->input('tax_value', 0);
        if ($topLevelTaxType === 'percent' && $topLevelTaxValue > 100) {
            $errors['tax_value'] = 'The tax percentage must not be greater than 100.';
        }

        foreach ((array) $request->input('items', []) as $itemIndex => $item) {
            $serviceDiscountType = $item['service_discount_type'] ?? 'none';
            $serviceDiscountValue = (float) ($item['service_discount_value'] ?? 0);
            if ($serviceDiscountType === 'percent' && $serviceDiscountValue > 100) {
                $errors["items.$itemIndex.service_discount_value"] = 'The service discount percentage must not be greater than 100.';
            }

            foreach ((array) ($item['parts'] ?? []) as $partIndex => $part) {
                $partDiscountType = $part['discount_type'] ?? 'none';
                $partDiscountValue = (float) ($part['discount_value'] ?? 0);
                if ($partDiscountType === 'percent' && $partDiscountValue > 100) {
                    $errors["items.$itemIndex.parts.$partIndex.discount_value"] = 'The items.' . $itemIndex . '.parts.' . $partIndex . '.discount_value field must not be greater than 100.';
                }
            }
        }

        if (!empty($errors)) {
            throw ValidationException::withMessages($errors);
        }
    }

    /**
     * Deduct parts from inventory when service order is completed
     */
    private function deductPartsFromInventory($order)
    {
        $order->loadMissing('details.part');

        foreach ($order->details as $detail) {
            if ($detail->part_id) {
                if ((int) ($detail->source_purchase_detail_id ?? 0) > 0) {
                    continue;
                }

                $part = $detail->part ?: \App\Models\Part::find($detail->part_id);
                if ($part) {
                    $pricing = FIFOCostingService::consumeStock(
                        $part,
                        (int) $detail->qty,
                        ServiceOrder::class,
                        (int) $order->id,
                        "Service Order: {$order->order_number}",
                        Auth::id(),
                        null,
                        $detail,
                        (int) $detail->price
                    );

                    $detail->update([
                        'source_purchase_detail_id' => $pricing['source_purchase_detail_id'],
                        'cost_price' => $pricing['cost_price'],
                        'selling_price' => $detail->qty > 0 ? (int) round($detail->final_amount / $detail->qty) : (int) $detail->price,
                    ]);
                }
            }
        }
    }

    private function syncWarrantyRegistrationsForFinalizedOrder(ServiceOrder $order): void
    {
        $order->loadMissing('details.service', 'details.part');

        foreach ($order->details as $detail) {
            $this->warrantyRegistrationService->registerFromServiceOrderDetail($order, $detail);
        }
    }

    private function applyVoucherToServiceOrder(ServiceOrder $order, ?string $voucherCode): void
    {
        $context = $this->collectServiceOrderVoucherContext($order);

        $voucherResult = $this->voucherService->validateForTransaction($voucherCode, [
            'customer_id' => (int) ($order->customer_id ?? 0),
            'subtotal' => (int) ($order->total ?? 0),
            'part_ids' => $context['part_ids'],
            'part_category_ids' => $context['part_category_ids'],
            'service_ids' => $context['service_ids'],
            'service_category_ids' => $context['service_category_ids'],
            'transaction_discount_type' => $order->discount_type ?? 'none',
            'transaction_discount_value' => $order->discount_value ?? 0,
        ]);

        $voucher = $voucherResult['voucher'];
        $voucherDiscountAmount = (int) ($voucherResult['discount_amount'] ?? 0);

        $order->update([
            'voucher_id' => $voucher?->id,
            'voucher_code' => $voucher?->code,
            'voucher_discount_amount' => $voucher ? $voucherDiscountAmount : 0,
        ]);

        $order->recalculateTotals()->save();

        if ($voucher) {
            $this->voucherService->markUsed(
                $voucher,
                ServiceOrder::class,
                (int) $order->id,
                (int) ($order->customer_id ?? 0),
                $voucherDiscountAmount,
                [
                    'order_number' => $order->order_number,
                ]
            );
        }
    }

    private function collectServiceOrderVoucherContext(ServiceOrder $order): array
    {
        $order->loadMissing('details.service.category', 'details.part.category');

        $serviceIds = [];
        $serviceCategoryIds = [];
        $partIds = [];
        $partCategoryIds = [];

        foreach ($order->details as $detail) {
            if ($detail->service_id) {
                $serviceIds[] = (int) $detail->service_id;
                if ($detail->service && $detail->service->service_category_id) {
                    $serviceCategoryIds[] = (int) $detail->service->service_category_id;
                }
            }

            if ($detail->part_id) {
                $partIds[] = (int) $detail->part_id;
                if ($detail->part && $detail->part->part_category_id) {
                    $partCategoryIds[] = (int) $detail->part->part_category_id;
                }
            }
        }

        return [
            'service_ids' => array_values(array_unique($serviceIds)),
            'service_category_ids' => array_values(array_unique($serviceCategoryIds)),
            'part_ids' => array_values(array_unique($partIds)),
            'part_category_ids' => array_values(array_unique($partCategoryIds)),
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
