<?php

namespace App\Http\Controllers\Apps;

use App\Events\PartCategoryCreated;
use App\Events\PartCategoryUpdated;
use App\Events\PartCategoryDeleted;
use App\Http\Controllers\Controller;
use App\Models\PartCategory;
use Illuminate\Http\Request;
use Inertia\Inertia;

class PartCategoryController extends Controller
{
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

        PartCategoryCreated::dispatch($category->toArray());

        return redirect()->route('part-categories.index')->with('success', 'Part category created successfully');
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

        PartCategoryUpdated::dispatch($partCategory->toArray());

        return redirect()->route('part-categories.index')->with('success', 'Part category updated successfully');
    }

    public function destroy(PartCategory $partCategory)
    {
        // Cek apakah ada parts yang menggunakan kategori ini
        if ($partCategory->parts()->count() > 0) {
            return back()->withErrors(['error' => 'Cannot delete category that has parts']);
        }

        $categoryId = $partCategory->id;
        $partCategory->delete();

        PartCategoryDeleted::dispatch($categoryId);

        return back()->with('success', 'Part category deleted successfully');
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
