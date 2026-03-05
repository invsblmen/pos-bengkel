<?php

namespace App\Http\Controllers\Apps;

use App\Events\ServiceCategoryCreated;
use App\Events\ServiceCategoryUpdated;
use App\Events\ServiceCategoryDeleted;
use App\Http\Controllers\Controller;
use App\Models\ServiceCategory;
use Illuminate\Http\Request;
use Inertia\Inertia;

class ServiceCategoryController extends Controller
{
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

        ServiceCategoryCreated::dispatch($category->toArray());

        return redirect()->route('service-categories.index')->with('success', 'Service category created successfully');
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

        ServiceCategoryUpdated::dispatch($serviceCategory->toArray());

        return redirect()->route('service-categories.index')->with('success', 'Service category updated successfully');
    }

    public function destroy(ServiceCategory $serviceCategory)
    {
        // Cek apakah ada services yang menggunakan kategori ini
        if ($serviceCategory->services()->count() > 0) {
            return back()->withErrors(['error' => 'Cannot delete category that has services']);
        }

        $categoryId = $serviceCategory->id;
        $serviceCategory->delete();

        ServiceCategoryDeleted::dispatch($categoryId);

        return back()->with('success', 'Service category deleted successfully');
    }
}
