<?php

namespace App\Http\Controllers\Apps;

use App\Events\ServiceCreated;
use App\Events\ServiceDeleted;
use App\Events\ServiceUpdated;
use App\Http\Controllers\Controller;
use App\Models\Mechanic;
use App\Models\Service;
use App\Models\ServiceCategory;
use App\Support\DispatchesBroadcastSafely;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;
use Illuminate\Support\Str;
use App\Http\Controllers\Concerns\RespondsWithJsonOrRedirect;

class ServiceController extends Controller
{
    use DispatchesBroadcastSafely;
    use RespondsWithJsonOrRedirect;

    public function index(Request $request)
    {
        $q = $request->query('q', '');

        $query = Service::with(['category', 'priceAdjustments.triggerService', 'mechanicIncentives.mechanic'])->orderBy('title');
        if ($q) {
            $query->where(function ($sub) use ($q) {
                $sub->where('code', 'like', "%{$q}%")
                    ->orWhere('title', 'like', "%{$q}%")
                    ->orWhere('description', 'like', "%{$q}%");
            });
        }

        $services = $query->paginate(15)->withQueryString();

        // Transform field names for frontend
        $services->transform(function ($service) {
            return [
                'id' => $service->id,
                'code' => $service->code,
                'name' => $service->title,
                'description' => $service->description,
                'price' => $service->price,
                'duration' => $service->est_time_minutes,
                'complexity_level' => $service->complexity_level,
                'status' => $service->status,
                'service_category_id' => $service->service_category_id,
                'category' => $service->category,
                'required_tools' => $service->required_tools,
                'has_warranty' => (bool) $service->has_warranty,
                'warranty_duration_days' => $service->warranty_duration_days,
                'warranty_terms' => $service->warranty_terms,
                'incentive_mode' => $service->incentive_mode ?? 'same',
                'default_incentive_percentage' => (float) ($service->default_incentive_percentage ?? 0),
                'price_adjustments' => $service->priceAdjustments->map(function ($adjustment) {
                    return [
                        'id' => $adjustment->id,
                        'trigger_service_id' => $adjustment->trigger_service_id,
                        'trigger_service_name' => $adjustment->triggerService?->title,
                        'discount_type' => $adjustment->discount_type,
                        'discount_value' => (float) $adjustment->discount_value,
                    ];
                })->values(),
                'mechanic_incentives' => $service->mechanicIncentives->map(function ($incentive) {
                    return [
                        'mechanic_id' => $incentive->mechanic_id,
                        'mechanic_name' => $incentive->mechanic?->name,
                        'incentive_percentage' => (float) $incentive->incentive_percentage,
                    ];
                })->values(),
                'created_at' => $service->created_at,
                'updated_at' => $service->updated_at,
            ];
        });

        $categories = ServiceCategory::orderBy('name')->get();

        return Inertia::render('Dashboard/Services/Index', [
            'services' => $services,
            'categories' => $categories,
            'mechanics' => Mechanic::orderBy('name')->get(['id', 'name']),
            'filters' => ['q' => $q],
        ]);
    }

    public function create()
    {
        return Inertia::render('Dashboard/Services/Create', [
            'categories' => ServiceCategory::orderBy('name')->get(),
            'mechanics' => Mechanic::active()->orderBy('name')->get(['id', 'name']),
            'services' => Service::active()->orderBy('title')->get(['id', 'title']),
        ]);
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'service_category_id' => 'required|exists:service_categories,id',
            'name' => 'required|string|max:255',
            'description' => 'nullable|string',
            'price' => 'required|integer|min:0',
            'duration' => 'required|integer|min:1',
            'complexity_level' => 'required|in:simple,medium,complex',
            'required_tools' => 'nullable|array',
            'status' => 'required|in:active,inactive',
            'has_warranty' => 'nullable|boolean',
            'warranty_duration_days' => 'nullable|integer|min:0',
            'warranty_terms' => 'nullable|string',
            'incentive_mode' => 'required|in:same,by_mechanic',
            'default_incentive_percentage' => 'nullable|numeric|min:0|max:100',
            'price_adjustments' => 'nullable|array',
            'price_adjustments.*.trigger_service_id' => 'required|exists:services,id',
            'price_adjustments.*.discount_type' => 'required|in:percent,fixed',
            'price_adjustments.*.discount_value' => 'required|numeric|min:0',
            'mechanic_incentives' => 'nullable|array',
            'mechanic_incentives.*.mechanic_id' => 'required|exists:mechanics,id',
            'mechanic_incentives.*.incentive_percentage' => 'required|numeric|min:0|max:100',
        ]);

        $hasWarranty = (bool) ($validated['has_warranty'] ?? false);
        $warrantyDurationDays = isset($validated['warranty_duration_days']) ? (int) $validated['warranty_duration_days'] : null;

        if (!$hasWarranty) {
            $warrantyDurationDays = null;
        }

        if ($hasWarranty && (($warrantyDurationDays ?? 0) <= 0)) {
            throw ValidationException::withMessages([
                'warranty_duration_days' => 'Durasi garansi wajib lebih dari 0 hari saat garansi aktif.',
            ]);
        }

        // Map form fields to database columns
        $data = [
            'service_category_id' => $validated['service_category_id'],
            'title' => $validated['name'],
            'description' => $validated['description'],
            'price' => $validated['price'],
            'est_time_minutes' => $validated['duration'],
            'complexity_level' => $this->mapComplexityLevel($validated['complexity_level']),
            'required_tools' => $validated['required_tools'] ?? null,
            'status' => $validated['status'],
            'has_warranty' => $hasWarranty,
            'warranty_duration_days' => $warrantyDurationDays,
            'warranty_terms' => $validated['warranty_terms'] ?? null,
            'incentive_mode' => $validated['incentive_mode'],
            'default_incentive_percentage' => $validated['default_incentive_percentage'] ?? 0,
            'code' => 'SVC-' . strtoupper(Str::random(8)),
        ];

        $service = Service::create($data);
        $this->syncPricingAndIncentives($service, $validated);

        // Broadcast service created event
        $service->loadMissing('category');
        $this->dispatchBroadcastSafely(
            fn () => event(new ServiceCreated($this->toRealtimePayload($service))),
            'ServiceCreated'
        );

        return $this->jsonOrRedirect('services.index', [], 'Layanan berhasil ditambahkan', $service->toArray());
    }

    public function edit(Service $service)
    {
        // Transform field names for frontend
        $transformedService = [
            'id' => $service->id,
            'name' => $service->title,
            'description' => $service->description,
            'price' => $service->price,
            'duration' => $service->est_time_minutes,
            'complexity_level' => $service->complexity_level,
            'status' => $service->status,
            'service_category_id' => $service->service_category_id,
            'required_tools' => $service->required_tools,
            'has_warranty' => (bool) $service->has_warranty,
            'warranty_duration_days' => $service->warranty_duration_days,
            'warranty_terms' => $service->warranty_terms,
            'incentive_mode' => $service->incentive_mode ?? 'same',
            'default_incentive_percentage' => (float) ($service->default_incentive_percentage ?? 0),
            'price_adjustments' => $service->priceAdjustments()->with('triggerService:id,title')->get()->map(function ($adjustment) {
                return [
                    'id' => $adjustment->id,
                    'trigger_service_id' => $adjustment->trigger_service_id,
                    'trigger_service_name' => $adjustment->triggerService?->title,
                    'discount_type' => $adjustment->discount_type,
                    'discount_value' => (float) $adjustment->discount_value,
                ];
            })->values(),
            'mechanic_incentives' => $service->mechanicIncentives()->with('mechanic:id,name')->get()->map(function ($incentive) {
                return [
                    'mechanic_id' => $incentive->mechanic_id,
                    'mechanic_name' => $incentive->mechanic?->name,
                    'incentive_percentage' => (float) $incentive->incentive_percentage,
                ];
            })->values(),
            'created_at' => $service->created_at,
            'updated_at' => $service->updated_at,
        ];

        return Inertia::render('Dashboard/Services/Edit', [
            'service' => $transformedService,
            'categories' => ServiceCategory::orderBy('name')->get(),
            'mechanics' => Mechanic::active()->orderBy('name')->get(['id', 'name']),
            'services' => Service::active()
                ->where('id', '!=', $service->id)
                ->orderBy('title')
                ->get(['id', 'title']),
        ]);
    }

    public function update(Request $request, Service $service)
    {
        $validated = $request->validate([
            'service_category_id' => 'required|exists:service_categories,id',
            'name' => 'required|string|max:255',
            'description' => 'nullable|string',
            'price' => 'required|integer|min:0',
            'duration' => 'required|integer|min:1',
            'complexity_level' => 'required|in:simple,medium,complex',
            'required_tools' => 'nullable|array',
            'status' => 'required|in:active,inactive',
            'has_warranty' => 'nullable|boolean',
            'warranty_duration_days' => 'nullable|integer|min:0',
            'warranty_terms' => 'nullable|string',
            'incentive_mode' => 'required|in:same,by_mechanic',
            'default_incentive_percentage' => 'nullable|numeric|min:0|max:100',
            'price_adjustments' => 'nullable|array',
            'price_adjustments.*.trigger_service_id' => 'required|exists:services,id',
            'price_adjustments.*.discount_type' => 'required|in:percent,fixed',
            'price_adjustments.*.discount_value' => 'required|numeric|min:0',
            'mechanic_incentives' => 'nullable|array',
            'mechanic_incentives.*.mechanic_id' => 'required|exists:mechanics,id',
            'mechanic_incentives.*.incentive_percentage' => 'required|numeric|min:0|max:100',
        ]);

        $hasWarranty = (bool) ($validated['has_warranty'] ?? false);
        $warrantyDurationDays = isset($validated['warranty_duration_days']) ? (int) $validated['warranty_duration_days'] : null;

        if (!$hasWarranty) {
            $warrantyDurationDays = null;
        }

        if ($hasWarranty && (($warrantyDurationDays ?? 0) <= 0)) {
            throw ValidationException::withMessages([
                'warranty_duration_days' => 'Durasi garansi wajib lebih dari 0 hari saat garansi aktif.',
            ]);
        }

        // Map form fields to database columns
        $data = [
            'service_category_id' => $validated['service_category_id'],
            'title' => $validated['name'],
            'description' => $validated['description'],
            'price' => $validated['price'],
            'est_time_minutes' => $validated['duration'],
            'complexity_level' => $this->mapComplexityLevel($validated['complexity_level']),
            'required_tools' => $validated['required_tools'] ?? null,
            'status' => $validated['status'],
            'has_warranty' => $hasWarranty,
            'warranty_duration_days' => $warrantyDurationDays,
            'warranty_terms' => $validated['warranty_terms'] ?? null,
            'incentive_mode' => $validated['incentive_mode'],
            'default_incentive_percentage' => $validated['default_incentive_percentage'] ?? 0,
        ];

        $service->update($data);
        $this->syncPricingAndIncentives($service, $validated);

        // Refresh service to broadcast updated data with relationships
        $service->refresh();

        // Broadcast service updated event
        $service->loadMissing('category');
        $this->dispatchBroadcastSafely(
            fn () => event(new ServiceUpdated($this->toRealtimePayload($service))),
            'ServiceUpdated'
        );

        return $this->jsonOrRedirect('services.index', [], 'Layanan berhasil diperbarui', $service->toArray());
    }

    public function destroy(Service $service)
    {
        // Cek apakah ada service order detail yang menggunakan service ini
        if ($service->serviceOrderDetails()->count() > 0) {
            throw ValidationException::withMessages(['error' => 'Cannot delete service that is used in service orders']);
        }

        $serviceId = $service->id;
        $service->delete();

        // Broadcast service deleted event
        $this->dispatchBroadcastSafely(
            fn () => event(new ServiceDeleted($serviceId)),
            'ServiceDeleted'
        );

        return $this->jsonOrRedirect(null, [], 'Service deleted successfully');
    }

    public function bulkStatus(Request $request)
    {
        $validated = $request->validate([
            'ids' => 'required|array|min:1',
            'ids.*' => 'integer|exists:services,id',
            'status' => 'required|in:active,inactive',
        ]);

        $services = Service::with('category')
            ->whereIn('id', $validated['ids'])
            ->get();

        foreach ($services as $service) {
            $service->update(['status' => $validated['status']]);
            $service->refresh();
            $service->loadMissing('category');
            $this->dispatchBroadcastSafely(
                fn () => event(new ServiceUpdated($this->toRealtimePayload($service))),
                'ServiceUpdated'
            );
        }

        $statusLabel = $validated['status'] === 'active' ? 'aktif' : 'nonaktif';

        return $this->jsonOrRedirect(null, [], "{$services->count()} layanan berhasil diubah ke status {$statusLabel}.");
    }

    public function bulkDelete(Request $request)
    {
        $validated = $request->validate([
            'ids' => 'required|array|min:1',
            'ids.*' => 'integer|exists:services,id',
        ]);

        $services = Service::whereIn('id', $validated['ids'])->get();

        $blocked = $services
            ->filter(fn (Service $service) => $service->serviceOrderDetails()->exists())
            ->values();

        $deletable = $services
            ->reject(fn (Service $service) => $blocked->contains('id', $service->id))
            ->values();

        foreach ($deletable as $service) {
            $serviceId = $service->id;
            $service->delete();
            $this->dispatchBroadcastSafely(
                fn () => event(new ServiceDeleted($serviceId)),
                'ServiceDeleted'
            );
        }

        $deletedCount = $deletable->count();
        $blockedCount = $blocked->count();

        if ($deletedCount > 0 && $blockedCount === 0) {
            return $this->jsonOrRedirect(null, [], "{$deletedCount} layanan berhasil dihapus.", null);
        }

        if ($deletedCount > 0 && $blockedCount > 0) {
            return $this->jsonOrRedirect(null, [], "{$deletedCount} layanan dihapus, {$blockedCount} layanan tidak bisa dihapus karena sudah dipakai di service order.", null, 200, 'warning');
        }

        throw ValidationException::withMessages([
            'error' => 'Tidak ada layanan yang dapat dihapus karena semua sudah dipakai di service order.',
        ]);
    }

    /**
     * Map form complexity level to database values
     */
    private function mapComplexityLevel($level)
    {
        $mapping = [
            'simple' => 'easy',
            'medium' => 'medium',
            'complex' => 'hard',
        ];
        return $mapping[$level] ?? 'medium';
    }

    private function syncPricingAndIncentives(Service $service, array $validated): void
    {
        $service->priceAdjustments()->delete();
        $service->mechanicIncentives()->delete();

        foreach (($validated['price_adjustments'] ?? []) as $adjustment) {
            if ((int) $adjustment['trigger_service_id'] === (int) $service->id) {
                continue;
            }

            $service->priceAdjustments()->create([
                'trigger_service_id' => $adjustment['trigger_service_id'],
                'discount_type' => $adjustment['discount_type'],
                'discount_value' => $adjustment['discount_value'],
            ]);
        }

        if (($validated['incentive_mode'] ?? 'same') !== 'by_mechanic') {
            return;
        }

        foreach (($validated['mechanic_incentives'] ?? []) as $incentive) {
            $service->mechanicIncentives()->create([
                'mechanic_id' => $incentive['mechanic_id'],
                'incentive_percentage' => $incentive['incentive_percentage'],
            ]);
        }
    }

    private function toRealtimePayload(Service $service): array
    {
        return [
            'id' => $service->id,
            'code' => $service->code,
            'name' => $service->title,
            'description' => $service->description,
            'price' => $service->price,
            'duration' => $service->est_time_minutes,
            'complexity_level' => $service->complexity_level,
            'status' => $service->status,
            'service_category_id' => $service->service_category_id,
            'category' => $service->category,
            'has_warranty' => (bool) $service->has_warranty,
            'warranty_duration_days' => $service->warranty_duration_days,
            'warranty_terms' => $service->warranty_terms,
        ];
    }
}
