<?php

namespace App\Http\Controllers\Reports;

use App\Http\Controllers\Controller;
use App\Models\PartSale;
use App\Models\PartSaleDetail;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;

class PartSalesProfitReportController extends Controller
{
    public function index(Request $request)
    {
        $filters = [
            'start_date' => $request->input('start_date'),
            'end_date' => $request->input('end_date'),
            'invoice' => $request->input('invoice'),
        ];

        // Base query for part sales
        $baseQuery = PartSale::query()
            ->with(['user:id,name'])
            ->when($filters['invoice'] ?? null, fn ($q, $invoice) =>
                $q->where('invoice', 'like', '%' . $invoice . '%')
            )
            ->when($filters['start_date'] ?? null, fn ($q, $start) =>
                $q->whereDate('created_at', '>=', $start)
            )
            ->when($filters['end_date'] ?? null, fn ($q, $end) =>
                $q->whereDate('created_at', '<=', $end)
            )
            ->orderByDesc('created_at');

        // Paginated sales with profit calculation
        $sales = (clone $baseQuery)
            ->paginate(15)
            ->withQueryString();

        // Add profit calculation to each sale
        $sales->getCollection()->transform(function ($sale) {
            $details = PartSaleDetail::where('part_sale_id', $sale->id)->get();

            $totalCost = $details->sum(function ($detail) {
                return ($detail->cost_price ?? 0) * ($detail->quantity ?? $detail->qty ?? 0);
            });

            $totalRevenue = $details->sum(function ($detail) {
                return ($detail->selling_price ?? 0) * ($detail->quantity ?? $detail->qty ?? 0);
            });

            $totalProfit = $totalRevenue - $totalCost;
            $profitMargin = $totalRevenue > 0 ? ($totalProfit / $totalRevenue) * 100 : 0;

            $sale->total_cost = (int) $totalCost;
            $sale->total_revenue = (int) $totalRevenue;
            $sale->total_profit = (int) $totalProfit;
            $sale->profit_margin = round($profitMargin, 2);

            return $sale;
        });

        // Summary statistics
        $allSaleIds = (clone $baseQuery)->pluck('id');

        $summaryDetails = PartSaleDetail::whereIn('part_sale_id', $allSaleIds)->get();

        $totalCost = $summaryDetails->sum(function ($detail) {
            return ($detail->cost_price ?? 0) * ($detail->quantity ?? $detail->qty ?? 0);
        });

        $totalRevenue = $summaryDetails->sum(function ($detail) {
            return ($detail->selling_price ?? 0) * ($detail->quantity ?? $detail->qty ?? 0);
        });

        $totalProfit = $totalRevenue - $totalCost;
        $totalQuantity = $summaryDetails->sum(function ($detail) {
            return $detail->quantity ?? $detail->qty ?? 0;
        });
        $ordersCount = (clone $baseQuery)->count();

        $summary = [
            'total_cost' => (int) $totalCost,
            'total_revenue' => (int) $totalRevenue,
            'total_profit' => (int) $totalProfit,
            'profit_margin' => $totalRevenue > 0 ? round(($totalProfit / $totalRevenue) * 100, 2) : 0,
            'average_profit_per_order' => $ordersCount > 0 ? (int) round($totalProfit / $ordersCount) : 0,
            'orders_count' => (int) $ordersCount,
            'items_sold' => (int) $totalQuantity,
        ];

        // Top performing parts
        $topParts = PartSaleDetail::selectRaw('
                part_id,
                SUM(COALESCE(quantity, 0)) as total_quantity,
                SUM((COALESCE(selling_price, 0) - COALESCE(cost_price, 0)) * COALESCE(quantity, 0)) as total_profit,
                AVG((COALESCE(selling_price, 0) - COALESCE(cost_price, 0)) / NULLIF(COALESCE(cost_price, 1), 0) * 100) as avg_margin
            ')
            ->whereIn('part_sale_id', $allSaleIds)
            ->with('part:id,name,part_number')
            ->groupBy('part_id')
            ->orderByDesc('total_profit')
            ->limit(10)
            ->get()
            ->map(function ($item) {
                return [
                    'part_name' => $item->part->name ?? 'Unknown',
                    'part_sku' => $item->part->part_number ?? 'N/A',
                    'total_quantity' => (int) $item->total_quantity,
                    'total_profit' => (int) $item->total_profit,
                    'avg_margin' => round($item->avg_margin, 2),
                ];
            });

        return Inertia::render('Dashboard/Reports/PartSalesProfit', [
            'sales' => $sales,
            'summary' => $summary,
            'topParts' => $topParts,
            'filters' => $filters,
        ]);
    }

    /**
     * Export detailed profit report
     */
    public function export(Request $request)
    {
        // Implementation for CSV/Excel export
        // TODO: Add export functionality
    }

    /**
     * Get profit breakdown by supplier
     */
    public function bySupplier(Request $request)
    {
        $filters = [
            'start_date' => $request->input('start_date'),
            'end_date' => $request->input('end_date'),
        ];

        $profitBySupplier = DB::table('part_sale_details')
            ->join('part_sales', 'part_sale_details.part_sale_id', '=', 'part_sales.id')
            ->join('part_purchase_details', 'part_sale_details.source_purchase_detail_id', '=', 'part_purchase_details.id')
            ->join('part_purchases', 'part_purchase_details.part_purchase_id', '=', 'part_purchases.id')
            ->join('suppliers', 'part_purchases.supplier_id', '=', 'suppliers.id')
            ->selectRaw('
                suppliers.id as supplier_id,
                suppliers.name as supplier_name,
                SUM((COALESCE(part_sale_details.selling_price, 0) - COALESCE(part_sale_details.cost_price, 0)) * COALESCE(part_sale_details.quantity, 0)) as total_profit,
                SUM(COALESCE(part_sale_details.cost_price, 0) * COALESCE(part_sale_details.quantity, 0)) as total_cost,
                SUM(COALESCE(part_sale_details.selling_price, 0) * COALESCE(part_sale_details.quantity, 0)) as total_revenue,
                COUNT(DISTINCT part_sales.id) as sales_count,
                SUM(COALESCE(part_sale_details.quantity, 0)) as items_sold
            ')
            ->when($filters['start_date'] ?? null, fn ($q, $start) =>
                $q->whereDate('part_sales.created_at', '>=', $start)
            )
            ->when($filters['end_date'] ?? null, fn ($q, $end) =>
                $q->whereDate('part_sales.created_at', '<=', $end)
            )
            ->groupBy('suppliers.id', 'suppliers.name')
            ->orderByDesc('total_profit')
            ->get()
            ->map(function ($item) {
                $item->total_profit = (int) $item->total_profit;
                $item->total_cost = (int) $item->total_cost;
                $item->total_revenue = (int) $item->total_revenue;
                $item->profit_margin = $item->total_revenue > 0
                    ? round(($item->total_profit / $item->total_revenue) * 100, 2)
                    : 0;
                return $item;
            });

        return response()->json([
            'supplier_performance' => $profitBySupplier,
            'filters' => $filters,
        ]);
    }
}
