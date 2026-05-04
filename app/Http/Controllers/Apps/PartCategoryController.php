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

        $query = PartCategory::with('parent:id,name')->orderBy('sort_order', 'asc')->orderBy('name', 'asc');
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
        $categories = PartCategory::query()
            ->with('parent')
            ->orderBy('sort_order', 'asc')
            ->orderBy('name', 'asc')
            ->get()
            ->map(fn ($cat) => [
                'id' => $cat->id,
                'name' => $cat->name,
                'depth' => $cat->getDepth(),
            ]);

        return Inertia::render('Dashboard/PartCategories/Create', [
            'parentCategories' => $categories,
        ]);
    }

    public function store(Request $request)
    {
        $data = $request->validate([
            'parent_id' => 'nullable|exists:part_categories,id',
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
        $categories = PartCategory::query()
            ->whereKeyNot($partCategory->id)
            ->with('parent')
            ->orderBy('sort_order', 'asc')
            ->orderBy('name', 'asc')
            ->get()
            ->map(fn ($cat) => [
                'id' => $cat->id,
                'name' => $cat->name,
                'depth' => $cat->getDepth(),
            ]);

        return Inertia::render('Dashboard/PartCategories/Edit', [
            'category' => $partCategory,
            'parentCategories' => $categories,
        ]);
    }

    public function update(Request $request, PartCategory $partCategory)
    {
        $data = $request->validate([
            'parent_id' => 'nullable|exists:part_categories,id|not_in:' . $partCategory->id,
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

        // Cek apakah ada subkategori yang masih terkait
        if ($partCategory->children()->count() > 0) {
            throw ValidationException::withMessages(['error' => 'Cannot delete category that has subcategories']);
        }

        $categoryId = $partCategory->id;
        PartCategory::destroy($categoryId);

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
            'parent_id' => 'nullable|exists:part_categories,id',
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
