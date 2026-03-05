<?php

namespace App\Http\Controllers\Apps;

use App\Events\ServiceCreated;
use App\Events\ServiceDeleted;
use App\Events\ServiceUpdated;
use App\Http\Controllers\Controller;
use App\Models\Mechanic;
use App\Models\Service;
use App\Models\ServiceCategory;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Illuminate\Support\Str;

class ServiceController extends Controller
{
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
                'name' => $service->title,
                'description' => $service->description,
                'price' => $service->price,
                'duration' => $service->est_time_minutes,
                'complexity_level' => $service->complexity_level,
                'status' => $service->status,
                'service_category_id' => $service->service_category_id,
                'category' => $service->category,
                'required_tools' => $service->required_tools,
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
            'incentive_mode' => $validated['incentive_mode'],
            'default_incentive_percentage' => $validated['default_incentive_percentage'] ?? 0,
            'code' => 'SVC-' . strtoupper(Str::random(8)),
        ];

        $service = Service::create($data);
        $this->syncPricingAndIncentives($service, $validated);

        // Broadcast service created event
        event(new ServiceCreated([
            'id' => $service->id,
            'name' => $service->title,
            'description' => $service->description,
            'price' => $service->price,
            'duration' => $service->est_time_minutes,
            'complexity_level' => $service->complexity_level,
            'status' => $service->status,
            'service_category_id' => $service->service_category_id,
            'category' => $service->category,
        ]));

        return redirect()->route('services.index')->with('success', 'Layanan berhasil ditambahkan');
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
            'incentive_mode' => $validated['incentive_mode'],
            'default_incentive_percentage' => $validated['default_incentive_percentage'] ?? 0,
        ];

        $service->update($data);
        $this->syncPricingAndIncentives($service, $validated);

        // Refresh service to broadcast updated data with relationships
        $service->refresh();

        // Broadcast service updated event
        event(new ServiceUpdated([
            'id' => $service->id,
            'name' => $service->title,
            'description' => $service->description,
            'price' => $service->price,
            'duration' => $service->est_time_minutes,
            'complexity_level' => $service->complexity_level,
            'status' => $service->status,
            'service_category_id' => $service->service_category_id,
            'category' => $service->category,
        ]));

        return redirect()->route('services.index')->with('success', 'Layanan berhasil diperbarui');
    }

    public function destroy(Service $service)
    {
        // Cek apakah ada service order detail yang menggunakan service ini
        if ($service->serviceOrderDetails()->count() > 0) {
            return back()->withErrors(['error' => 'Cannot delete service that is used in service orders']);
        }

        $serviceId = $service->id;
        $service->delete();

        // Broadcast service deleted event
        event(new ServiceDeleted($serviceId));

        return back()->with('success', 'Service deleted successfully');
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
}
