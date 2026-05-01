<?php

namespace App\Http\Controllers\Apps;

use App\Events\PartCategoryCreated;
use App\Events\PartCategoryUpdated;
use App\Events\PartCategoryDeleted;
use App\Http\Controllers\Controller;
use App\Models\PartCategory;
use App\Support\DispatchesBroadcastSafely;
use Illuminate\Http\Request;
use Inertia\Inertia;
use App\Http\Controllers\Concerns\RespondsWithJsonOrRedirect;
use Illuminate\Validation\ValidationException;

class PartCategoryController extends Controller
{
    use DispatchesBroadcastSafely;
    use RespondsWithJsonOrRedirect;

    public function index(Request $request)
    {
        $q = $request->query('q', '');

        $query = PartCategory::orderBy('sort_order')->orderBy('name');
        if ($q) {
            $query->where('name', 'like', "%{$q}%")
                  ->orWhere('description', 'like', "%{$q}%");
        }

        $categories = $query->paginate(15)->withQueryString();

        return Inertia::render('Dashboard/PartCategories/Index', [
            'categories' => $categories,
            'filters' => ['q' => $q],
        ]);
    }

    public function create()
    {
        return Inertia::render('Dashboard/PartCategories/Create');
    }

    public function store(Request $request)
    {
        $data = $request->validate([
            'name' => 'required|string|unique:part_categories,name',
            'description' => 'nullable|string',
            'icon' => 'nullable|string',
        ]);

        $category = PartCategory::create($data);

        $this->dispatchBroadcastSafely(
            fn () => PartCategoryCreated::dispatch($category->toArray()),
            'PartCategoryCreated'
        );

        return $this->jsonOrRedirect('part-categories.index', [], 'Part category created successfully', $category, 201);
    }

    public function edit(PartCategory $partCategory)
    {
        return Inertia::render('Dashboard/PartCategories/Edit', [
            'category' => $partCategory,
        ]);
    }

    public function update(Request $request, PartCategory $partCategory)
    {
        $data = $request->validate([
            'name' => 'required|string|unique:part_categories,name,' . $partCategory->id,
            'description' => 'nullable|string',
            'icon' => 'nullable|string',
        ]);

        $partCategory->update($data);

        $this->dispatchBroadcastSafely(
            fn () => PartCategoryUpdated::dispatch($partCategory->toArray()),
            'PartCategoryUpdated'
        );

        return $this->jsonOrRedirect('part-categories.index', [], 'Part category updated successfully', $partCategory->toArray());
    }

    public function destroy(PartCategory $partCategory)
    {
        // Cek apakah ada parts yang menggunakan kategori ini
        if ($partCategory->parts()->count() > 0) {
            throw ValidationException::withMessages(['error' => 'Cannot delete category that has parts']);
        }

        $categoryId = $partCategory->id;
        $partCategory->delete();

        $this->dispatchBroadcastSafely(
            fn () => PartCategoryDeleted::dispatch($categoryId),
            'PartCategoryDeleted'
        );

        return $this->jsonOrRedirect('part-categories.index', [], 'Part category deleted successfully');
    }

    /**
     * AJAX endpoint for quick category creation
     */
    public function storeAjax(Request $request)
    {
        $validated = $request->validate([
            'name' => 'required|string|max:255|unique:part_categories,name',
            'description' => 'nullable|string',
            'icon' => 'nullable|string',
        ]);

        try {
            $category = PartCategory::create($validated);

            return response()->json([
                'success' => true,
                'message' => 'Kategori part berhasil ditambahkan',
                'category' => [
                    'id' => $category->id,
                    'name' => $category->name,
                    'description' => $category->description,
                    'icon' => $category->icon,
                ],
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Gagal menambahkan kategori part',
                'errors' => ['name' => ['Terjadi kesalahan saat menyimpan kategori']]
            ], 422);
        }
    }
}
