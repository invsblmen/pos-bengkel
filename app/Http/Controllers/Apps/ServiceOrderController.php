<?php

namespace App\Http\Controllers\Apps;

use App\Events\ServiceOrderCreated;
use App\Events\ServiceOrderUpdated;
use App\Events\ServiceOrderDeleted;
use App\Http\Controllers\Controller;
use App\Models\BusinessProfile;
use App\Models\Mechanic;
use App\Models\WarrantyRegistration;
use App\Models\ServiceOrder;
use App\Models\ServiceOrderDetail;
use App\Models\ServiceOrderStatusHistory;
use App\Models\Voucher;
use App\Services\DiscountTaxService;
use App\Services\VoucherService;
use App\Services\WarrantyRegistrationService;
use App\Services\WorkshopPricingService;
use App\Support\DispatchesBroadcastSafely;
use Carbon\Carbon;
use Illuminate\Http\Request;
use Illuminate\Support\Str;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;

class ServiceOrderController extends Controller
{
    use DispatchesBroadcastSafely;

    public function __construct(
        private WarrantyRegistrationService $warrantyRegistrationService,
        private VoucherService $voucherService
    ) {
    }

    public function index(Request $request)
    {
        if ((bool) config('go_backend.features.service_order_index', false)) {
            $proxied = $this->serviceOrderIndexViaGo($request);
            if ($proxied !== null) {
                return Inertia::render('Dashboard/ServiceOrders/Index', $proxied);
            }
        }

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

        $orders = $query->orderByDesc('created_at')->paginate(15)->withQueryString();

        // Stats for dashboard cards
        $stats = [
            'pending' => ServiceOrder::where('status', 'pending')->count(),
            'in_progress' => ServiceOrder::where('status', 'in_progress')->count(),
            'completed' => ServiceOrder::where('status', 'completed')->count(),
            'paid' => ServiceOrder::where('status', 'paid')->count(),
            'total_revenue' => ServiceOrder::whereIn('status', ['completed', 'paid'])->sum('total'),
        ];

        return inertia('Dashboard/ServiceOrders/Index', [
            'orders' => $orders,
            'stats' => $stats,
            'mechanics' => \App\Models\Mechanic::all(['id', 'name']),
            'filters' => $request->only(['search', 'status', 'date_from', 'date_to', 'mechanic_id']),
        ]);
    }

    private function serviceOrderIndexViaGo(Request $request): ?array
    {
        try {
            $baseUrl = config('go_backend.base_url');
            $response = Http::timeout(config('go_backend.timeout_seconds'))
                ->acceptJson()
                ->get($baseUrl . '/api/v1/service-orders', $request->query());

            $json = $response->json();
            if (! $response->successful() || ! is_array($json)) {
                Log::warning('Service order index Go bridge returned an invalid response', [
                    'status' => $response->status(),
                    'body' => $response->body(),
                ]);
                return null;
            }

            if (! isset($json['orders'], $json['stats'], $json['mechanics'], $json['filters'])) {
                Log::warning('Service order index Go bridge response is missing expected keys', [
                    'keys' => array_keys($json),
                ]);
                return null;
            }

            return $json;
        } catch (\Exception $e) {
            Log::warning('Service order index proxy failed', ['error' => $e->getMessage()]);
        }

        return null;
    }

    public function create()
    {
        if ((bool) config('go_backend.features.service_order_create', false)) {
            $proxied = $this->serviceOrderCreateViaGo();
            if ($proxied !== null) {
                return Inertia::render('Dashboard/ServiceOrders/Create', $proxied);
            }
        }

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
            'availableVouchers' => Voucher::query()
                ->where('is_active', true)
                ->orderBy('code')
                ->get(['id', 'code', 'name', 'scope']),
        ]);
    }

    private function serviceOrderCreateViaGo(): ?array
    {
        try {
            $baseUrl = config('go_backend.base_url');
            $response = Http::timeout(config('go_backend.timeout_seconds'))
                ->acceptJson()
                ->get($baseUrl . '/api/v1/service-orders/create');

            $json = $response->json();
            if (! $response->successful() || ! is_array($json)) {
                Log::warning('Service order create Go bridge returned an invalid response', [
                    'status' => $response->status(),
                    'body' => $response->body(),
                ]);
                return null;
            }

            if (! isset($json['customers'], $json['vehicles'], $json['mechanics'], $json['services'], $json['parts'])) {
                Log::warning('Service order create Go bridge response is missing expected keys', [
                    'keys' => array_keys($json),
                ]);
                return null;
            }

            return $json;
        } catch (\Exception $e) {
            Log::warning('Service order create proxy failed', ['error' => $e->getMessage()]);
        }

        return null;
    }

    public function createQuick()
    {
        if ((bool) config('go_backend.features.service_order_quick_intake_create', false)) {
            $proxied = $this->serviceOrderCreateQuickViaGo();
            if ($proxied !== null) {
                return inertia('Dashboard/ServiceOrders/QuickIntake', $proxied);
            }
        }

        return inertia('Dashboard/ServiceOrders/QuickIntake', [
            'mechanics' => Mechanic::all(['id', 'name']),
        ]);
    }

    private function serviceOrderCreateQuickViaGo(): ?array
    {
        try {
            $baseUrl = config('go_backend.base_url');
            $response = Http::timeout(config('go_backend.timeout_seconds'))
                ->acceptJson()
                ->get($baseUrl . '/api/v1/service-orders/quick-intake');

            $json = $response->json();
            if (! $response->successful() || ! is_array($json)) {
                Log::warning('Service order quick intake create Go bridge returned an invalid response', [
                    'status' => $response->status(),
                    'body' => $response->body(),
                ]);

                return null;
            }

            if (! isset($json['mechanics']) || ! is_array($json['mechanics'])) {
                Log::warning('Service order quick intake create Go bridge response is missing expected keys', [
                    'keys' => array_keys($json),
                ]);

                return null;
            }

            return [
                'mechanics' => $json['mechanics'],
            ];
        } catch (\Exception $e) {
            Log::warning('Service order quick intake create proxy failed', ['error' => $e->getMessage()]);

            return null;
        }
    }

    public function edit($id)
    {
        if ((bool) config('go_backend.features.service_order_edit', false)) {
            $proxied = $this->serviceOrderEditViaGo($id);
            if ($proxied !== null) {
                return Inertia::render('Dashboard/ServiceOrders/Edit', $proxied);
            }
        }

        $order = ServiceOrder::with('customer', 'vehicle', 'mechanic', 'details.service', 'details.part', 'tags')
            ->findOrFail($id);

        return inertia('Dashboard/ServiceOrders/Edit', [
            'order' => $order,
            'customers' => \App\Models\Customer::with('vehicles')->get(),
            'vehicles' => \App\Models\Vehicle::with('customer')->get(),
            'mechanics' => \App\Models\Mechanic::all(),
            'services' => \App\Models\Service::all(),
            'parts' => \App\Models\Part::with('category')->get(),
            'tags' => \App\Models\Tag::all(),
            'availableVouchers' => Voucher::query()
                ->where('is_active', true)
                ->orderBy('code')
                ->get(['id', 'code', 'name', 'scope']),
        ]);
    }

    private function serviceOrderEditViaGo($id): ?array
    {
        try {
            $baseUrl = config('go_backend.base_url');
            $response = Http::timeout(config('go_backend.timeout_seconds'))
                ->acceptJson()
                ->get($baseUrl . '/api/v1/service-orders/' . $id . '/edit');

            $json = $response->json();
            if (! $response->successful() || ! is_array($json)) {
                Log::warning('Service order edit Go bridge returned an invalid response', [
                    'status' => $response->status(),
                    'body' => $response->body(),
                ]);
                return null;
            }

            if (! isset($json['order'], $json['customers'], $json['vehicles'], $json['mechanics'], $json['services'], $json['parts'], $json['tags'], $json['availableVouchers'])) {
                Log::warning('Service order edit Go bridge response is missing expected keys', [
                    'keys' => array_keys($json),
                ]);
                return null;
            }

            return $json;
        } catch (\Exception $e) {
            Log::warning('Service order edit proxy failed', ['error' => $e->getMessage()]);
        }

        return null;
    }

    public function show($id)
    {
        if ((bool) config('go_backend.features.service_order_show', false)) {
            $proxied = $this->serviceOrderShowViaGo($id);
            if ($proxied !== null) {
                return Inertia::render('Dashboard/ServiceOrders/Show', $proxied);
            }
        }

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
        ]);
    }

    private function serviceOrderShowViaGo($id): ?array
    {
        try {
            $baseUrl = config('go_backend.base_url');
            $response = Http::timeout(config('go_backend.timeout_seconds'))
                ->acceptJson()
                ->get($baseUrl . '/api/v1/service-orders/' . $id);

            $json = $response->json();
            if (! $response->successful() || ! is_array($json)) {
                Log::warning('Service order show Go bridge returned an invalid response', [
                    'status' => $response->status(),
                    'body' => $response->body(),
                ]);
                return null;
            }

            if (! isset($json['order'], $json['warrantyRegistrations'], $json['permissions'])) {
                Log::warning('Service order show Go bridge response is missing expected keys', [
                    'keys' => array_keys($json),
                ]);
                return null;
            }

            return $json;
        } catch (\Exception $e) {
            Log::warning('Service order show proxy failed', ['error' => $e->getMessage()]);
        }

        return null;
    }

    public function print($id)
    {
        if ((bool) config('go_backend.features.service_order_print', false)) {
            $proxied = $this->serviceOrderPrintViaGo($id);
            if ($proxied !== null) {
                return Inertia::render('Dashboard/ServiceOrders/Print', $proxied);
            }
        }

        $order = ServiceOrder::with('customer', 'vehicle', 'mechanic', 'details.service', 'details.part')
            ->findOrFail($id);
        $businessProfile = BusinessProfile::first();

        return inertia('Dashboard/ServiceOrders/Print', [
            'order' => $order,
            'businessProfile' => $businessProfile,
        ]);
    }

    private function serviceOrderPrintViaGo($id): ?array
    {
        try {
            $baseUrl = config('go_backend.base_url');
            $response = Http::timeout(config('go_backend.timeout_seconds'))
                ->acceptJson()
                ->get($baseUrl . '/api/v1/service-orders/' . $id . '/print');

            $json = $response->json();
            if (! $response->successful() || ! is_array($json)) {
                Log::warning('Service order print Go bridge returned an invalid response', [
                    'status' => $response->status(),
                    'body' => $response->body(),
                ]);
                return null;
            }

            if (! isset($json['order'], $json['businessProfile'])) {
                Log::warning('Service order print Go bridge response is missing expected keys', [
                    'keys' => array_keys($json),
                ]);
                return null;
            }

            return $json;
        } catch (\Exception $e) {
            Log::warning('Service order print proxy failed', ['error' => $e->getMessage()]);
        }

        return null;
    }

    public function store(Request $request)
    {
        if ((bool) config('go_backend.features.service_order_store', false)) {
            $proxied = $this->serviceOrderStoreViaGo($request);
            if ($proxied !== null) {
                if ($proxied['status'] === 'validation_error') {
                    return back()->withInput()->withErrors($proxied['errors'] ?? ['items' => 'Data service order tidak valid.']);
                }

                if ($proxied['status'] === 'already_processed') {
                    $orderId = (int) ($proxied['order_id'] ?? 0);
                    if ($orderId > 0) {
                        return redirect()->route('service-orders.show', $orderId)
                            ->with('info', $proxied['message'] ?? 'Permintaan sudah diproses sebelumnya.');
                    }
                }

                return redirect()->route('service-orders.index')->with('success', $proxied['message'] ?? 'Service order created.');
            }
        }

        $request->validate([
            'submission_token' => 'required|string|max:100',
            'customer_id' => 'nullable|exists:customers,id',
            'vehicle_id' => 'nullable|exists:vehicles,id',
            'mechanic_id' => 'nullable|exists:mechanics,id',
            'status' => 'nullable|in:pending,in_progress,completed,paid,cancelled',
            'odometer_km' => 'required|integer|min:0|max:1000000',
            'estimated_start_at' => 'nullable|date',
            'estimated_finish_at' => 'nullable|date',
            'labor_cost' => 'nullable|integer|min:0',
            'notes' => 'nullable|string',
            'maintenance_type' => 'nullable|string',
            'next_service_km' => 'nullable|integer|min:0',
            'next_service_date' => 'nullable|date',
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

        $submissionToken = (string) $request->input('submission_token');
        $userId = Auth::id() ?? 0;
        $processingKey = "service_order:store:processing:{$userId}:{$submissionToken}";
        $resultKey = "service_order:store:result:{$userId}:{$submissionToken}";

        $existingOrderId = Cache::get($resultKey);
        if ($existingOrderId) {
            return redirect()
                ->route('service-orders.show', $existingOrderId)
                ->with('info', 'Permintaan sudah diproses sebelumnya.');
        }

        if (!Cache::add($processingKey, 1, now()->addSeconds(30))) {
            return back()->with('warning', 'Permintaan sedang diproses. Mohon tunggu beberapa detik.');
        }

        try {

            $orderNumber = 'SO-' . strtoupper(Str::random(8));

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
                    return back()->withErrors(['odometer_km' => 'Odometer tidak boleh kurang dari km sebelumnya (' . number_format($prevOrderKm, 0, ',', '.') . ' km).'])->withInput();
                }
            }

            $this->calculateServiceOrderCosts($order, $request->items);
            $this->applyVoucherToServiceOrder($order, $request->voucher_code);

            // If created with completed or paid status, deduct parts from inventory
            if (in_array($order->status, ['completed', 'paid'])) {
                $this->deductPartsFromInventory($order);
                $this->syncWarrantyRegistrationsForFinalizedOrder($order);
            }

            $this->dispatchBroadcastSafely(
                fn () => ServiceOrderCreated::dispatch($order->load(['customer', 'vehicle', 'mechanic', 'details.service', 'details.part'])->toArray()),
                'ServiceOrderCreated'
            );

            Cache::put($resultKey, $order->id, now()->addMinutes(10));

            return redirect()->route('service-orders.index')->with('success', 'Service order created.');
        } finally {
            Cache::forget($processingKey);
        }
    }

    private function serviceOrderStoreViaGo(Request $request): ?array
    {
        $validated = $request->validate([
            'submission_token' => 'required|string|max:100',
            'customer_id' => 'nullable|exists:customers,id',
            'vehicle_id' => 'nullable|exists:vehicles,id',
            'mechanic_id' => 'nullable|exists:mechanics,id',
            'status' => 'nullable|in:pending,in_progress,completed,paid,cancelled',
            'odometer_km' => 'required|integer|min:0|max:1000000',
            'estimated_start_at' => 'nullable|date',
            'estimated_finish_at' => 'nullable|date',
            'labor_cost' => 'nullable|integer|min:0',
            'notes' => 'nullable|string',
            'maintenance_type' => 'nullable|string',
            'next_service_km' => 'nullable|integer|min:0',
            'next_service_date' => 'nullable|date',
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

        $baseUrl = rtrim((string) config('go_backend.base_url', 'http://127.0.0.1:8081'), '/');
        $timeout = (int) config('go_backend.timeout_seconds', 5);
        $requestId = (string) ($request->header('X-Request-Id') ?: Str::uuid());

        try {
            $response = Http::timeout($timeout)
                ->acceptJson()
                ->withHeaders([
                    'X-Request-Id' => $requestId,
                ])
                ->post($baseUrl . '/api/v1/service-orders', $validated);

            $json = $response->json();
            if (! is_array($json)) {
                Log::warning('Service order store Go bridge returned a non-array response', [
                    'status' => $response->status(),
                ]);

                return null;
            }

            if ($response->status() === 422) {
                return [
                    'status' => 'validation_error',
                    'message' => $json['message'] ?? 'Data service order tidak valid.',
                    'errors' => $json['errors'] ?? [],
                ];
            }

            if (($response->status() === 200 || $response->status() === 409) && (($json['status'] ?? '') === 'already_processed')) {
                return [
                    'status' => 'already_processed',
                    'message' => $json['message'] ?? 'Permintaan sudah diproses sebelumnya.',
                    'order_id' => $json['order_id'] ?? null,
                ];
            }

            if (! $response->successful()) {
                Log::warning('Service order store Go bridge returned an invalid response', [
                    'status' => $response->status(),
                    'keys' => array_keys($json),
                ]);

                return null;
            }

            return [
                'status' => 'ok',
                'message' => $json['message'] ?? 'Service order created.',
                'order' => $json['order'] ?? null,
            ];
        } catch (\Throwable $e) {
            Log::warning('Service order store Go bridge failed and fallback will be used', [
                'message' => $e->getMessage(),
            ]);

            return null;
        }
    }

    public function storeQuick(Request $request)
    {
        if ((bool) config('go_backend.features.service_order_quick_intake_store', false)) {
            $proxied = $this->serviceOrderStoreQuickViaGo($request);
            if ($proxied !== null) {
                if ($proxied['status'] === 'validation_error') {
                    return back()->withInput()->withErrors($proxied['errors'] ?? ['customer_name' => 'Data quick intake tidak valid.']);
                }

                $orderPayload = $proxied['order'] ?? null;
                if (is_array($orderPayload)) {
                    $this->dispatchBroadcastSafely(
                        fn () => ServiceOrderCreated::dispatch($orderPayload),
                        'ServiceOrderCreated'
                    );
                }

                if (($proxied['submit_mode'] ?? 'view_detail') === 'create_again') {
                    return redirect()
                        ->route('service-orders.quick-intake.create')
                        ->with('success', $proxied['message'] ?? 'Penerimaan konsumen berhasil dibuat.');
                }

                $targetOrderId = (int) ($proxied['order_id'] ?? 0);
                if ($targetOrderId > 0) {
                    return redirect()
                        ->route('service-orders.show', $targetOrderId)
                        ->with('success', $proxied['message'] ?? 'Penerimaan konsumen berhasil dibuat.');
                }
            }
        }

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
            return redirect()
                ->route('service-orders.quick-intake.create')
                ->with('success', 'Penerimaan konsumen berhasil dibuat.');
        }

        return redirect()
            ->route('service-orders.show', $order->id)
            ->with('success', 'Penerimaan konsumen berhasil dibuat.');
    }

    private function serviceOrderStoreQuickViaGo(Request $request): ?array
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

        $baseUrl = rtrim((string) config('go_backend.base_url', 'http://127.0.0.1:8081'), '/');
        $timeout = (int) config('go_backend.timeout_seconds', 5);
        $requestId = (string) ($request->header('X-Request-Id') ?: Str::uuid());

        try {
            $response = Http::timeout($timeout)
                ->acceptJson()
                ->withHeaders([
                    'X-Request-Id' => $requestId,
                ])
                ->post($baseUrl . '/api/v1/service-orders/quick-intake', $validated);

            $json = $response->json();
            if (! is_array($json)) {
                Log::warning('Service order quick intake store Go bridge returned a non-array response', [
                    'status' => $response->status(),
                ]);

                return null;
            }

            if ($response->status() === 422) {
                return [
                    'status' => 'validation_error',
                    'message' => $json['message'] ?? 'Data quick intake tidak valid.',
                    'errors' => $json['errors'] ?? [],
                ];
            }

            if (! $response->successful()) {
                Log::warning('Service order quick intake store Go bridge returned an invalid response', [
                    'status' => $response->status(),
                    'keys' => array_keys($json),
                ]);

                return null;
            }

            return [
                'status' => 'ok',
                'message' => $json['message'] ?? 'Penerimaan konsumen berhasil dibuat.',
                'order_id' => $json['order_id'] ?? null,
                'order' => $json['order'] ?? null,
                'submit_mode' => $json['submit_mode'] ?? ($validated['submit_mode'] ?? 'view_detail'),
            ];
        } catch (\Throwable $e) {
            Log::warning('Service order quick intake store Go bridge failed and fallback will be used', [
                'message' => $e->getMessage(),
            ]);

            return null;
        }
    }

    public function update(Request $request, $id)
    {
        if ((bool) config('go_backend.features.service_order_update', false)) {
            $proxied = $this->serviceOrderUpdateViaGo($request, (string) $id);
            if ($proxied !== null) {
                if ($proxied['status'] === 'validation_error') {
                    return back()->withInput()->withErrors($proxied['errors'] ?? ['items' => 'Data service order tidak valid.']);
                }

                if ($proxied['status'] === 'not_found') {
                    abort(404);
                }

                $orderPayload = $proxied['order'] ?? ['id' => (int) $id];
                $this->dispatchBroadcastSafely(
                    fn () => ServiceOrderUpdated::dispatch($orderPayload),
                    'ServiceOrderUpdated'
                );

                $targetOrderId = (int) ($orderPayload['id'] ?? $id);
                return redirect()->route('service-orders.show', $targetOrderId)->with('success', $proxied['message'] ?? 'Service order updated.');
            }
        }

        $request->validate([
            'customer_id' => 'nullable|exists:customers,id',
            'vehicle_id' => 'nullable|exists:vehicles,id',
            'mechanic_id' => 'nullable|exists:mechanics,id',
            'odometer_km' => 'required_if:status,completed,paid|nullable|integer|min:0|max:1000000',
            'estimated_start_at' => 'nullable|date',
            'estimated_finish_at' => 'nullable|date',
            'labor_cost' => 'nullable|integer|min:0',
            'notes' => 'nullable|string',
            'maintenance_type' => 'nullable|string',
            'next_service_km' => 'nullable|integer|min:0',
            'next_service_date' => 'nullable|date',
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

        $order = ServiceOrder::findOrFail($id);
        $this->voucherService->clearUsageBySource(ServiceOrder::class, (int) $order->id);

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
                return back()->withErrors(['odometer_km' => 'Odometer tidak boleh kurang dari km sebelumnya (' . number_format($prevOrderKm, 0, ',', '.') . ' km).'])->withInput();
            }
        }

        // Delete old items and create new ones
        $order->details()->delete();

        $this->calculateServiceOrderCosts($order, $request->items);
        $this->applyVoucherToServiceOrder($order, $request->voucher_code);

        $this->dispatchBroadcastSafely(
            fn () => ServiceOrderUpdated::dispatch($order->load(['customer', 'vehicle', 'mechanic', 'details.service', 'details.part'])->toArray()),
            'ServiceOrderUpdated'
        );

        return redirect()->route('service-orders.show', $order->id)->with('success', 'Service order updated.');
    }

    private function serviceOrderUpdateViaGo(Request $request, string $orderId): ?array
    {
        $validated = $request->validate([
            'customer_id' => 'nullable|exists:customers,id',
            'vehicle_id' => 'nullable|exists:vehicles,id',
            'mechanic_id' => 'nullable|exists:mechanics,id',
            'odometer_km' => 'required_if:status,completed,paid|nullable|integer|min:0|max:1000000',
            'estimated_start_at' => 'nullable|date',
            'estimated_finish_at' => 'nullable|date',
            'labor_cost' => 'nullable|integer|min:0',
            'notes' => 'nullable|string',
            'maintenance_type' => 'nullable|string',
            'next_service_km' => 'nullable|integer|min:0',
            'next_service_date' => 'nullable|date',
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

        $baseUrl = rtrim((string) config('go_backend.base_url', 'http://127.0.0.1:8081'), '/');
        $timeout = (int) config('go_backend.timeout_seconds', 5);
        $requestId = (string) ($request->header('X-Request-Id') ?: Str::uuid());

        try {
            $response = Http::timeout($timeout)
                ->acceptJson()
                ->withHeaders([
                    'X-Request-Id' => $requestId,
                ])
                ->put($baseUrl . '/api/v1/service-orders/' . urlencode($orderId), $validated);

            $json = $response->json();
            if (! is_array($json)) {
                Log::warning('Service order update Go bridge returned a non-array response', [
                    'status' => $response->status(),
                ]);

                return null;
            }

            if ($response->status() === 404) {
                return [
                    'status' => 'not_found',
                    'message' => $json['message'] ?? 'Service order tidak ditemukan.',
                ];
            }

            if ($response->status() === 422) {
                return [
                    'status' => 'validation_error',
                    'message' => $json['message'] ?? 'Data service order tidak valid.',
                    'errors' => $json['errors'] ?? [],
                ];
            }

            if (! $response->successful()) {
                Log::warning('Service order update Go bridge returned an invalid response', [
                    'status' => $response->status(),
                    'keys' => array_keys($json),
                ]);

                return null;
            }

            return [
                'status' => 'ok',
                'message' => $json['message'] ?? 'Service order updated.',
                'order' => $json['order'] ?? null,
            ];
        } catch (\Throwable $e) {
            Log::warning('Service order update Go bridge failed and fallback will be used', [
                'message' => $e->getMessage(),
            ]);

            return null;
        }
    }

    public function updateStatus(Request $request, $id)
    {
        if ((bool) config('go_backend.features.service_order_update_status', false)) {
            $proxied = $this->serviceOrderUpdateStatusViaGo($request, (string) $id);
            if ($proxied !== null) {
                if ($proxied['status'] === 'validation_error') {
                    return back()->withInput()->withErrors($proxied['errors'] ?? ['status' => 'Status service order tidak valid.']);
                }

                if ($proxied['status'] === 'not_found') {
                    abort(404);
                }

                return back()->with('success', $proxied['message'] ?? 'Status updated.');
            }
        }

        $request->validate([
            'status' => 'required|in:pending,in_progress,completed,paid,cancelled',
            'odometer_km' => 'nullable|integer|min:0|max:1000000',
        ]);

        $order = ServiceOrder::findOrFail($id);
        $oldStatus = $order->status;

        // If moving to completed/paid, require odometer (either existing or provided now)
        if (in_array($request->status, ['completed', 'paid'])) {
            if (is_null($order->odometer_km) && is_null($request->odometer_km)) {
                return back()->withErrors(['odometer_km' => 'Odometer (km) wajib diisi saat menyelesaikan atau menandai order sebagai dibayar.'])->withInput();
            }
            if (!is_null($request->odometer_km)) {
                // Validate progression vs previous
                if ($order->vehicle_id) {
                    $prevOrderKm = ServiceOrder::where('vehicle_id', $order->vehicle_id)
                        ->whereNotNull('odometer_km')
                        ->where('id', '!=', $order->id)
                        ->max('odometer_km');
                    if ($prevOrderKm && (int)$request->odometer_km < $prevOrderKm) {
                        return back()->withErrors(['odometer_km' => 'Odometer tidak boleh kurang dari km sebelumnya (' . number_format($prevOrderKm, 0, ',', '.') . ' km).'])->withInput();
                    }
                }
                $order->odometer_km = $request->odometer_km;
            }
        }

        $order->status = $request->status;

        // When status changes to completed or paid, deduct parts from inventory
        // Only deduct if previous status was not completed or paid (to avoid double deduction)
        if (!in_array($oldStatus, ['completed', 'paid']) && in_array($request->status, ['completed', 'paid'])) {
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

        if (!in_array($oldStatus, ['completed', 'paid']) && in_array($request->status, ['completed', 'paid'])) {
            $this->syncWarrantyRegistrationsForFinalizedOrder($order);
        }

        if (in_array($oldStatus, ['completed', 'paid']) && !in_array($request->status, ['completed', 'paid'])) {
            $this->warrantyRegistrationService->removeByServiceOrder($order->id);
        }

        return back()->with('success', 'Status updated.');
    }

    private function serviceOrderUpdateStatusViaGo(Request $request, string $orderId): ?array
    {
        $validated = $request->validate([
            'status' => 'required|in:pending,in_progress,completed,paid,cancelled',
            'odometer_km' => 'nullable|integer|min:0|max:1000000',
            'notes' => 'nullable|string',
        ]);

        $baseUrl = rtrim((string) config('go_backend.base_url', 'http://127.0.0.1:8081'), '/');
        $timeout = (int) config('go_backend.timeout_seconds', 5);
        $requestId = (string) ($request->header('X-Request-Id') ?: Str::uuid());

        try {
            $response = Http::timeout($timeout)
                ->acceptJson()
                ->withHeaders([
                    'X-Request-Id' => $requestId,
                ])
                ->post($baseUrl . '/api/v1/service-orders/' . urlencode($orderId) . '/status', $validated);

            $json = $response->json();
            if (! is_array($json)) {
                Log::warning('Service order update status Go bridge returned a non-array response', [
                    'status' => $response->status(),
                ]);

                return null;
            }

            if ($response->status() === 404) {
                return [
                    'status' => 'not_found',
                    'message' => $json['message'] ?? 'Service order tidak ditemukan.',
                ];
            }

            if ($response->status() === 422) {
                return [
                    'status' => 'validation_error',
                    'message' => $json['message'] ?? 'Data status service order tidak valid.',
                    'errors' => $json['errors'] ?? [],
                ];
            }

            if (! $response->successful()) {
                Log::warning('Service order update status Go bridge returned an invalid response', [
                    'status' => $response->status(),
                    'keys' => array_keys($json),
                ]);

                return null;
            }

            return [
                'status' => 'ok',
                'message' => $json['message'] ?? 'Status updated.',
                'order' => $json['order'] ?? null,
            ];
        } catch (\Throwable $e) {
            Log::warning('Service order update status Go bridge failed and fallback will be used', [
                'message' => $e->getMessage(),
            ]);

            return null;
        }
    }

    public function claimWarranty(Request $request, $id, $detailId)
    {
        if ((bool) config('go_backend.features.service_order_claim_warranty', false)) {
            $proxied = $this->serviceOrderClaimWarrantyViaGo($request, (string) $id, (string) $detailId);
            if ($proxied !== null) {
                if ($proxied['status'] === 'validation_error') {
                    return back()->withErrors($proxied['errors'] ?? ['error' => 'Data klaim garansi tidak valid.'])->withInput();
                }

                if ($proxied['status'] === 'not_found') {
                    abort(404);
                }

                return back()->with('success', $proxied['message'] ?? 'Klaim garansi berhasil dicatat');
            }
        }

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

        return back()->with('success', 'Klaim garansi berhasil dicatat');
    }

    private function serviceOrderClaimWarrantyViaGo(Request $request, string $orderId, string $detailId): ?array
    {
        $validated = $request->validate([
            'claim_notes' => 'nullable|string|max:1000',
        ]);

        $baseUrl = rtrim((string) config('go_backend.base_url', 'http://127.0.0.1:8081'), '/');
        $timeout = (int) config('go_backend.timeout_seconds', 5);
        $requestId = (string) ($request->header('X-Request-Id') ?: Str::uuid());

        $payload = [
            'claim_notes' => $validated['claim_notes'] ?? null,
        ];

        try {
            $response = Http::timeout($timeout)
                ->acceptJson()
                ->withHeaders([
                    'X-Request-Id' => $requestId,
                ])
                ->post($baseUrl . '/api/v1/service-orders/' . urlencode($orderId) . '/details/' . urlencode($detailId) . '/claim-warranty', $payload);

            $json = $response->json();
            if (! is_array($json)) {
                Log::warning('Service order claim warranty Go bridge returned a non-array response', [
                    'status' => $response->status(),
                ]);

                return null;
            }

            if ($response->status() === 404) {
                return [
                    'status' => 'not_found',
                    'message' => $json['message'] ?? 'Data garansi tidak ditemukan.',
                ];
            }

            if ($response->status() === 422) {
                return [
                    'status' => 'validation_error',
                    'message' => $json['message'] ?? 'Data klaim garansi tidak valid.',
                    'errors' => $json['errors'] ?? [],
                ];
            }

            if (! $response->successful()) {
                Log::warning('Service order claim warranty Go bridge returned an invalid response', [
                    'status' => $response->status(),
                    'keys' => array_keys($json),
                ]);

                return null;
            }

            return [
                'status' => 'ok',
                'message' => $json['message'] ?? 'Klaim garansi berhasil dicatat',
            ];
        } catch (\Throwable $e) {
            Log::warning('Service order claim warranty Go bridge failed and fallback will be used', [
                'message' => $e->getMessage(),
            ]);

            return null;
        }
    }

    public function destroy($id)
    {
        if ((bool) config('go_backend.features.service_order_destroy', false)) {
            $proxied = $this->serviceOrderDestroyViaGo((string) $id, request());
            if ($proxied !== null) {
                if ($proxied['status'] === 'not_found') {
                    abort(404);
                }

                $orderId = (int) ($proxied['order_id'] ?? $id);
                if ($orderId > 0) {
                    $this->dispatchBroadcastSafely(
                        fn () => ServiceOrderDeleted::dispatch($orderId),
                        'ServiceOrderDeleted'
                    );
                }

                return redirect()->route('service-orders.index')->with('success', $proxied['message'] ?? 'Service order deleted.');
            }
        }

        $order = ServiceOrder::findOrFail($id);
        $orderId = $order->id;
        $this->voucherService->clearUsageBySource(ServiceOrder::class, (int) $order->id);
        $order->delete();

        $this->dispatchBroadcastSafely(
            fn () => ServiceOrderDeleted::dispatch($orderId),
            'ServiceOrderDeleted'
        );

        return redirect()->route('service-orders.index')->with('success', 'Service order deleted.');
    }

    private function serviceOrderDestroyViaGo(string $orderId, Request $request): ?array
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
                ->delete($baseUrl . '/api/v1/service-orders/' . urlencode($orderId));

            $json = $response->json();
            if (! is_array($json)) {
                Log::warning('Service order destroy Go bridge returned a non-array response', [
                    'status' => $response->status(),
                ]);

                return null;
            }

            if ($response->status() === 404) {
                return [
                    'status' => 'not_found',
                    'message' => $json['message'] ?? 'Service order not found.',
                ];
            }

            if (! $response->successful()) {
                Log::warning('Service order destroy Go bridge returned an invalid response', [
                    'status' => $response->status(),
                    'keys' => array_keys($json),
                ]);

                return null;
            }

            return [
                'status' => 'ok',
                'message' => $json['message'] ?? 'Service order deleted.',
                'order_id' => $json['order_id'] ?? (int) $orderId,
            ];
        } catch (\Throwable $e) {
            Log::warning('Service order destroy Go bridge failed and fallback will be used', [
                'message' => $e->getMessage(),
            ]);

            return null;
        }
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

    /**
     * Deduct parts from inventory when service order is completed
     */
    private function deductPartsFromInventory($order)
    {
        foreach ($order->details as $detail) {
            if ($detail->part_id) {
                $part = \App\Models\Part::find($detail->part_id);
                if ($part) {
                    // Deduct from inventory
                    $part->stock -= $detail->qty;
                    $part->save();

                    // Record stock movement
                    \App\Models\PartStockMovement::create([
                        'part_id' => $part->id,
                        'type' => 'out',
                        'qty' => $detail->qty,
                        'before_stock' => $part->stock + $detail->qty,
                        'after_stock' => $part->stock,
                        'reference_type' => ServiceOrder::class,
                        'reference_id' => $order->id,
                        'notes' => "Service Order: {$order->order_number}",
                        'created_by' => Auth::id(),
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

}

