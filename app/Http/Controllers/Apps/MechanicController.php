<?php

namespace App\Http\Controllers\Apps;

use App\Http\Controllers\Controller;
use App\Models\Mechanic;
use Illuminate\Http\Request;
use Inertia\Inertia;

class MechanicController extends Controller
{
    public function index(Request $request)
    {
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

    public function create()
    {
        return Inertia::render('Dashboard/Mechanics/Create');
    }

    public function store(Request $request)
    {
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

        return redirect()->back()->with([
            'success' => 'Mechanic created successfully.',
            'flash' => ['mechanic' => $mechanic]
        ]);
    }

    public function update(Request $request, $id)
    {
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

        return redirect()->back()->with([
            'success' => 'Mechanic updated successfully.',
            'flash' => ['mechanic' => $mechanic]
        ]);
    }

    public function destroy(Request $request, $id)
    {
        $mechanic = Mechanic::findOrFail($id);
        $mechanic->delete();

        return redirect()->back()->with('success', 'Mechanic deleted successfully.');
    }
}
