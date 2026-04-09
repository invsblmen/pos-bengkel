<?php

namespace App\Http\Controllers\Apps;

use App\Events\VehicleCreated;
use App\Events\VehicleUpdated;
use App\Events\VehicleDeleted;
use App\Http\Controllers\Controller;
use App\Models\Vehicle;
use App\Models\Customer;
use App\Support\DispatchesBroadcastSafely;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;

class VehicleController extends Controller
{
    use DispatchesBroadcastSafely;

    public function index(Request $request)
    {
        if ((bool) config('go_backend.features.vehicle_index', false)) {
            $proxied = $this->vehicleIndexViaGo($request);
            if ($proxied !== null) {
                return inertia('Dashboard/Vehicles/Index', $proxied);
            }
        }

        $sortBy = $request->input('sort_by', 'created_at');
        $sortDirection = $request->input('sort_direction', 'desc');
        $perPage = $request->input('per_page', 8);
        $search = $request->input('search');
        $brand = $request->input('brand');
        $year = $request->input('year');
        $transmission = $request->input('transmission');
        $serviceStatus = $request->input('service_status');

        $vehicles = Vehicle::with('customer')
            ->when($search, function ($query) use ($search) {
                $query->where('plate_number', 'like', '%' . $search . '%')
                    ->orWhere('brand', 'like', '%' . $search . '%')
                    ->orWhere('model', 'like', '%' . $search . '%')
                    ->orWhereHas('customer', function ($q) use ($search) {
                        $q->where('name', 'like', '%' . $search . '%');
                    });
            })
            ->when($brand, function ($query) use ($brand) {
                $query->where('brand', $brand);
            })
            ->when($year, function ($query) use ($year) {
                $query->where('year', $year);
            })
            ->when($transmission, function ($query) use ($transmission) {
                $query->where('transmission_type', $transmission);
            })
            ->orderBy($sortBy, $sortDirection)
            ->paginate($perPage);

        // Add service dates from latest service orders
        $vehicles->getCollection()->transform(function ($vehicle) {
            $calculatedData = $this->calculateVehicleDataFromOrders($vehicle);
            $vehicle->last_service_date = $calculatedData['last_service_date'];
            $vehicle->next_service_date = $calculatedData['next_service_date'];
            return $vehicle;
        });

        // Filter by service status if needed
        if (request('service_status')) {
            $filtered = $vehicles->getCollection()->filter(function ($vehicle) {
                if (request('service_status') === 'serviced') {
                    return !empty($vehicle->last_service_date);
                } elseif (request('service_status') === 'never') {
                    return empty($vehicle->last_service_date);
                }
                return true;
            });

            $vehicles->setCollection($filtered->values());
        }

        $stats = [
            'total'          => Vehicle::count(),
            'serviced'       => Vehicle::whereHas('serviceOrders', fn ($q) => $q->whereIn('status', ['completed', 'paid']))->count(),
            'never_serviced' => Vehicle::whereDoesntHave('serviceOrders', fn ($q) => $q->whereIn('status', ['completed', 'paid']))->count(),
            'this_month'     => Vehicle::whereHas('serviceOrders', fn ($q) => $q->whereMonth('created_at', now()->month)->whereYear('created_at', now()->year))->count(),
        ];

        return inertia('Dashboard/Vehicles/Index', [
            'vehicles' => $vehicles,
            'stats'    => $stats,
            'filters' => [
                'search' => $search,
                'brand' => $brand,
                'year' => $year,
                'transmission' => $transmission,
                'service_status' => $serviceStatus,
                'sort_by' => $sortBy,
                'sort_direction' => $sortDirection,
                'per_page' => $perPage,
            ],
        ]);
    }

    private function vehicleIndexViaGo(Request $request): ?array
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
                ->get($baseUrl . '/api/v1/vehicles', $request->query());

            $json = $response->json();
            if (! $response->successful() || ! is_array($json)) {
                Log::warning('Vehicle index Go bridge returned an invalid response', [
                    'status' => $response->status(),
                ]);

                return null;
            }

            if (! isset($json['vehicles'], $json['stats'], $json['filters'])) {
                Log::warning('Vehicle index Go bridge response is missing expected keys', [
                    'keys' => array_keys($json),
                ]);

                return null;
            }

            return $json;
        } catch (\Throwable $e) {
            return null;
        }
    }

    public function create()
    {
        $customers = Customer::orderBy('name')->get();

        return inertia('Dashboard/Vehicles/Create', [
            'customers' => $customers,
        ]);
    }

    public function store(Request $request)
    {
        if ((bool) config('go_backend.features.vehicle_store', false)) {
            $proxied = $this->vehicleStoreViaGo($request);
            if ($proxied !== null) {
                if ($proxied['status'] === 'validation_error') {
                    if ($request->expectsJson()) {
                        return response()->json([
                            'success' => false,
                            'message' => $proxied['message'] ?? 'Data kendaraan tidak valid.',
                            'errors' => $proxied['errors'] ?? [],
                        ], 422);
                    }

                    return back()->withInput()->withErrors($proxied['errors'] ?? ['plate_number' => 'Data kendaraan tidak valid.']);
                }

                $vehiclePayload = $proxied['vehicle'] ?? [
                    'customer_id' => $request->input('customer_id'),
                    'plate_number' => preg_replace('/\s+/', '', strtoupper((string) $request->input('plate_number'))),
                    'brand' => $request->input('brand'),
                    'model' => $request->input('model'),
                    'year' => $request->input('year'),
                    'color' => $request->input('color'),
                ];

                $this->dispatchBroadcastSafely(
                    fn () => event(new VehicleCreated($vehiclePayload)),
                    'VehicleCreated'
                );

                if ($request->expectsJson()) {
                    return response()->json([
                        'success' => true,
                        'message' => $proxied['message'] ?? 'Kendaraan berhasil ditambahkan!',
                        'vehicle' => $vehiclePayload,
                    ]);
                }

                return redirect()->route('vehicles.index')->with([
                    'success' => $proxied['message'] ?? 'Kendaraan berhasil ditambahkan!',
                    'vehicle' => $vehiclePayload,
                ]);
            }
        }

        $request->validate([
            'customer_id' => 'required|exists:customers,id',
            'plate_number' => 'required|string|max:20|unique:vehicles,plate_number|regex:/^[A-Z0-9]{1,20}$/i',
            'brand' => 'required|string|max:100',
            'model' => 'required|string|max:100',
            'year' => 'nullable|integer|min:1900|max:' . (date('Y') + 1),
            'color' => 'nullable|string|max:50',
            'engine_type' => 'nullable|string|max:100',
            'transmission_type' => 'nullable|in:manual,automatic,semi-automatic',
            'cylinder_volume' => 'nullable|integer|min:50|max:10000',
            'features' => 'nullable|array',
            'notes' => 'nullable|string',
            // STNK fields
            'chassis_number' => 'nullable|string|max:100',
            'engine_number' => 'nullable|string|max:100',
            'manufacture_year' => 'nullable|integer|min:1900|max:' . (date('Y') + 1),
            'registration_number' => 'nullable|string|max:100',
            'registration_date' => 'nullable|date',
            'stnk_expiry_date' => 'nullable|date',
            'previous_owner' => 'nullable|string|max:255',
        ], [
            'plate_number.regex' => 'Nomor plat hanya boleh berisi huruf dan angka (tanpa spasi).',
        ]);

        // Normalize plate number: remove all spaces and convert to uppercase
        $platNumber = preg_replace('/\s+/', '', strtoupper($request->plate_number));

        $vehicle = Vehicle::create([
            'customer_id' => $request->customer_id,
            'plate_number' => $platNumber,
            'brand' => $request->brand,
            'model' => $request->model,
            'year' => $request->year,
            'color' => $request->color,
            'engine_type' => $request->engine_type,
            'transmission_type' => $request->transmission_type,
            'cylinder_volume' => $request->cylinder_volume,
            'features' => $request->features,
            'notes' => $request->notes,
            // STNK fields
            'chassis_number' => $request->chassis_number,
            'engine_number' => $request->engine_number,
            'manufacture_year' => $request->manufacture_year,
            'registration_number' => $request->registration_number,
            'registration_date' => $request->registration_date,
            'stnk_expiry_date' => $request->stnk_expiry_date,
            'previous_owner' => $request->previous_owner,
        ]);

        $this->dispatchBroadcastSafely(
            fn () => event(new VehicleCreated([
                'id' => $vehicle->id,
                'customer_id' => $vehicle->customer_id,
                'plate_number' => $vehicle->plate_number,
                'brand' => $vehicle->brand,
                'model' => $vehicle->model,
                'year' => $vehicle->year,
                'color' => $vehicle->color,
            ])),
            'VehicleCreated'
        );

        // For AJAX/modal requests, return JSON
        if ($request->expectsJson()) {
            return response()->json([
                'success' => true,
                'message' => 'Kendaraan berhasil ditambahkan!',
                'vehicle' => $vehicle
            ]);
        }

        // For regular form submissions, redirect to vehicles list
        return redirect()->route('vehicles.index')->with([
            'success' => 'Kendaraan berhasil ditambahkan!',
            'vehicle' => $vehicle
        ]);
    }

    private function vehicleStoreViaGo(Request $request): ?array
    {
        $validated = $request->validate([
            'customer_id' => 'required|exists:customers,id',
            'plate_number' => 'required|string|max:20|unique:vehicles,plate_number|regex:/^[A-Z0-9]{1,20}$/i',
            'brand' => 'required|string|max:100',
            'model' => 'required|string|max:100',
            'year' => 'nullable|integer|min:1900|max:' . (date('Y') + 1),
            'color' => 'nullable|string|max:50',
            'engine_type' => 'nullable|string|max:100',
            'transmission_type' => 'nullable|in:manual,automatic,semi-automatic',
            'cylinder_volume' => 'nullable|integer|min:50|max:10000',
            'features' => 'nullable|array',
            'notes' => 'nullable|string',
            'chassis_number' => 'nullable|string|max:100',
            'engine_number' => 'nullable|string|max:100',
            'manufacture_year' => 'nullable|integer|min:1900|max:' . (date('Y') + 1),
            'registration_number' => 'nullable|string|max:100',
            'registration_date' => 'nullable|date',
            'stnk_expiry_date' => 'nullable|date',
            'previous_owner' => 'nullable|string|max:255',
        ], [
            'plate_number.regex' => 'Nomor plat hanya boleh berisi huruf dan angka (tanpa spasi).',
        ]);

        $validated['plate_number'] = preg_replace('/\s+/', '', strtoupper((string) $validated['plate_number']));

        try {
            $baseUrl = rtrim((string) config('go_backend.base_url', 'http://127.0.0.1:8081'), '/');
            $timeout = (int) config('go_backend.timeout_seconds', 5);
            $requestId = (string) ($request->header('X-Request-Id') ?: Str::uuid());

            $response = Http::timeout($timeout)
                ->acceptJson()
                ->withHeaders([
                    'X-Request-Id' => $requestId,
                ])
                ->post($baseUrl . '/api/v1/vehicles', $validated);

            $json = $response->json();
            if (! is_array($json)) {
                Log::warning('Vehicle store Go bridge returned a non-array response', [
                    'status' => $response->status(),
                ]);
                return null;
            }

            if ($response->status() === 422) {
                return [
                    'status' => 'validation_error',
                    'message' => $json['message'] ?? 'Data kendaraan tidak valid.',
                    'errors' => $json['errors'] ?? [],
                ];
            }

            if (! $response->successful()) {
                Log::warning('Vehicle store Go bridge returned an invalid response', [
                    'status' => $response->status(),
                    'keys' => array_keys($json),
                ]);
                return null;
            }

            return [
                'status' => 'ok',
                'message' => $json['message'] ?? 'Kendaraan berhasil ditambahkan!',
                'vehicle' => $json['vehicle'] ?? null,
            ];
        } catch (\Throwable $e) {
            Log::warning('Vehicle store Go bridge failed and fallback will be used', [
                'message' => $e->getMessage(),
            ]);
        }

        return null;
    }

    public function edit($id)
    {
        $vehicle = Vehicle::findOrFail($id);
        $customers = Customer::orderBy('name')->get();

        return inertia('Dashboard/Vehicles/Edit', [
            'vehicle' => $vehicle,
            'customers' => $customers,
        ]);
    }

    public function show($id)
    {
        if ((bool) config('go_backend.features.vehicle_detail', false)) {
            $proxied = $this->vehicleDetailViaGo((string) $id, request());
            if ($proxied !== null) {
                if (request()->expectsJson() || request()->wantsJson()) {
                    return response()->json($proxied);
                }

                return inertia('Dashboard/Vehicles/Show', [
                    'vehicle' => $proxied['vehicle'] ?? null,
                    'service_orders' => $proxied['service_orders'] ?? [],
                ]);
            }
        }

        $vehicle = Vehicle::with(['customer', 'serviceOrders' => function ($q) {
            $q->with(['mechanic:id,name', 'details.service:id,title,price', 'details.part:id,name,sell_price'])
              ->orderByDesc('created_at');
        }])->findOrFail($id);

        $serviceOrders = $vehicle->serviceOrders->map(function ($order) {
            return [
                'id' => $order->id,
                'order_number' => $order->order_number,
                'status' => $order->status,
                'odometer_km' => $order->odometer_km,
                'total' => (int) ($order->total ?? 0),
                'labor_cost' => (int) ($order->labor_cost ?? 0),
                'material_cost' => (int) ($order->material_cost ?? 0),
                'created_at' => optional($order->created_at)->toDateTimeString(),
                'actual_finish_at' => optional($order->actual_finish_at)->toDateTimeString(),
                'estimated_finish_at' => optional($order->estimated_finish_at)->toDateTimeString(),
                'mechanic' => $order->mechanic ? [
                    'id' => $order->mechanic->id,
                    'name' => $order->mechanic->name,
                ] : null,
                'details' => $order->details->map(function ($detail) {
                    return [
                        'id' => $detail->id,
                        'qty' => $detail->qty,
                        'price' => (int) $detail->price,
                        'service' => $detail->service ? [
                            'id' => $detail->service->id,
                            'title' => $detail->service->title,
                            'price' => (int) $detail->service->price,
                        ] : null,
                        'part' => $detail->part ? [
                            'id' => $detail->part->id,
                            'name' => $detail->part->name,
                            'price' => (int) $detail->part->sell_price,
                        ] : null,
                    ];
                }),
            ];
        });

        // Calculate real-time data from service orders
        $calculatedData = $this->calculateVehicleDataFromOrders($vehicle);

        return inertia('Dashboard/Vehicles/Show', [
            'vehicle' => [
                'id' => $vehicle->id,
                'plate_number' => $vehicle->plate_number,
                'brand' => $vehicle->brand,
                'model' => $vehicle->model,
                'year' => $vehicle->year,
                'color' => $vehicle->color,
                'km' => $calculatedData['km'],
                'engine_type' => $vehicle->engine_type,
                'transmission_type' => $vehicle->transmission_type,
                'cylinder_volume' => $vehicle->cylinder_volume,
                'last_service_date' => $calculatedData['last_service_date'],
                'next_service_date' => $calculatedData['next_service_date'],
                'features' => is_array($vehicle->features) ? $vehicle->features : (is_string($vehicle->features) ? json_decode($vehicle->features, true) ?? [] : []),
                'notes' => $vehicle->notes,
                'customer' => $vehicle->customer ? [
                    'id' => $vehicle->customer->id,
                    'name' => $vehicle->customer->name,
                    'phone' => $vehicle->customer->phone,
                ] : null,
            ],
            'service_orders' => $serviceOrders,
        ]);
    }

    private function vehicleDetailViaGo(string $vehicleId, Request $request): ?array
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
                ->get($baseUrl . '/api/v1/vehicles/' . urlencode($vehicleId));

            $json = $response->json();
            if (! $response->successful() || ! is_array($json)) {
                Log::warning('Vehicle detail Go bridge returned an invalid response', [
                    'status' => $response->status(),
                ]);

                return null;
            }

            if (! isset($json['vehicle'], $json['service_orders'])) {
                Log::warning('Vehicle detail Go bridge response is missing expected keys', [
                    'keys' => array_keys($json),
                ]);

                return null;
            }

            return $json;
        } catch (\Throwable $e) {
            Log::warning('Vehicle detail Go bridge failed and fallback will be used', [
                'message' => $e->getMessage(),
            ]);

            return null;
        }
    }

    public function update(Request $request, $id)
    {
        if ((bool) config('go_backend.features.vehicle_update', false)) {
            $proxied = $this->vehicleUpdateViaGo($request, (string) $id);
            if ($proxied !== null) {
                if ($proxied['status'] === 'validation_error') {
                    return back()->withInput()->withErrors($proxied['errors'] ?? ['plate_number' => 'Data kendaraan tidak valid.']);
                }

                if ($proxied['status'] === 'not_found') {
                    abort(404);
                }

                $vehiclePayload = $proxied['vehicle'] ?? [
                    'id' => (int) $id,
                    'customer_id' => $request->input('customer_id'),
                    'plate_number' => preg_replace('/\s+/', '', strtoupper((string) $request->input('plate_number'))),
                    'brand' => $request->input('brand'),
                    'model' => $request->input('model'),
                    'year' => $request->input('year'),
                    'color' => $request->input('color'),
                ];

                $this->dispatchBroadcastSafely(
                    fn () => event(new VehicleUpdated($vehiclePayload)),
                    'VehicleUpdated'
                );

                return redirect()->route('vehicles.index')->with('success', $proxied['message'] ?? 'Kendaraan berhasil diperbarui!');
            }
        }

        $vehicle = Vehicle::findOrFail($id);

        $request->validate([
            'customer_id' => 'required|exists:customers,id',
            'plate_number' => 'required|string|max:20|unique:vehicles,plate_number,' . $id . '|regex:/^[A-Z0-9]{1,20}$/i',
            'brand' => 'required|string|max:100',
            'model' => 'required|string|max:100',
            'year' => 'nullable|integer|min:1900|max:' . (date('Y') + 1),
            'color' => 'nullable|string|max:50',
            'engine_type' => 'nullable|string|max:100',
            'transmission_type' => 'nullable|in:manual,automatic,semi-automatic',
            'cylinder_volume' => 'nullable|integer|min:50|max:10000',
            'features' => 'nullable|array',
            'notes' => 'nullable|string',
            // STNK fields
            'chassis_number' => 'nullable|string|max:100',
            'engine_number' => 'nullable|string|max:100',
            'manufacture_year' => 'nullable|integer|min:1900|max:' . (date('Y') + 1),
            'registration_number' => 'nullable|string|max:100',
            'registration_date' => 'nullable|date',
            'stnk_expiry_date' => 'nullable|date',
            'previous_owner' => 'nullable|string|max:255',
        ], [
            'plate_number.regex' => 'Nomor plat hanya boleh berisi huruf dan angka (tanpa spasi).',
        ]);

        // Normalize plate number: remove all spaces and convert to uppercase
        $platNumber = preg_replace('/\s+/', '', strtoupper($request->plate_number));

        $vehicle->update([
            'customer_id' => $request->customer_id,
            'plate_number' => $platNumber,
            'brand' => $request->brand,
            'model' => $request->model,
            'year' => $request->year,
            'color' => $request->color,
            'engine_type' => $request->engine_type,
            'transmission_type' => $request->transmission_type,
            'cylinder_volume' => $request->cylinder_volume,
            'features' => $request->features,
            'notes' => $request->notes,
            // STNK fields
            'chassis_number' => $request->chassis_number,
            'engine_number' => $request->engine_number,
            'manufacture_year' => $request->manufacture_year,
            'registration_number' => $request->registration_number,
            'registration_date' => $request->registration_date,
            'stnk_expiry_date' => $request->stnk_expiry_date,
            'previous_owner' => $request->previous_owner,
        ]);

        // Broadcast vehicle updated event
        $this->dispatchBroadcastSafely(
            fn () => event(new VehicleUpdated([
                'id' => $vehicle->id,
                'customer_id' => $vehicle->customer_id,
                'plate_number' => $vehicle->plate_number,
                'brand' => $vehicle->brand,
                'model' => $vehicle->model,
                'year' => $vehicle->year,
                'color' => $vehicle->color,
            ])),
            'VehicleUpdated'
        );

        return redirect()->route('vehicles.index')->with('success', 'Kendaraan berhasil diperbarui!');
    }

    private function vehicleUpdateViaGo(Request $request, string $vehicleId): ?array
    {
        $validated = $request->validate([
            'customer_id' => 'required|exists:customers,id',
            'plate_number' => 'required|string|max:20|unique:vehicles,plate_number,' . $vehicleId . '|regex:/^[A-Z0-9]{1,20}$/i',
            'brand' => 'required|string|max:100',
            'model' => 'required|string|max:100',
            'year' => 'nullable|integer|min:1900|max:' . (date('Y') + 1),
            'color' => 'nullable|string|max:50',
            'engine_type' => 'nullable|string|max:100',
            'transmission_type' => 'nullable|in:manual,automatic,semi-automatic',
            'cylinder_volume' => 'nullable|integer|min:50|max:10000',
            'features' => 'nullable|array',
            'notes' => 'nullable|string',
            'chassis_number' => 'nullable|string|max:100',
            'engine_number' => 'nullable|string|max:100',
            'manufacture_year' => 'nullable|integer|min:1900|max:' . (date('Y') + 1),
            'registration_number' => 'nullable|string|max:100',
            'registration_date' => 'nullable|date',
            'stnk_expiry_date' => 'nullable|date',
            'previous_owner' => 'nullable|string|max:255',
        ], [
            'plate_number.regex' => 'Nomor plat hanya boleh berisi huruf dan angka (tanpa spasi).',
        ]);

        $validated['plate_number'] = preg_replace('/\s+/', '', strtoupper((string) $validated['plate_number']));

        $baseUrl = rtrim((string) config('go_backend.base_url', 'http://127.0.0.1:8081'), '/');
        $timeout = (int) config('go_backend.timeout_seconds', 5);
        $requestId = (string) ($request->header('X-Request-Id') ?: Str::uuid());

        try {
            $response = Http::timeout($timeout)
                ->acceptJson()
                ->withHeaders([
                    'X-Request-Id' => $requestId,
                ])
                ->put($baseUrl . '/api/v1/vehicles/' . urlencode($vehicleId), $validated);

            $json = $response->json();
            if (! is_array($json)) {
                Log::warning('Vehicle update Go bridge returned a non-array response', [
                    'status' => $response->status(),
                ]);

                return null;
            }

            if ($response->status() === 404) {
                return [
                    'status' => 'not_found',
                    'message' => $json['message'] ?? 'Kendaraan tidak ditemukan.',
                ];
            }

            if ($response->status() === 422) {
                return [
                    'status' => 'validation_error',
                    'message' => $json['message'] ?? 'Data kendaraan tidak valid.',
                    'errors' => $json['errors'] ?? [],
                ];
            }

            if (! $response->successful()) {
                Log::warning('Vehicle update Go bridge returned an invalid response', [
                    'status' => $response->status(),
                    'keys' => array_keys($json),
                ]);

                return null;
            }

            return [
                'status' => 'ok',
                'message' => $json['message'] ?? 'Kendaraan berhasil diperbarui!',
                'vehicle' => $json['vehicle'] ?? null,
            ];
        } catch (\Throwable $e) {
            Log::warning('Vehicle update Go bridge failed and fallback will be used', [
                'message' => $e->getMessage(),
            ]);

            return null;
        }
    }

    public function destroy($id)
    {
        if ((bool) config('go_backend.features.vehicle_destroy', false)) {
            $proxied = $this->vehicleDestroyViaGo((string) $id, request());
            if ($proxied !== null) {
                if ($proxied['status'] === 'not_found') {
                    abort(404);
                }

                $vehicleId = (int) ($proxied['vehicle_id'] ?? $id);
                if ($vehicleId > 0) {
                    $this->dispatchBroadcastSafely(
                        fn () => event(new VehicleDeleted($vehicleId)),
                        'VehicleDeleted'
                    );
                }

                return redirect()->route('vehicles.index')->with('success', $proxied['message'] ?? 'Kendaraan berhasil dihapus!');
            }
        }

        $vehicle = Vehicle::findOrFail($id);
        $vehicleId = $vehicle->id;
        $vehicle->delete();

        // Broadcast vehicle deleted event
        $this->dispatchBroadcastSafely(
            fn () => event(new VehicleDeleted($vehicleId)),
            'VehicleDeleted'
        );

        return redirect()->route('vehicles.index')->with('success', 'Kendaraan berhasil dihapus!');
    }

    private function vehicleDestroyViaGo(string $vehicleId, Request $request): ?array
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
                ->delete($baseUrl . '/api/v1/vehicles/' . urlencode($vehicleId));

            $json = $response->json();
            if (! is_array($json)) {
                Log::warning('Vehicle destroy Go bridge returned a non-array response', [
                    'status' => $response->status(),
                ]);

                return null;
            }

            if ($response->status() === 404) {
                return [
                    'status' => 'not_found',
                    'message' => $json['message'] ?? 'Kendaraan tidak ditemukan.',
                ];
            }

            if (! $response->successful()) {
                Log::warning('Vehicle destroy Go bridge returned an invalid response', [
                    'status' => $response->status(),
                    'keys' => array_keys($json),
                ]);

                return null;
            }

            return [
                'status' => 'ok',
                'message' => $json['message'] ?? 'Kendaraan berhasil dihapus!',
                'vehicle_id' => $json['vehicle_id'] ?? (int) $vehicleId,
            ];
        } catch (\Throwable $e) {
            Log::warning('Vehicle destroy Go bridge failed and fallback will be used', [
                'message' => $e->getMessage(),
            ]);

            return null;
        }
    }

    public function maintenanceInsights($id)
    {
        if ((bool) config('go_backend.features.vehicle_insights', false)) {
            $proxied = $this->maintenanceInsightsViaGo((string) $id, request());
            if ($proxied !== null) {
                return $proxied;
            }
        }

        $vehicle = Vehicle::findOrFail($id);

        // Get real-time vehicle data
        $calculatedData = $this->calculateVehicleDataFromOrders($vehicle);

        $orders = \App\Models\ServiceOrder::with('details.service', 'details.part')
            ->where('vehicle_id', $vehicle->id)
            ->whereNotNull('odometer_km')
            ->orderByDesc('odometer_km')
            ->limit(100)
            ->get(['id', 'odometer_km']);

        $lastKm = [
            'oil' => null,
            'air' => null,
            'spark' => null,
            'brakepad' => null,
            'belt' => null,
        ];

        $match = function ($text, $keywords) {
            $t = mb_strtolower($text ?? '');
            foreach ($keywords as $kw) {
                if (str_contains($t, mb_strtolower($kw))) return true;
            }
            return false;
        };

        foreach ($orders as $order) {
            foreach ($order->details as $detail) {
                $serviceTitle = $detail->service->title ?? '';
                $partName = $detail->part->name ?? '';

                if (is_null($lastKm['oil']) && ($match($serviceTitle, ['oli', 'oil']) || $match($partName, ['oli', 'oil']))) {
                    $lastKm['oil'] = $order->odometer_km;
                }
                if (is_null($lastKm['air']) && ($match($serviceTitle, ['filter udara', 'air filter']) || $match($partName, ['filter udara', 'air filter']))) {
                    $lastKm['air'] = $order->odometer_km;
                }
                if (is_null($lastKm['spark']) && ($match($serviceTitle, ['busi', 'spark']) || $match($partName, ['busi', 'spark']))) {
                    $lastKm['spark'] = $order->odometer_km;
                }
                if (is_null($lastKm['brakepad']) && ($match($serviceTitle, ['kampas rem', 'brake pad']) || $match($partName, ['kampas rem', 'brake pad']))) {
                    $lastKm['brakepad'] = $order->odometer_km;
                }
                if (is_null($lastKm['belt']) && ($match($serviceTitle, ['belt', 'v-belt', 'cvt']) || $match($partName, ['belt', 'v-belt', 'cvt']))) {
                    $lastKm['belt'] = $order->odometer_km;
                }
            }
        }

        return response()->json([
            'vehicle_km' => $calculatedData['km'],
            'last_service_date' => $calculatedData['last_service_date'],
            'next_service_date' => $calculatedData['next_service_date'],
            'last_km' => $lastKm,
        ]);
    }

    private function maintenanceInsightsViaGo(string $vehicleId, Request $request): ?\Illuminate\Http\JsonResponse
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
                ->get($baseUrl . '/api/v1/vehicles/' . urlencode($vehicleId) . '/maintenance-insights');

            $json = $response->json();
            if (is_array($json)) {
                return response()->json($json, $response->status());
            }

            return response()->json([
                'message' => 'Bridge ke Go aktif, tetapi respons maintenance insights tidak valid JSON object.',
            ], 502);
        } catch (\Throwable $e) {
            // Fallback ke local handler untuk memastikan endpoint tetap tersedia.
            return null;
        }
    }

    public function getWithHistory($id)
    {
        if ((bool) config('go_backend.features.vehicle_with_history', false)) {
            $proxied = $this->withHistoryViaGo((string) $id, request());
            if ($proxied !== null) {
                return $proxied;
            }
        }

        $vehicle = Vehicle::with('customer')->findOrFail($id);

        // Calculate real-time data from service orders
        $calculatedData = $this->calculateVehicleDataFromOrders($vehicle);

        // Get last 10 service orders
        $recentOrders = \App\Models\ServiceOrder::with('mechanic', 'details.service', 'details.part')
            ->where('vehicle_id', $vehicle->id)
            ->orderByDesc('created_at')
            ->limit(10)
            ->get()
            ->map(function ($order) {
                return [
                    'id' => $order->id,
                    'order_number' => $order->order_number,
                    'status' => $order->status,
                    'created_at' => $order->created_at->toDateString(),
                    'odometer_km' => $order->odometer_km,
                    'mechanic' => $order->mechanic ? ['name' => $order->mechanic->name] : null,
                    'total_cost' => $order->details->sum(function ($detail) {
                        $service_price = $detail->service->price ?? 0;
                        $part_cost = ($detail->part->sell_price ?? 0) * $detail->qty;
                        return $service_price + $part_cost;
                    }),
                ];
            });

        return response()->json([
            'vehicle' => [
                'id' => $vehicle->id,
                'plate_number' => $vehicle->plate_number,
                'brand' => $vehicle->brand,
                'model' => $vehicle->model,
                'km' => $calculatedData['km'],
                'last_service_date' => $calculatedData['last_service_date'],
                'next_service_date' => $calculatedData['next_service_date'],
            ],
            'recent_orders' => $recentOrders,
        ]);
    }

    private function withHistoryViaGo(string $vehicleId, Request $request): ?\Illuminate\Http\JsonResponse
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
                ->get($baseUrl . '/api/v1/vehicles/' . urlencode($vehicleId) . '/with-history');

            $json = $response->json();
            if (is_array($json)) {
                return response()->json($json, $response->status());
            }

            return response()->json([
                'vehicle' => null,
                'recent_orders' => [],
                'message' => 'Bridge ke Go aktif, tetapi respons with-history tidak valid JSON object.',
            ], 502);
        } catch (\Throwable $e) {
            // Fallback ke local handler untuk memastikan endpoint tetap tersedia.
            return null;
        }
    }

    /**
     * Calculate vehicle data from service orders (real-time)
     */
    private function calculateVehicleDataFromOrders($vehicle)
    {
        // Get all completed/paid service orders
        $orders = \App\Models\ServiceOrder::where('vehicle_id', $vehicle->id)
            ->whereIn('status', ['completed', 'paid'])
            ->whereNotNull('odometer_km')
            ->orderByDesc('created_at')
            ->get();

        // Calculate km from latest service order
        $latestKm = $orders->max('odometer_km');

        // Calculate last_service_date from latest completed order
        $lastServiceOrder = $orders->first();
        $lastServiceDate = null;
        if ($lastServiceOrder) {
            $date = $lastServiceOrder->actual_finish_at ?? $lastServiceOrder->created_at;
            $lastServiceDate = $date ? $date->toDateString() : null;
        }

        // Calculate next_service_date from upcoming orders or latest completed order
        $nextServiceDate = null;

        // First, check for pending/in_progress orders with next_service_date
        $upcomingOrder = \App\Models\ServiceOrder::where('vehicle_id', $vehicle->id)
            ->whereIn('status', ['pending', 'in_progress'])
            ->whereNotNull('next_service_date')
            ->orderBy('next_service_date', 'asc')
            ->first();

        if ($upcomingOrder && $upcomingOrder->next_service_date) {
            $nextServiceDate = $upcomingOrder->next_service_date->toDateString();
        } elseif ($lastServiceOrder && $lastServiceOrder->next_service_date) {
            // If no upcoming, get from latest completed order
            $nextServiceDate = $lastServiceOrder->next_service_date->toDateString();
        }

        return [
            'km' => $latestKm,
            'last_service_date' => $lastServiceDate,
            'next_service_date' => $nextServiceDate,
        ];
    }

    public function getServiceHistory($id)
    {
        if ((bool) config('go_backend.features.vehicle_service_history', false)) {
            $proxied = $this->serviceHistoryViaGo((string) $id, request());
            if ($proxied !== null) {
                return $proxied;
            }
        }

        try {
            $vehicle = Vehicle::findOrFail($id);

            // Get service orders with details
            $serviceOrders = \App\Models\ServiceOrder::with([
                'mechanic',
                'details.service',
                'details.part'
            ])
                ->where('vehicle_id', $vehicle->id)
                ->orderByDesc('created_at')
                ->limit(20)
                ->get()
                ->map(function ($order) {
                    return [
                        'id' => $order->id,
                        'order_number' => $order->order_number,
                        'status' => $order->status,
                        'created_at' => $order->created_at,
                        'odometer_km' => $order->odometer_km,
                        'total' => $order->total,
                        'notes' => $order->notes,
                        'mechanic' => $order->mechanic ? [
                            'id' => $order->mechanic->id,
                            'name' => $order->mechanic->name
                        ] : null,
                        'details' => $order->details->map(function ($detail) {
                            return [
                                'id' => $detail->id,
                                'service' => $detail->service ? [
                                    'id' => $detail->service->id,
                                    'name' => $detail->service->name
                                ] : null,
                                'part' => $detail->part ? [
                                    'id' => $detail->part->id,
                                    'name' => $detail->part->name
                                ] : null,
                                'quantity' => $detail->qty ?? 1,
                                'price' => $detail->final_amount ?? $detail->amount ?? 0,
                            ];
                        }),
                    ];
                });

            return response()->json([
                'service_orders' => $serviceOrders,
            ]);
        } catch (\Exception $e) {
            Log::error('Error fetching service history: ' . $e->getMessage());
            return response()->json([
                'service_orders' => [],
                'error' => $e->getMessage()
            ], 500);
        }
    }

    private function serviceHistoryViaGo(string $vehicleId, Request $request): ?\Illuminate\Http\JsonResponse
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
                ->get($baseUrl . '/api/v1/vehicles/' . urlencode($vehicleId) . '/service-history');

            $json = $response->json();
            if (is_array($json)) {
                return response()->json($json, $response->status());
            }

            return response()->json([
                'service_orders' => [],
                'message' => 'Bridge ke Go aktif, tetapi respons service history tidak valid JSON object.',
            ], 502);
        } catch (\Throwable $e) {
            // Fallback ke local handler untuk memastikan endpoint tetap tersedia.
            return null;
        }
    }
}
