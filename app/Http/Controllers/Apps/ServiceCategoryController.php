<?php

namespace App\Http\Controllers\Apps;

use App\Events\ServiceCategoryCreated;
use App\Events\ServiceCategoryUpdated;
use App\Events\ServiceCategoryDeleted;
use App\Http\Controllers\Controller;
use App\Models\ServiceCategory;
use App\Support\DispatchesBroadcastSafely;
use Illuminate\Http\Request;
use Inertia\Inertia;
use App\Http\Controllers\Concerns\RespondsWithJsonOrRedirect;
use Illuminate\Validation\ValidationException;

class ServiceCategoryController extends Controller
{
    use DispatchesBroadcastSafely;
    use RespondsWithJsonOrRedirect;

    public function index(Request $request)
    {
        $q = $request->query('q', '');

        $query = ServiceCategory::orderBy('sort_order')->orderBy('name');
        if ($q) {
            $query->where('name', 'like', "%{$q}%")
                  ->orWhere('description', 'like', "%{$q}%");
        }

        $categories = $query->paginate(15)->withQueryString();

        return Inertia::render('Dashboard/ServiceCategories/Index', [
            'categories' => $categories,
            'filters' => ['q' => $q],
        ]);
    }

    public function create()
    {
        return Inertia::render('Dashboard/ServiceCategories/Create');
    }

    public function store(Request $request)
    {
        $data = $request->validate([
            'name' => 'required|string|unique:service_categories,name',
            'description' => 'nullable|string',
            'icon' => 'nullable|string',
            'sort_order' => 'nullable|integer|min:0',
        ]);

        $category = ServiceCategory::create($data);

        $this->dispatchBroadcastSafely(
            fn () => ServiceCategoryCreated::dispatch($category->toArray()),
            'ServiceCategoryCreated'
        );

        return $this->jsonOrRedirect('service-categories.index', [], 'Service category created successfully', $category, 201);
    }

    public function edit(ServiceCategory $serviceCategory)
    {
        return Inertia::render('Dashboard/ServiceCategories/Edit', [
            'category' => $serviceCategory,
        ]);
    }

    public function update(Request $request, ServiceCategory $serviceCategory)
    {
        $data = $request->validate([
            'name' => 'required|string|unique:service_categories,name,' . $serviceCategory->id,
            'description' => 'nullable|string',
            'icon' => 'nullable|string',
            'sort_order' => 'nullable|integer|min:0',
        ]);

        $serviceCategory->update($data);

        $this->dispatchBroadcastSafely(
            fn () => ServiceCategoryUpdated::dispatch($serviceCategory->toArray()),
            'ServiceCategoryUpdated'
        );

        return $this->jsonOrRedirect('service-categories.index', [], 'Service category updated successfully', $serviceCategory->toArray());
    }

    public function destroy(ServiceCategory $serviceCategory)
    {
        // Cek apakah ada services yang menggunakan kategori ini
        if ($serviceCategory->services()->count() > 0) {
            throw ValidationException::withMessages(['error' => 'Cannot delete category that has services']);
        }

        $categoryId = $serviceCategory->id;
        $serviceCategory->delete();

        $this->dispatchBroadcastSafely(
            fn () => ServiceCategoryDeleted::dispatch($categoryId),
            'ServiceCategoryDeleted'
        );

        return $this->jsonOrRedirect('service-categories.index', [], 'Service category deleted successfully');
    }
}
