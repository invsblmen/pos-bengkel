<?php

namespace App\Http\Controllers\Apps;

use App\Http\Controllers\Controller;
use App\Models\CashTransaction;
use App\Models\PartSale;
use App\Models\ServiceOrder;
use App\Models\Mechanic;
use App\Models\Part;
use Illuminate\Http\Request;
use Illuminate\Pagination\LengthAwarePaginator;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;

class ServiceReportController extends Controller
{
    public function overall(Request $request)
    {
        $startDate = Carbon::parse($request->get('start_date', now()->firstOfMonth()))->startOfDay();
        $endDate = Carbon::parse($request->get('end_date', now()))->endOfDay();
        $source = $request->get('source', 'all');
        $allowedSources = ['all', 'service_order', 'part_sale', 'cash_transaction'];
        if (!in_array($source, $allowedSources, true)) {
            $source = 'all';
        }
        $status = $request->get('status', 'all');

        $perPage = (int) $request->get('per_page', 20);
        $perPage = max(10, min($perPage, 100));
        $currentPage = (int) $request->get('page', 1);
        $currentPage = max(1, $currentPage);

        $statusLabelMap = [
            'completed' => 'Selesai',
            'paid' => 'Lunas',
            'draft' => 'Draft',
            'confirmed' => 'Dikonfirmasi',
            'waiting_stock' => 'Menunggu Stok',
            'ready_to_notify' => 'Siap Diberitahu',
            'waiting_pickup' => 'Menunggu Diambil',
            'cancelled' => 'Dibatalkan',
            'income' => 'Kas Masuk',
            'expense' => 'Kas Keluar',
            'change_given' => 'Kembalian',
            'adjustment' => 'Penyesuaian',
        ];

        $formatStatusLabel = function (?string $status) use ($statusLabelMap): string {
            if (empty($status)) {
                return '-';
            }

            return $statusLabelMap[$status] ?? ucwords(str_replace('_', ' ', $status));
        };

        $serviceBaseQuery = ServiceOrder::query()
            ->whereIn('status', ['completed', 'paid'])
            ->whereBetween('created_at', [$startDate, $endDate]);

        $serviceRevenue = (int) (clone $serviceBaseQuery)
            ->selectRaw('SUM(COALESCE(grand_total, total, COALESCE(labor_cost, 0) + COALESCE(material_cost, 0))) as total')
            ->value('total');

        $partBaseQuery = PartSale::query()
            ->where('status', '!=', 'cancelled')
            ->whereBetween('created_at', [$startDate, $endDate]);

        $partRevenue = (int) (clone $partBaseQuery)
            ->selectRaw('SUM(COALESCE(grand_total, 0)) as total')
            ->value('total');

        $cashBaseQuery = CashTransaction::query()
            ->where(function ($query) use ($startDate, $endDate) {
                $query->whereBetween('happened_at', [$startDate, $endDate])
                    ->orWhere(function ($fallback) use ($startDate, $endDate) {
                        $fallback->whereNull('happened_at')
                            ->whereBetween('created_at', [$startDate, $endDate]);
                    });
            });

        $cashIn = (int) (clone $cashBaseQuery)
            ->whereIn('transaction_type', ['income'])
            ->sum('amount');

        $cashOut = (int) (clone $cashBaseQuery)
            ->whereIn('transaction_type', ['expense', 'change_given'])
            ->sum('amount');

        $overallCacheKey = 'reports:overall:' . sha1(json_encode([
            'start_date' => $startDate->format('Y-m-d H:i:s'),
            'end_date' => $endDate->format('Y-m-d H:i:s'),
            'source' => $source,
            'status' => $status,
            'per_page' => $perPage,
            'page' => $currentPage,
        ]));

        $cachedOverall = Cache::remember($overallCacheKey, now()->addSeconds(45), function () use ($startDate, $endDate, $source, $status, $perPage, $currentPage, $formatStatusLabel, $request) {
            $rowsBaseQuery = DB::query()->fromSub($this->buildOverallRowsQuery($startDate, $endDate), 'rows');

            $statusValues = (clone $rowsBaseQuery)
                ->whereNotNull('status')
                ->where('status', '!=', '')
                ->select('status')
                ->distinct()
                ->orderBy('status')
                ->pluck('status');

            $statusOptions = collect($statusValues)
                ->map(fn ($value) => [
                    'value' => $value,
                    'label' => $formatStatusLabel($value),
                ])
                ->values();

            $effectiveStatus = $status;
            if ($effectiveStatus !== 'all' && !collect($statusValues)->contains($effectiveStatus)) {
                $effectiveStatus = 'all';
            }

            $sourceFilteredRows = clone $rowsBaseQuery;
            if ($source !== 'all') {
                $sourceFilteredRows->where('source', $source);
            }

            $statusSummary = DB::query()
                ->fromSub($sourceFilteredRows, 'source_rows')
                ->whereNotNull('status')
                ->where('status', '!=', '')
                ->selectRaw('status as value')
                ->selectRaw('COUNT(*) as count')
                ->selectRaw("SUM(CASE WHEN flow = 'in' THEN amount WHEN flow = 'out' THEN -amount ELSE 0 END) as net_amount")
                ->groupBy('status')
                ->orderByDesc('count')
                ->get()
                ->map(function ($row) use ($formatStatusLabel) {
                    return [
                        'value' => $row->value,
                        'label' => $formatStatusLabel($row->value),
                        'count' => (int) ($row->count ?? 0),
                        'net_amount' => (int) ($row->net_amount ?? 0),
                    ];
                })
                ->values();

            $filteredRows = clone $sourceFilteredRows;
            if ($effectiveStatus !== 'all') {
                $filteredRows->where('status', $effectiveStatus);
            }

            $rowsWithBalance = DB::query()
                ->fromSub($filteredRows, 'filtered_rows')
                ->selectRaw('event_at, source, reference, description, flow, amount, status')
                ->selectRaw("SUM(CASE WHEN flow = 'in' THEN amount WHEN flow = 'out' THEN -amount ELSE 0 END) OVER (ORDER BY event_at ASC, reference ASC) as running_balance");

            $paginatedTransactions = DB::query()
                ->fromSub($rowsWithBalance, 'rows_with_balance')
                ->selectRaw('event_at, source, reference, description, flow, amount, status, running_balance')
                ->orderByDesc('event_at')
                ->orderByDesc('reference')
                ->paginate($perPage, ['*'], 'page', $currentPage)
                ->withQueryString();

            $transactionItems = $paginatedTransactions->getCollection()->map(function ($row) use ($formatStatusLabel) {
                $reference = (string) ($row->reference ?? '');
                $source = (string) ($row->source ?? '');

                return [
                    'id' => $source . '-' . $reference,
                    'date' => $row->event_at,
                    'date_unix' => $row->event_at ? Carbon::parse($row->event_at)->timestamp : 0,
                    'source' => $source,
                    'reference' => $reference,
                    'description' => $row->description,
                    'flow' => $row->flow,
                    'amount' => (int) ($row->amount ?? 0),
                    'status' => $row->status,
                    'status_label' => $formatStatusLabel($row->status),
                    'running_balance' => (int) ($row->running_balance ?? 0),
                ];
            })->values();

            return [
                'status_options' => $statusOptions->all(),
                'status_summary' => $statusSummary->all(),
                'effective_status' => $effectiveStatus,
                'transaction_count' => (int) $paginatedTransactions->total(),
                'transactions' => [
                    'items' => $transactionItems->all(),
                    'total' => (int) $paginatedTransactions->total(),
                    'per_page' => (int) $paginatedTransactions->perPage(),
                    'current_page' => (int) $paginatedTransactions->currentPage(),
                    'path' => $request->url(),
                    'query' => $request->query(),
                ],
            ];
        });

        $status = (string) ($cachedOverall['effective_status'] ?? $status);
        $statusOptions = collect($cachedOverall['status_options'] ?? [])->values();
        $statusSummary = collect($cachedOverall['status_summary'] ?? [])->values();

        $transactionMeta = $cachedOverall['transactions'] ?? [];
        $paginatedTransactions = new LengthAwarePaginator(
            collect($transactionMeta['items'] ?? []),
            (int) ($transactionMeta['total'] ?? 0),
            (int) ($transactionMeta['per_page'] ?? $perPage),
            (int) ($transactionMeta['current_page'] ?? $currentPage),
            [
                'path' => $transactionMeta['path'] ?? $request->url(),
                'query' => $transactionMeta['query'] ?? $request->query(),
            ]
        );

        return inertia('Dashboard/Reports/Overall', [
            'filters' => [
                'start_date' => $startDate->format('Y-m-d'),
                'end_date' => $endDate->format('Y-m-d'),
                'source' => $source,
                'status' => $status,
                'per_page' => $perPage,
            ],
            'statusOptions' => $statusOptions,
            'statusSummary' => $statusSummary,
            'summary' => [
                'service_revenue' => $serviceRevenue,
                'part_revenue' => $partRevenue,
                'total_revenue' => $serviceRevenue + $partRevenue,
                'cash_in' => $cashIn,
                'cash_out' => $cashOut,
                'net_cash_flow' => $cashIn - $cashOut,
                'transaction_count' => (int) ($cachedOverall['transaction_count'] ?? $paginatedTransactions->total()),
            ],
            'transactions' => $paginatedTransactions,
        ]);
    }

    private function buildOverallRowsQuery(Carbon $startDate, Carbon $endDate)
    {
        $serviceRows = DB::table('service_orders')
            ->leftJoin('customers', 'service_orders.customer_id', '=', 'customers.id')
            ->leftJoin('vehicles', 'service_orders.vehicle_id', '=', 'vehicles.id')
            ->whereIn('service_orders.status', ['completed', 'paid'])
            ->whereBetween('service_orders.created_at', [$startDate, $endDate])
            ->selectRaw("service_orders.created_at as event_at, 'service_order' as source, service_orders.order_number as reference, TRIM(CONCAT_WS(' | ', customers.name, vehicles.plate_number)) as description, 'in' as flow, COALESCE(service_orders.grand_total, service_orders.total, 0) as amount, service_orders.status as status");

        $partRows = DB::table('part_sales')
            ->leftJoin('customers', 'part_sales.customer_id', '=', 'customers.id')
            ->where('part_sales.status', '!=', 'cancelled')
            ->whereBetween('part_sales.created_at', [$startDate, $endDate])
            ->selectRaw("part_sales.created_at as event_at, 'part_sale' as source, part_sales.sale_number as reference, customers.name as description, 'in' as flow, COALESCE(part_sales.grand_total, 0) as amount, part_sales.status as status");

        $cashRows = DB::table('cash_transactions')
            ->where(function ($query) use ($startDate, $endDate) {
                $query->whereBetween('happened_at', [$startDate, $endDate])
                    ->orWhere(function ($fallback) use ($startDate, $endDate) {
                        $fallback->whereNull('happened_at')
                            ->whereBetween('created_at', [$startDate, $endDate]);
                    });
            })
            ->selectRaw("COALESCE(cash_transactions.happened_at, cash_transactions.created_at) as event_at, 'cash_transaction' as source, CONCAT('CASH-', LPAD(cash_transactions.id, 6, '0')) as reference, cash_transactions.description as description, CASE WHEN cash_transactions.transaction_type = 'income' THEN 'in' WHEN cash_transactions.transaction_type IN ('expense','change_given') THEN 'out' ELSE 'neutral' END as flow, cash_transactions.amount as amount, cash_transactions.transaction_type as status");

        return $serviceRows->unionAll($partRows)->unionAll($cashRows);
    }

    /**
     * Service Revenue Report
     */
    public function revenue(Request $request)
    {
        $startDate = $request->get('start_date', now()->firstOfMonth());
        $endDate = $request->get('end_date', now());
        $period = $request->get('period', 'daily'); // daily, weekly, monthly

        $startDate = Carbon::parse($startDate)->startOfDay();
        $endDate = Carbon::parse($endDate)->endOfDay();

        // Build query - include both completed and paid orders
        $query = ServiceOrder::whereIn('status', ['completed', 'paid'])
            ->whereBetween('created_at', [$startDate, $endDate]);

        // Group by period
        if ($period === 'daily') {
            $data = $query->selectRaw('DATE(created_at) as date, COUNT(*) as count, SUM(total) as revenue, SUM(labor_cost) as labor_cost, SUM(material_cost) as material_cost')
                ->groupByRaw('DATE(created_at)')
                ->orderBy('date')
                ->get();
        } elseif ($period === 'weekly') {
            $data = $query->selectRaw('YEAR(created_at) as year, WEEK(created_at) as week, COUNT(*) as count, SUM(total) as revenue, SUM(labor_cost) as labor_cost, SUM(material_cost) as material_cost')
                ->groupByRaw('YEAR(created_at), WEEK(created_at)')
                ->orderBy('year')
                ->orderBy('week')
                ->get();
        } else { // monthly
            $data = $query->selectRaw('YEAR(created_at) as year, MONTH(created_at) as month, COUNT(*) as count, SUM(total) as revenue, SUM(labor_cost) as labor_cost, SUM(material_cost) as material_cost')
                ->groupByRaw('YEAR(created_at), MONTH(created_at)')
                ->orderBy('year')
                ->orderBy('month')
                ->get();
        }

        // Summary stats - rebuild query without groupBy/orderBy
        $summaryQuery = ServiceOrder::whereIn('status', ['completed', 'paid'])
            ->whereBetween('created_at', [$startDate, $endDate]);

        $summaryData = $summaryQuery
            ->selectRaw('COALESCE(SUM(total), 0) as total_revenue')
            ->selectRaw('COUNT(*) as total_orders')
            ->selectRaw('COALESCE(SUM(labor_cost), 0) as total_labor_cost')
            ->selectRaw('COALESCE(SUM(material_cost), 0) as total_material_cost')
            ->first();

        $totalRevenue = (int) ($summaryData->total_revenue ?? 0);
        $totalOrders = (int) ($summaryData->total_orders ?? 0);
        $totalLaborCost = (int) ($summaryData->total_labor_cost ?? 0);
        $totalMaterialCost = (int) ($summaryData->total_material_cost ?? 0);
        $averageOrderValue = $totalOrders > 0 ? round($totalRevenue / $totalOrders) : 0;

        return inertia('Dashboard/Reports/ServiceRevenue', [
            'report_data' => $data,
            'filters' => [
                'start_date' => $startDate->format('Y-m-d'),
                'end_date' => $endDate->format('Y-m-d'),
                'period' => $period,
            ],
            'summary' => [
                'total_revenue' => $totalRevenue,
                'total_orders' => $totalOrders,
                'total_labor_cost' => $totalLaborCost,
                'total_material_cost' => $totalMaterialCost,
                'average_order_value' => $averageOrderValue,
            ],
        ]);
    }

    /**
     * Mechanic Productivity Report
     */
    public function mechanicProductivity(Request $request)
    {
        $startDate = $request->get('start_date', now()->firstOfMonth());
        $endDate = $request->get('end_date', now());

        $startDate = Carbon::parse($startDate)->startOfDay();
        $endDate = Carbon::parse($endDate)->endOfDay();

        $mechanics = $this->getMechanicAggregates($startDate, $endDate)
            ->map(function ($mechanic) {
                $estimatedMinutes = (int) ($mechanic->estimated_work_minutes ?? 0);
                $totalIncentive = (int) ($mechanic->total_incentive ?? 0);
                $totalRevenue = (int) ($mechanic->total_revenue ?? 0);
                $totalOrders = (int) ($mechanic->total_orders ?? 0);
                $hourlyRate = (int) ($mechanic->hourly_rate ?? 0);
                $baseSalary = (int) round(($estimatedMinutes / 60) * $hourlyRate);
                $totalSalary = $baseSalary + $totalIncentive;

                return [
                    'id' => $mechanic->id,
                    'name' => $mechanic->name,
                    'specialty' => is_array($mechanic->specialization)
                        ? implode(', ', $mechanic->specialization)
                        : ($mechanic->specialization ?? '-'),
                    'total_orders' => $totalOrders,
                    'total_revenue' => $totalRevenue,
                    'service_revenue' => (int) ($mechanic->service_revenue ?? 0),
                    'total_auto_discount' => (int) ($mechanic->total_auto_discount ?? 0),
                    'total_incentive' => $totalIncentive,
                    'estimated_work_minutes' => $estimatedMinutes,
                    'hourly_rate' => $hourlyRate,
                    'base_salary' => $baseSalary,
                    'total_salary' => $totalSalary,
                    'total_labor_cost' => (int) ($mechanic->total_labor_cost ?? 0),
                    'total_material_cost' => (int) ($mechanic->total_material_cost ?? 0),
                    'average_order_value' => $totalOrders > 0
                        ? (int) round($totalRevenue / $totalOrders)
                        : 0,
                ];
            })
            ->sortByDesc('total_revenue')
            ->values();

        return inertia('Dashboard/Reports/MechanicProductivity', [
            'mechanics' => $mechanics,
            'filters' => [
                'start_date' => $startDate->format('Y-m-d'),
                'end_date' => $endDate->format('Y-m-d'),
            ],
            'summary' => [
                'total_mechanics' => $mechanics->count(),
                'total_revenue' => $mechanics->sum('total_revenue'),
                'total_orders' => $mechanics->sum('total_orders'),
                'total_incentive' => $mechanics->sum('total_incentive'),
                'total_salary' => $mechanics->sum('total_salary'),
            ],
        ]);
    }

    public function mechanicPayroll(Request $request)
    {
        $startDate = Carbon::parse($request->get('start_date', now()->firstOfMonth()))->startOfDay();
        $endDate = Carbon::parse($request->get('end_date', now()))->endOfDay();

        $mechanics = $this->getMechanicAggregates($startDate, $endDate)
            ->map(function ($mechanic) {
                $estimatedMinutes = (int) ($mechanic->estimated_work_minutes ?? 0);
                $hourlyRate = (int) ($mechanic->hourly_rate ?? 0);
                $baseSalary = (int) round(($estimatedMinutes / 60) * $hourlyRate);
                $incentiveAmount = (int) ($mechanic->total_incentive ?? 0);

                return [
                    'id' => $mechanic->id,
                    'name' => $mechanic->name,
                    'employee_number' => $mechanic->employee_number,
                    'total_orders' => (int) ($mechanic->total_orders ?? 0),
                    'service_count' => (int) ($mechanic->service_count ?? 0),
                    'estimated_work_minutes' => $estimatedMinutes,
                    'hourly_rate' => $hourlyRate,
                    'base_salary' => $baseSalary,
                    'incentive_amount' => $incentiveAmount,
                    'take_home_pay' => $baseSalary + $incentiveAmount,
                ];
            })
            ->sortByDesc('take_home_pay')
            ->values();

        return inertia('Dashboard/Reports/MechanicPayroll', [
            'mechanics' => $mechanics,
            'filters' => [
                'start_date' => $startDate->format('Y-m-d'),
                'end_date' => $endDate->format('Y-m-d'),
            ],
            'summary' => [
                'total_mechanics' => $mechanics->count(),
                'total_base_salary' => $mechanics->sum('base_salary'),
                'total_incentive' => $mechanics->sum('incentive_amount'),
                'total_take_home_pay' => $mechanics->sum('take_home_pay'),
            ],
        ]);
    }

    private function getMechanicAggregates(Carbon $startDate, Carbon $endDate)
    {
        $ordersSummary = ServiceOrder::query()
            ->whereBetween('created_at', [$startDate, $endDate])
            ->whereIn('status', ['completed', 'paid'])
            ->whereNotNull('mechanic_id')
            ->selectRaw('mechanic_id')
            ->selectRaw('COUNT(*) as total_orders')
            ->selectRaw('COALESCE(SUM(total), 0) as total_revenue')
            ->selectRaw('COALESCE(SUM(labor_cost), 0) as total_labor_cost')
            ->selectRaw('COALESCE(SUM(material_cost), 0) as total_material_cost')
            ->groupBy('mechanic_id');

        $detailsSummary = DB::table('service_order_details as sod')
            ->join('service_orders as so', 'sod.service_order_id', '=', 'so.id')
            ->leftJoin('services as s', 'sod.service_id', '=', 's.id')
            ->whereBetween('so.created_at', [$startDate, $endDate])
            ->whereIn('so.status', ['completed', 'paid'])
            ->whereNotNull('so.mechanic_id')
            ->whereNotNull('sod.service_id')
            ->selectRaw('so.mechanic_id')
            ->selectRaw('COUNT(*) as service_count')
            ->selectRaw('COALESCE(SUM(s.est_time_minutes), 0) as estimated_work_minutes')
            ->selectRaw('COALESCE(SUM(sod.final_amount), 0) as service_revenue')
            ->selectRaw('COALESCE(SUM(sod.auto_discount_amount), 0) as total_auto_discount')
            ->selectRaw('COALESCE(SUM(sod.incentive_amount), 0) as total_incentive')
            ->groupBy('so.mechanic_id');

        return Mechanic::query()
            ->leftJoinSub($ordersSummary, 'order_summary', function ($join) {
                $join->on('mechanics.id', '=', 'order_summary.mechanic_id');
            })
            ->leftJoinSub($detailsSummary, 'detail_summary', function ($join) {
                $join->on('mechanics.id', '=', 'detail_summary.mechanic_id');
            })
            ->select('mechanics.*')
            ->selectRaw('COALESCE(order_summary.total_orders, 0) as total_orders')
            ->selectRaw('COALESCE(order_summary.total_revenue, 0) as total_revenue')
            ->selectRaw('COALESCE(order_summary.total_labor_cost, 0) as total_labor_cost')
            ->selectRaw('COALESCE(order_summary.total_material_cost, 0) as total_material_cost')
            ->selectRaw('COALESCE(detail_summary.service_count, 0) as service_count')
            ->selectRaw('COALESCE(detail_summary.estimated_work_minutes, 0) as estimated_work_minutes')
            ->selectRaw('COALESCE(detail_summary.service_revenue, 0) as service_revenue')
            ->selectRaw('COALESCE(detail_summary.total_auto_discount, 0) as total_auto_discount')
            ->selectRaw('COALESCE(detail_summary.total_incentive, 0) as total_incentive')
            ->get();
    }

    /**
     * Parts Inventory Analysis Report
     */
    public function partsInventory(Request $request)
    {
        $parts = Part::query()
            ->with('category:id,name')
            ->select(['id', 'name', 'category_id', 'stock', 'reorder_level', 'price'])
            ->get()
            ->map(function ($part) {
                return [
                    'id' => $part->id,
                    'name' => $part->name,
                    'category' => $part->category?->name,
                    'stock' => $part->stock,
                    'reorder_level' => $part->reorder_level ?? 10,
                    'price' => $part->price,
                    'stock_value' => ($part->stock ?? 0) * ($part->price ?? 0),
                    'status' => $part->stock <= ($part->reorder_level ?? 10) ? 'low' : 'good',
                ];
            });

        // Filter by status if requested
        if ($request->get('status') === 'low') {
            $parts = $parts->filter(fn($p) => $p['status'] === 'low');
        }

        return inertia('Dashboard/Reports/PartsInventory', [
            'parts' => $parts->values(),
            'filters' => [
                'status' => $request->get('status', 'all'),
            ],
            'summary' => [
                'total_parts' => $parts->count(),
                'total_stock_value' => $parts->sum('stock_value'),
                'low_stock_items' => $parts->where('status', 'low')->count(),
            ],
        ]);
    }

    /**
     * Outstanding Payments Report
     */
    public function outstandingPayments(Request $request)
    {
        // Outstanding = completed but not paid yet
        $orders = ServiceOrder::with('customer', 'vehicle')
            ->where('status', 'completed')
            ->orderByDesc('created_at')
            ->paginate(20);

        $orders->getCollection()->transform(function ($order) {
            $createdAt = Carbon::parse($order->created_at);
            $daysOutstanding = $createdAt->diffInDays(now(), false); // false = unsigned

            return [
                'id' => $order->id,
                'order_number' => $order->order_number,
                'customer_name' => $order->customer?->name,
                'vehicle_plate' => $order->vehicle?->plate_number,
                'total' => $order->total,
                'labor_cost' => $order->labor_cost ?? 0,
                'material_cost' => $order->material_cost ?? 0,
                'status' => $order->status,
                'days_outstanding' => max(0, floor($daysOutstanding)), // Round down and ensure non-negative
                'created_at' => $order->created_at,
            ];
        });

        $outstandingSummary = ServiceOrder::where('status', 'completed')
            ->selectRaw('COALESCE(SUM(total), 0) as total_outstanding, COUNT(*) as count_outstanding')
            ->first();

        return inertia('Dashboard/Reports/OutstandingPayments', [
            'orders' => $orders,
            'summary' => [
                'total_outstanding' => (int) ($outstandingSummary->total_outstanding ?? 0),
                'count_outstanding' => (int) ($outstandingSummary->count_outstanding ?? 0),
            ],
        ]);
    }

    /**
     * Export report to CSV
     */
    public function exportCsv(Request $request)
    {
        $type = $request->get('type', 'revenue');
        $startDate = Carbon::parse($request->get('start_date', now()->firstOfMonth()))->startOfDay();
        $endDate = Carbon::parse($request->get('end_date', now()))->endOfDay();

        $filename = $type . '_report_' . now()->format('Y-m-d_His') . '.csv';

        $headers = [
            'Content-Type' => 'text/csv; charset=utf-8',
            'Content-Disposition' => "attachment; filename=$filename",
        ];

        $callback = function () use ($request, $type, $startDate, $endDate) {
            $file = fopen('php://output', 'w');

            if ($type === 'revenue') {
                fputcsv($file, ['Tanggal', 'Jumlah Pesanan', 'Pendapatan', 'Biaya Tenaga Kerja', 'Biaya Material']);
                $data = ServiceOrder::whereIn('status', ['completed', 'paid'])
                    ->whereBetween('created_at', [$startDate, $endDate])
                    ->selectRaw('DATE(created_at) as date, COUNT(*) as count, SUM(total) as revenue, SUM(labor_cost) as labor_cost, SUM(material_cost) as material_cost')
                    ->groupByRaw('DATE(created_at)')
                    ->get();

                foreach ($data as $row) {
                    fputcsv($file, [$row->date, $row->count, $row->revenue, $row->labor_cost, $row->material_cost]);
                }
            } elseif ($type === 'mechanic_productivity') {
                fputcsv($file, [
                    'Mekanik',
                    'Total Order',
                    'Total Revenue',
                    'Auto Diskon',
                    'Insentif',
                    'Estimasi Menit Kerja',
                    'Tarif per Jam',
                    'Gaji Pokok',
                    'Total Gaji',
                ]);

                $mechanics = $this->getMechanicAggregates($startDate, $endDate);

                foreach ($mechanics as $mechanic) {
                    $estimatedMinutes = (int) ($mechanic->estimated_work_minutes ?? 0);
                    $hourlyRate = (int) ($mechanic->hourly_rate ?? 0);
                    $baseSalary = (int) round(($estimatedMinutes / 60) * $hourlyRate);
                    $incentive = (int) ($mechanic->total_incentive ?? 0);

                    fputcsv($file, [
                        $mechanic->name,
                        (int) ($mechanic->total_orders ?? 0),
                        (int) ($mechanic->total_revenue ?? 0),
                        (int) ($mechanic->total_auto_discount ?? 0),
                        $incentive,
                        $estimatedMinutes,
                        $hourlyRate,
                        $baseSalary,
                        $baseSalary + $incentive,
                    ]);
                }
            } elseif ($type === 'mechanic_payroll') {
                fputcsv($file, [
                    'Mekanik',
                    'No Pegawai',
                    'Total Order',
                    'Jumlah Layanan',
                    'Estimasi Menit Kerja',
                    'Tarif per Jam',
                    'Gaji Pokok',
                    'Insentif',
                    'Take Home Pay',
                ]);

                $mechanics = $this->getMechanicAggregates($startDate, $endDate);

                foreach ($mechanics as $mechanic) {
                    $estimatedMinutes = (int) ($mechanic->estimated_work_minutes ?? 0);
                    $hourlyRate = (int) ($mechanic->hourly_rate ?? 0);
                    $baseSalary = (int) round(($estimatedMinutes / 60) * $hourlyRate);
                    $incentive = (int) ($mechanic->total_incentive ?? 0);

                    fputcsv($file, [
                        $mechanic->name,
                        $mechanic->employee_number,
                        (int) ($mechanic->total_orders ?? 0),
                        (int) ($mechanic->service_count ?? 0),
                        $estimatedMinutes,
                        $hourlyRate,
                        $baseSalary,
                        $incentive,
                        $baseSalary + $incentive,
                    ]);
                }
            } elseif ($type === 'overall') {
                $source = $request->get('source', 'all');
                $allowedSources = ['all', 'service_order', 'part_sale', 'cash_transaction'];
                if (!in_array($source, $allowedSources, true)) {
                    $source = 'all';
                }
                $status = $request->get('status', 'all');

                $statusLabelMap = [
                    'completed' => 'Selesai',
                    'paid' => 'Lunas',
                    'draft' => 'Draft',
                    'confirmed' => 'Dikonfirmasi',
                    'waiting_stock' => 'Menunggu Stok',
                    'ready_to_notify' => 'Siap Diberitahu',
                    'waiting_pickup' => 'Menunggu Diambil',
                    'cancelled' => 'Dibatalkan',
                    'income' => 'Kas Masuk',
                    'expense' => 'Kas Keluar',
                    'change_given' => 'Kembalian',
                    'adjustment' => 'Penyesuaian',
                ];

                $formatStatusLabel = function (?string $status) use ($statusLabelMap): string {
                    if (empty($status)) {
                        return '-';
                    }

                    return $statusLabelMap[$status] ?? ucwords(str_replace('_', ' ', $status));
                };

                $filteredRows = DB::query()->fromSub($this->buildOverallRowsQuery($startDate, $endDate), 'rows');

                if ($source !== 'all') {
                    $filteredRows->where('rows.source', $source);
                }

                if ($status !== 'all') {
                    $filteredRows->where('rows.status', $status);
                }

                $rowsWithBalance = DB::query()
                    ->fromSub($filteredRows, 'filtered')
                    ->selectRaw('event_at, source, reference, description, flow, amount, status')
                    ->selectRaw("SUM(CASE WHEN flow = 'in' THEN amount WHEN flow = 'out' THEN -amount ELSE 0 END) OVER (ORDER BY event_at ASC, reference ASC) as running_balance");

                $rows = DB::query()
                    ->fromSub($rowsWithBalance, 'final_rows')
                    ->orderByDesc('event_at')
                    ->orderByDesc('reference')
                    ->cursor();

                fputcsv($file, ['Tanggal', 'Sumber', 'Referensi', 'Keterangan', 'Arus', 'Nominal', 'Status', 'Status Label', 'Saldo Berjalan']);
                foreach ($rows as $row) {
                    fputcsv($file, [
                        $row->event_at ?? '-',
                        $row->source ?? '-',
                        $row->reference ?? '-',
                        $row->description ?? '-',
                        $row->flow ?? '-',
                        (int) ($row->amount ?? 0),
                        $row->status ?? '-',
                        $formatStatusLabel($row->status ?? null),
                        (int) ($row->running_balance ?? 0),
                    ]);
                }
            }

            fclose($file);
        };

        return response()->stream($callback, 200, $headers);
    }
}
