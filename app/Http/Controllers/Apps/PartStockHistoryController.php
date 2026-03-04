<?php

namespace App\Http\Controllers\Apps;

use App\Http\Controllers\Controller;
use App\Models\Part;
use App\Models\PartSale;
use App\Models\PartStockMovement;
use Illuminate\Http\Request;
use Inertia\Inertia;

class PartStockHistoryController extends Controller
{
    public function index(Request $request)
    {
        // Build query - exclude records with deleted model references to prevent errors
        $query = PartStockMovement::query()
            ->where(function ($q) {
                $q->whereIn('reference_type', [
                    \App\Models\PartPurchase::class,
                    \App\Models\PartSale::class,
                    \App\Models\PartSalesOrder::class,
                    \App\Models\PartPurchaseOrder::class,
                ])
                ->orWhereNull('reference_type');
            })
            ->with(['part', 'supplier', 'user', 'reference'])
            ->orderBy('created_at', 'desc');

        // Filter by part
        if ($request->filled('part_id')) {
            $query->where('part_id', $request->part_id);
        }

        // Filter by type
        if ($request->filled('type')) {
            $query->where('type', $request->type);
        }

        // Filter by date range
        if ($request->filled('date_from')) {
            $query->whereDate('created_at', '>=', $request->date_from);
        }

        if ($request->filled('date_to')) {
            $query->whereDate('created_at', '<=', $request->date_to);
        }

        // Search by notes or reference
        if ($request->filled('q')) {
            $search = $request->q;
            $query->where(function ($q) use ($search) {
                $q->where('notes', 'like', "%{$search}%")
                    ->orWhereHas('part', function ($q2) use ($search) {
                        $q2->where('name', 'like', "%{$search}%")
                            ->orWhere('part_number', 'like', "%{$search}%");
                    })
                    // Only search in valid model types (exclude deleted PartSale, Purchase)
                    ->orWhereHasMorph('reference', [
                        \App\Models\PartPurchase::class,
                        \App\Models\PartSale::class,
                        \App\Models\PartSalesOrder::class,
                        \App\Models\PartPurchaseOrder::class,
                    ], function ($q) use ($search) {
                        $q->where('purchase_number', 'like', "%{$search}%")
                            ->orWhere('sale_number', 'like', "%{$search}%")
                            ->orWhere('order_number', 'like', "%{$search}%")
                            ->orWhere('so_number', 'like', "%{$search}%")
                            ->orWhere('po_number', 'like', "%{$search}%");
                    });
            });
        }

        $movements = $query->paginate(20)->withQueryString();

        // Get all movement types for filter
        $types = PartStockMovement::select('type')
            ->distinct()
            ->orderBy('type')
            ->pluck('type')
            ->toArray();

        return Inertia::render('Dashboard/PartStockHistory/Index', [
            'movements' => $movements,
            'parts' => Part::orderBy('name')->get(['id', 'name']),
            'types' => $types,
            'filters' => $request->only(['q', 'part_id', 'type', 'date_from', 'date_to']),
        ]);
    }

    public function export(Request $request)
    {
        $query = PartStockMovement::with(['part', 'supplier', 'user', 'reference'])
            ->orderBy('created_at', 'desc');

        if ($request->filled('part_id')) {
            $query->where('part_id', $request->part_id);
        }

        if ($request->filled('type')) {
            $query->where('type', $request->type);
        }

        if ($request->filled('date_from')) {
            $query->whereDate('created_at', '>=', $request->date_from);
        }

        if ($request->filled('date_to')) {
            $query->whereDate('created_at', '<=', $request->date_to);
        }

        if ($request->filled('q')) {
            $search = $request->q;
            $query->where(function ($q) use ($search) {
                $q->where('notes', 'like', "%{$search}%")
                    ->orWhereHas('part', function ($q2) use ($search) {
                        $q2->where('name', 'like', "%{$search}%")
                            ->orWhere('part_number', 'like', "%{$search}%");
                    });
            });
        }

        $movements = $query->get();

        $filename = 'part-stock-history-' . date('Y-m-d-His') . '.csv';

        $headers = [
            'Content-Type' => 'text/csv',
            'Content-Disposition' => "attachment; filename={$filename}",
        ];

        $callback = function () use ($movements) {
            $file = fopen('php://output', 'w');
            fputcsv($file, ['Date', 'Part', 'Type', 'Qty', 'Before Stock', 'After Stock', 'Reference', 'Supplier', 'User', 'Notes']);

            foreach ($movements as $m) {
                $reference = '';
                if ($m->reference) {
                    $reference = $m->reference->purchase_number ?? $m->reference->order_number ?? $m->reference->po_number ?? $m->reference->invoice ?? '';
                }

                fputcsv($file, [
                    $m->created_at->format('Y-m-d H:i:s'),
                    $m->part->name ?? '',
                    $m->type,
                    $m->qty,
                    $m->before_stock,
                    $m->after_stock,
                    $reference,
                    $m->supplier->name ?? '',
                    $m->user->name ?? '',
                    $m->notes ?? '',
                ]);
            }

            fclose($file);
        };

        return response()->stream($callback, 200, $headers);
    }
}

