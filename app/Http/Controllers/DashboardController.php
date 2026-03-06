<?php
namespace App\Http\Controllers;

use App\Models\Mechanic;
use App\Models\Part;
use App\Models\PartSale;
use App\Models\ServiceOrder;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;

class DashboardController extends Controller
{
    public function index()
    {
        // Workshop-specific statistics
        $totalServiceOrders = ServiceOrder::count();
        $pendingOrders = ServiceOrder::where('status', 'pending')->count();
        $inProgressOrders = ServiceOrder::where('status', 'in_progress')->count();
        $completedOrdersToday = ServiceOrder::where('status', 'completed')
            ->whereDate('updated_at', Carbon::today())
            ->count();

        $todayRevenue = ServiceOrder::where('status', 'completed')
            ->whereDate('updated_at', Carbon::today())
            ->sum(DB::raw('COALESCE(labor_cost, 0) + COALESCE(material_cost, 0)'));

        $activeMechanics = Mechanic::where('status', 'active')->count();
        $totalMechanics = Mechanic::count();

        $lowStockParts = Part::where('status', 'active')
            ->whereColumn('stock', '<=', 'reorder_level')
            ->count();

        $totalParts = Part::where('status', 'active')->count();

        $waitingStockSales = PartSale::where('status', 'waiting_stock')->count();
        $readyPickupSales = PartSale::whereIn('status', ['ready_to_notify', 'waiting_pickup'])->count();

        $workshopRecentOrders = ServiceOrder::with(['customer:id,name', 'vehicle:id,plate_number', 'mechanic:id,name'])
            ->latest()
            ->take(5)
            ->get()
            ->map(function ($order) {
                return [
                    'order_number' => $order->order_number,
                    'status' => $order->status,
                    'customer' => $order->customer?->name ?? '-',
                    'vehicle' => $order->vehicle?->plate_number ?? '-',
                    'mechanic' => $order->mechanic?->name ?? '-',
                    'updated_at' => Carbon::parse($order->updated_at)->format('d M Y H:i'),
                ];
            });

        $urgentLowStockParts = Part::query()
            ->where('status', 'active')
            ->whereColumn('stock', '<=', 'reorder_level')
            ->orderByRaw('(reorder_level - stock) DESC')
            ->take(5)
            ->get(['id', 'name', 'stock', 'reorder_level'])
            ->map(function ($part) {
                return [
                    'id' => $part->id,
                    'name' => $part->name,
                    'stock' => (int) $part->stock,
                    'reorder_level' => (int) $part->reorder_level,
                ];
            });

        $serviceRevenueByDate = ServiceOrder::query()
            ->where('status', 'completed')
            ->selectRaw('DATE(COALESCE(actual_finish_at, updated_at)) as date, SUM(COALESCE(grand_total, COALESCE(labor_cost, 0) + COALESCE(material_cost, 0))) as total')
            ->groupBy('date')
            ->pluck('total', 'date');

        $partRevenueByDate = PartSale::query()
            ->where('status', 'completed')
            ->selectRaw('DATE(COALESCE(sale_date, created_at)) as date, SUM(COALESCE(grand_total, 0)) as total')
            ->groupBy('date')
            ->pluck('total', 'date');

        $revenueTrend = collect($serviceRevenueByDate)
            ->mapWithKeys(fn ($total, $date) => [$date => (int) $total])
            ->merge(
                collect($partRevenueByDate)->mapWithKeys(fn ($total, $date) => [$date => (int) $total])
            )
            ->keys()
            ->unique()
            ->sortDesc()
            ->take(12)
            ->sort()
            ->values()
            ->map(function ($date) use ($serviceRevenueByDate, $partRevenueByDate) {
                $serviceTotal = (int) ($serviceRevenueByDate[$date] ?? 0);
                $partTotal = (int) ($partRevenueByDate[$date] ?? 0);

                return [
                    'date' => $date,
                    'label' => Carbon::parse($date)->format('d M'),
                    'total' => $serviceTotal + $partTotal,
                ];
            });

        return Inertia::render('Dashboard/Index', [
            'revenueTrend'      => $revenueTrend,
            // Workshop statistics
            'workshop' => [
                'totalServiceOrders' => $totalServiceOrders,
                'pendingOrders' => $pendingOrders,
                'inProgressOrders' => $inProgressOrders,
                'completedOrdersToday' => $completedOrdersToday,
                'todayRevenue' => (int) $todayRevenue,
                'activeMechanics' => $activeMechanics,
                'totalMechanics' => $totalMechanics,
                'lowStockParts' => $lowStockParts,
                'totalParts' => $totalParts,
                'waitingStockSales' => $waitingStockSales,
                'readyPickupSales' => $readyPickupSales,
                'recentOrders' => $workshopRecentOrders,
                'urgentLowStockParts' => $urgentLowStockParts,
            ],
        ]);
    }
}
