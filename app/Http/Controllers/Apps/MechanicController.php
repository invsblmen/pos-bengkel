<?php

namespace App\Http\Controllers\Apps;

use App\Http\Controllers\Controller;
use App\Models\Mechanic;
use App\Events\MechanicCreated;
use App\Events\MechanicUpdated;
use App\Events\MechanicDeleted;
use App\Support\DispatchesBroadcastSafely;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;
use Inertia\Inertia;

class MechanicController extends Controller
{
    use DispatchesBroadcastSafely;

    public function index(Request $request)
    {
        if ((bool) config('go_backend.features.mechanic_index', false)) {
            $proxied = $this->mechanicIndexViaGo($request);
            if ($proxied !== null) {
                return Inertia::render('Dashboard/Mechanics/Index', $proxied);
            }
        }

        $q = $request->query('q', '');

        $query = Mechanic::orderBy('name');
        if ($q) {
            $query->where(function ($sub) use ($q) {
                $sub->where('name', 'like', "%{$q}%")
                    ->orWhere('phone', 'like', "%{$q}%")
                    ->orWhere('employee_number', 'like', "%{$q}%");
            });
        }

        $mechanics = $query->paginate(15)->withQueryString();

        return Inertia::render('Dashboard/Mechanics/Index', [
            'mechanics' => $mechanics,
            'filters' => ['q' => $q],
        ]);
    }

    private function mechanicIndexViaGo(Request $request): ?array
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
                ->get($baseUrl . '/api/v1/mechanics', $request->only(['q', 'page']));

            $json = $response->json();
            if (! $response->successful() || ! is_array($json)) {
                Log::warning('Mechanic index Go bridge returned an invalid response', [
                    'status' => $response->status(),
                ]);

                return null;
            }

            if (! isset($json['mechanics'], $json['filters'])) {
                Log::warning('Mechanic index Go bridge response is missing expected keys', [
                    'keys' => array_keys($json),
                ]);

                return null;
            }

            return $json;
        } catch (\Throwable $e) {
            Log::warning('Mechanic index Go bridge failed and fallback will be used', [
                'message' => $e->getMessage(),
            ]);

            return null;
        }
    }

    public function create()
    {
        return Inertia::render('Dashboard/Mechanics/Create');
    }

    public function store(Request $request)
    {
        if ((bool) config('go_backend.features.mechanic_store', false)) {
            $proxied = $this->mechanicStoreViaGo($request);
            if ($proxied !== null) {
                if ($proxied['status'] === 'validation_error') {
                    return back()->withInput()->withErrors($proxied['errors'] ?? ['name' => 'Data mechanic tidak valid.']);
                }

                $mechanicPayload = $proxied['mechanic'] ?? [
                    'name' => $request->input('name'),
                    'phone' => $request->input('phone'),
                    'employee_number' => $request->input('employee_number'),
                    'notes' => $request->input('notes'),
                    'hourly_rate' => $request->input('hourly_rate'),
                    'commission_percentage' => $request->input('commission_percentage'),
                ];

                $this->dispatchBroadcastSafely(
                    fn () => event(new MechanicCreated([
                        'id' => $mechanicPayload['id'] ?? null,
                        'name' => $mechanicPayload['name'] ?? null,
                        'phone' => $mechanicPayload['phone'] ?? null,
                        'employee_number' => $mechanicPayload['employee_number'] ?? null,
                        'notes' => $mechanicPayload['notes'] ?? null,
                        'hourly_rate' => $mechanicPayload['hourly_rate'] ?? null,
                        'commission_percentage' => $mechanicPayload['commission_percentage'] ?? null,
                    ])),
                    'MechanicCreated'
                );

                return redirect()->back()->with([
                    'success' => $proxied['message'] ?? 'Mechanic created successfully.',
                    'flash' => ['mechanic' => $mechanicPayload],
                ]);
            }
        }

        $request->validate([
            'name' => 'required|string|max:191',
            'phone' => 'nullable|string|max:50',
            'employee_number' => 'nullable|string|max:50',
            'notes' => 'nullable|string',
            'hourly_rate' => 'nullable|integer|min:0',
            'commission_percentage' => 'nullable|numeric|min:0|max:100',
        ]);

        $mechanic = Mechanic::create($request->only([
            'name', 'phone', 'employee_number', 'notes', 'hourly_rate', 'commission_percentage'
        ]));

        $this->dispatchBroadcastSafely(
            fn () => event(new MechanicCreated([
                'id' => $mechanic->id,
                'name' => $mechanic->name,
                'phone' => $mechanic->phone,
                'employee_number' => $mechanic->employee_number,
                'notes' => $mechanic->notes,
                'hourly_rate' => $mechanic->hourly_rate,
                'commission_percentage' => $mechanic->commission_percentage,
            ])),
            'MechanicCreated'
        );

        return redirect()->back()->with([
            'success' => 'Mechanic created successfully.',
            'flash' => ['mechanic' => $mechanic]
        ]);
    }

    private function mechanicStoreViaGo(Request $request): ?array
    {
        $validated = $request->validate([
            'name' => 'required|string|max:191',
            'phone' => 'nullable|string|max:50',
            'employee_number' => 'nullable|string|max:50',
            'notes' => 'nullable|string',
            'hourly_rate' => 'nullable|integer|min:0',
            'commission_percentage' => 'nullable|numeric|min:0|max:100',
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
                ->post($baseUrl . '/api/v1/mechanics', $validated);

            $json = $response->json();
            if (! is_array($json)) {
                Log::warning('Mechanic store Go bridge returned a non-array response', [
                    'status' => $response->status(),
                ]);

                return null;
            }

            if ($response->status() === 422) {
                return [
                    'status' => 'validation_error',
                    'message' => $json['message'] ?? 'Data mechanic tidak valid.',
                    'errors' => $json['errors'] ?? [],
                ];
            }

            if (! $response->successful()) {
                Log::warning('Mechanic store Go bridge returned an invalid response', [
                    'status' => $response->status(),
                    'keys' => array_keys($json),
                ]);

                return null;
            }

            return [
                'status' => 'ok',
                'message' => $json['message'] ?? 'Mechanic created successfully.',
                'mechanic' => $json['mechanic'] ?? null,
            ];
        } catch (\Throwable $e) {
            Log::warning('Mechanic store Go bridge failed and fallback will be used', [
                'message' => $e->getMessage(),
            ]);

            return null;
        }
    }

    public function update(Request $request, $id)
    {
        if ((bool) config('go_backend.features.mechanic_update', false)) {
            $proxied = $this->mechanicUpdateViaGo($request, (string) $id);
            if ($proxied !== null) {
                if ($proxied['status'] === 'validation_error') {
                    return back()->withInput()->withErrors($proxied['errors'] ?? ['name' => 'Data mechanic tidak valid.']);
                }

                if ($proxied['status'] === 'not_found') {
                    abort(404);
                }

                $mechanicPayload = $proxied['mechanic'] ?? [
                    'id' => (int) $id,
                    'name' => $request->input('name'),
                    'phone' => $request->input('phone'),
                    'employee_number' => $request->input('employee_number'),
                    'notes' => $request->input('notes'),
                    'hourly_rate' => $request->input('hourly_rate'),
                    'commission_percentage' => $request->input('commission_percentage'),
                ];

                $this->dispatchBroadcastSafely(
                    fn () => event(new MechanicUpdated([
                        'id' => $mechanicPayload['id'] ?? null,
                        'name' => $mechanicPayload['name'] ?? null,
                        'phone' => $mechanicPayload['phone'] ?? null,
                        'employee_number' => $mechanicPayload['employee_number'] ?? null,
                        'notes' => $mechanicPayload['notes'] ?? null,
                        'hourly_rate' => $mechanicPayload['hourly_rate'] ?? null,
                        'commission_percentage' => $mechanicPayload['commission_percentage'] ?? null,
                    ])),
                    'MechanicUpdated'
                );

                return redirect()->back()->with([
                    'success' => $proxied['message'] ?? 'Mechanic updated successfully.',
                    'flash' => ['mechanic' => $mechanicPayload],
                ]);
            }
        }

        $mechanic = Mechanic::findOrFail($id);

        $request->validate([
            'name' => 'required|string|max:191',
            'phone' => 'nullable|string|max:50',
            'employee_number' => 'nullable|string|max:50',
            'notes' => 'nullable|string',
            'hourly_rate' => 'nullable|integer|min:0',
            'commission_percentage' => 'nullable|numeric|min:0|max:100',
        ]);

        $mechanic->update($request->only([
            'name', 'phone', 'employee_number', 'notes', 'hourly_rate', 'commission_percentage'
        ]));

        $this->dispatchBroadcastSafely(
            fn () => event(new MechanicUpdated([
                'id' => $mechanic->id,
                'name' => $mechanic->name,
                'phone' => $mechanic->phone,
                'employee_number' => $mechanic->employee_number,
                'notes' => $mechanic->notes,
                'hourly_rate' => $mechanic->hourly_rate,
                'commission_percentage' => $mechanic->commission_percentage,
            ])),
            'MechanicUpdated'
        );

        return redirect()->back()->with([
            'success' => 'Mechanic updated successfully.',
            'flash' => ['mechanic' => $mechanic]
        ]);
    }

    private function mechanicUpdateViaGo(Request $request, string $mechanicId): ?array
    {
        $validated = $request->validate([
            'name' => 'required|string|max:191',
            'phone' => 'nullable|string|max:50',
            'employee_number' => 'nullable|string|max:50',
            'notes' => 'nullable|string',
            'hourly_rate' => 'nullable|integer|min:0',
            'commission_percentage' => 'nullable|numeric|min:0|max:100',
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
                ->put($baseUrl . '/api/v1/mechanics/' . urlencode($mechanicId), $validated);

            $json = $response->json();
            if (! is_array($json)) {
                Log::warning('Mechanic update Go bridge returned a non-array response', [
                    'status' => $response->status(),
                ]);

                return null;
            }

            if ($response->status() === 404) {
                return [
                    'status' => 'not_found',
                    'message' => $json['message'] ?? 'Mechanic tidak ditemukan.',
                ];
            }

            if ($response->status() === 422) {
                return [
                    'status' => 'validation_error',
                    'message' => $json['message'] ?? 'Data mechanic tidak valid.',
                    'errors' => $json['errors'] ?? [],
                ];
            }

            if (! $response->successful()) {
                Log::warning('Mechanic update Go bridge returned an invalid response', [
                    'status' => $response->status(),
                    'keys' => array_keys($json),
                ]);

                return null;
            }

            return [
                'status' => 'ok',
                'message' => $json['message'] ?? 'Mechanic updated successfully.',
                'mechanic' => $json['mechanic'] ?? null,
            ];
        } catch (\Throwable $e) {
            Log::warning('Mechanic update Go bridge failed and fallback will be used', [
                'message' => $e->getMessage(),
            ]);

            return null;
        }
    }

    public function destroy(Request $request, $id)
    {
        if ((bool) config('go_backend.features.mechanic_destroy', false)) {
            $proxied = $this->mechanicDestroyViaGo((string) $id, $request);
            if ($proxied !== null) {
                if ($proxied['status'] === 'not_found') {
                    abort(404);
                }

                $mechanicId = (int) ($proxied['mechanic_id'] ?? $id);
                if ($mechanicId > 0) {
                    $this->dispatchBroadcastSafely(
                        fn () => event(new MechanicDeleted($mechanicId)),
                        'MechanicDeleted'
                    );
                }

                return redirect()->back()->with('success', $proxied['message'] ?? 'Mechanic deleted successfully.');
            }
        }

        $mechanic = Mechanic::findOrFail($id);
        $mechanicId = $mechanic->id;
        $mechanic->delete();

        $this->dispatchBroadcastSafely(
            fn () => event(new MechanicDeleted($mechanicId)),
            'MechanicDeleted'
        );

        return redirect()->back()->with('success', 'Mechanic deleted successfully.');
    }

    private function mechanicDestroyViaGo(string $mechanicId, Request $request): ?array
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
                ->delete($baseUrl . '/api/v1/mechanics/' . urlencode($mechanicId));

            $json = $response->json();
            if (! is_array($json)) {
                Log::warning('Mechanic destroy Go bridge returned a non-array response', [
                    'status' => $response->status(),
                ]);

                return null;
            }

            if ($response->status() === 404) {
                return [
                    'status' => 'not_found',
                    'message' => $json['message'] ?? 'Mechanic tidak ditemukan.',
                ];
            }

            if (! $response->successful()) {
                Log::warning('Mechanic destroy Go bridge returned an invalid response', [
                    'status' => $response->status(),
                    'keys' => array_keys($json),
                ]);

                return null;
            }

            return [
                'status' => 'ok',
                'message' => $json['message'] ?? 'Mechanic deleted successfully.',
                'mechanic_id' => $json['mechanic_id'] ?? (int) $mechanicId,
            ];
        } catch (\Throwable $e) {
            Log::warning('Mechanic destroy Go bridge failed and fallback will be used', [
                'message' => $e->getMessage(),
            ]);

            return null;
        }
    }
}
