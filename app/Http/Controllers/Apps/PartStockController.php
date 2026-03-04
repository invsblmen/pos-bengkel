<?php

namespace App\Http\Controllers\Apps;

use App\Http\Controllers\Controller;
use App\Models\Part;
use App\Models\Supplier;
use App\Models\PartStockMovement;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Illuminate\Support\Facades\Auth;

class PartStockController extends Controller
{
    public function index(Request $request)
    {
        $query = PartStockMovement::with(['part', 'supplier', 'user'])->orderByDesc('created_at');

        if ($request->filled('q')) {
            $q = $request->input('q');
            $query->whereHas('part', function ($q2) use ($q) {
                $q2->where('name', 'like', "%{$q}%")->orWhere('part_number', 'like', "%{$q}%");
            });
        }

        $movements = $query->paginate(15)->withQueryString();

        return Inertia::render('Dashboard/Parts/Stock/Index', [
            'movements' => $movements,
            'parts' => Part::orderBy('name')->get(),
            'suppliers' => Supplier::orderBy('name')->get(),
        ]);
    }

    public function createIn()
    {
        return Inertia::render('Dashboard/Parts/Stock/In', [
            'parts' => Part::orderBy('name')->get(),
            'suppliers' => Supplier::orderBy('name')->get(),
        ]);
    }

    public function storeIn(Request $request)
    {
        $data = $request->validate([
            'part_id' => 'required|exists:parts,id',
            'qty' => 'required|integer|min:1',
            'unit_price' => 'nullable|numeric|min:0',
            'supplier_id' => 'nullable|exists:suppliers,id',
            'notes' => 'nullable|string',
        ]);

        $part = Part::findOrFail($data['part_id']);
        $before = $part->stock;
        $part->stock = $part->stock + $data['qty'];
        $part->save();

        PartStockMovement::create([
            'part_id' => $part->id,
            'type' => 'in',
            'qty' => $data['qty'],
            'before_stock' => $before,
            'after_stock' => $part->stock,
            'unit_price' => $data['unit_price'] ?? null,
            'supplier_id' => $data['supplier_id'] ?? null,
            'notes' => $data['notes'] ?? null,
            'created_by' => Auth::id(),
        ]);

        return redirect()->route('parts.stock.index')->with('success', 'Stok berhasil ditambah');
    }

    public function createOut()
    {
        return Inertia::render('Dashboard/Parts/Stock/Out', [
            'parts' => Part::orderBy('name')->get(),
            'suppliers' => Supplier::orderBy('name')->get(),
        ]);
    }

    public function storeOut(Request $request)
    {
        $data = $request->validate([
            'part_id' => 'required|exists:parts,id',
            'qty' => 'required|integer|min:1',
            'notes' => 'nullable|string',
        ]);

        $part = Part::findOrFail($data['part_id']);
        if ($part->stock < $data['qty']) {
            return back()->with('error', 'Stok tidak mencukupi');
        }

        $before = $part->stock;
        $part->stock = max(0, $part->stock - $data['qty']);
        $part->save();

        PartStockMovement::create([
            'part_id' => $part->id,
            'type' => 'out',
            'qty' => $data['qty'],
            'before_stock' => $before,
            'after_stock' => $part->stock,
            'notes' => $data['notes'] ?? null,
            'created_by' => Auth::id(),
        ]);

        return redirect()->route('parts.stock.index')->with('success', 'Stok berhasil dikurangi');
    }
}
