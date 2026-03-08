<?php

namespace App\Http\Controllers\Apps;

use App\Http\Controllers\Controller;
use App\Models\CashTransaction;
use App\Models\PartSale;
use App\Models\ServiceOrder;
use App\Models\Mechanic;
use App\Models\Part;
use App\Models\Customer;
use Illuminate\Pagination\LengthAwarePaginator;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
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
            ->with(['customer:id,name', 'vehicle:id,plate_number'])
            ->whereIn('status', ['completed', 'paid'])
            ->whereBetween('created_at', [$startDate, $endDate]);

        $serviceRevenue = (int) (clone $serviceBaseQuery)
            ->selectRaw('SUM(COALESCE(grand_total, total, COALESCE(labor_cost, 0) + COALESCE(material_cost, 0))) as total')
            ->value('total');

        $serviceOrders = (clone $serviceBaseQuery)
            ->orderByDesc('created_at')
            ->get();

        $partBaseQuery = PartSale::query()
            ->with(['customer:id,name'])
            ->where('status', '!=', 'cancelled')
            ->whereBetween('created_at', [$startDate, $endDate]);

        $partRevenue = (int) (clone $partBaseQuery)
            ->selectRaw('SUM(COALESCE(grand_total, 0)) as total')
            ->value('total');

        $partSales = (clone $partBaseQuery)
            ->orderByDesc('created_at')
            ->get();

        $cashBaseQuery = CashTransaction::query()
            ->with('user:id,name')
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

        $cashTransactions = (clone $cashBaseQuery)
            ->orderByDesc('happened_at')
            ->orderByDesc('created_at')
            ->get();

        $serviceTimeline = $serviceOrders->map(function ($order) use ($formatStatusLabel) {
            $amount = (int) ($order->grand_total ?? $order->total ?? ((int) ($order->labor_cost ?? 0) + (int) ($order->material_cost ?? 0)));

            return [
                'id' => 'service-' . $order->id,
                'date' => optional($order->created_at)->format('Y-m-d H:i:s'),
                'date_unix' => optional($order->created_at)?->timestamp ?? 0,
                'source' => 'service_order',
                'reference' => $order->order_number,
                'description' => trim(implode(' | ', array_filter([
                    $order->customer?->name,
                    $order->vehicle?->plate_number,
                ]))),
                'flow' => 'in',
                'amount' => $amount,
                'status' => $order->status,
                'status_label' => $formatStatusLabel($order->status),
            ];
        });

        $partTimeline = $partSales->map(function ($sale) use ($formatStatusLabel) {
            return [
                'id' => 'part-' . $sale->id,
                'date' => optional($sale->created_at)->format('Y-m-d H:i:s'),
                'date_unix' => optional($sale->created_at)?->timestamp ?? 0,
                'source' => 'part_sale',
                'reference' => $sale->sale_number,
                'description' => $sale->customer?->name,
                'flow' => 'in',
                'amount' => (int) ($sale->grand_total ?? 0),
                'status' => $sale->status,
                'status_label' => $formatStatusLabel($sale->status),
            ];
        });

        $cashTimeline = $cashTransactions->map(function ($tx) use ($formatStatusLabel) {
            $flow = match ($tx->transaction_type) {
                'income' => 'in',
                'expense', 'change_given' => 'out',
                default => 'neutral',
            };

            $eventDate = $tx->happened_at ?? $tx->created_at;

            return [
                'id' => 'cash-' . $tx->id,
                'date' => optional($eventDate)->format('Y-m-d H:i:s'),
                'date_unix' => optional($eventDate)?->timestamp ?? 0,
                'source' => 'cash_transaction',
                'reference' => 'CASH-' . str_pad((string) $tx->id, 6, '0', STR_PAD_LEFT),
                'description' => $tx->description,
                'flow' => $flow,
                'amount' => (int) $tx->amount,
                'status' => $tx->transaction_type,
                'status_label' => $formatStatusLabel($tx->transaction_type),
            ];
        });

        $timeline = $serviceTimeline
            ->concat($partTimeline)
            ->concat($cashTimeline)
            ->sortByDesc('date_unix')
            ->values();

        $statusOptions = $timeline
            ->pluck('status')
            ->filter(fn ($value) => !empty($value))
            ->unique()
            ->sort()
            ->values()
            ->map(fn ($value) => [
                'value' => $value,
                'label' => $formatStatusLabel($value),
            ])
            ->values();

        if ($status !== 'all' && !$statusOptions->pluck('value')->contains($status)) {
            $status = 'all';
        }

        $sourceFilteredTimeline = $source === 'all'
            ? $timeline
            : $timeline->where('source', $source)->values();

        $filteredTimeline = $status === 'all'
            ? $sourceFilteredTimeline
            : $sourceFilteredTimeline->where('status', $status)->values();

        $statusSummary = $sourceFilteredTimeline
            ->groupBy('status')
            ->map(function ($rows, $statusKey) use ($formatStatusLabel) {
                $netAmount = collect($rows)->sum(function ($row) {
                    $amount = (int) ($row['amount'] ?? 0);
                    return match ($row['flow'] ?? 'neutral') {
                        'in' => $amount,
                        'out' => -$amount,
                        default => 0,
                    };
                });

                return [
                    'value' => $statusKey,
                    'label' => $formatStatusLabel($statusKey),
                    'count' => count($rows),
                    'net_amount' => (int) $netAmount,
                ];
            })
            ->sortByDesc('count')
            ->values();

        $timelineWithRunningBalance = $filteredTimeline
            ->sortBy('date_unix')
            ->values()
            ->reduce(function ($carry, $item) {
                $amount = (int) ($item['amount'] ?? 0);
                $delta = match ($item['flow'] ?? 'neutral') {
                    'in' => $amount,
                    'out' => -$amount,
                    default => 0,
                };

                $running = (int) ($carry['running'] ?? 0) + $delta;
                $item['running_balance'] = $running;
                $carry['running'] = $running;
                $carry['items'][] = $item;

                return $carry;
            }, ['running' => 0, 'items' => []]);

        $displayTimeline = collect($timelineWithRunningBalance['items'] ?? [])
            ->sortByDesc('date_unix')
            ->values();

        $total = $displayTimeline->count();
        $items = $displayTimeline
            ->slice(($currentPage - 1) * $perPage, $perPage)
            ->values();

        $paginatedTransactions = new LengthAwarePaginator(
            $items,
            $total,
            $perPage,
            $currentPage,
            [
                'path' => $request->url(),
                'query' => $request->query(),
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
                'transaction_count' => $filteredTimeline->count(),
            ],
            'transactions' => $paginatedTransactions,
        ]);
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

        $totalRevenue = $summaryQuery->sum('total');
        $totalOrders = $summaryQuery->count();
        $totalLaborCost = $summaryQuery->sum('labor_cost');
        $totalMaterialCost = $summaryQuery->sum('material_cost');
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

        $mechanics = Mechanic::with(['serviceOrders' => function ($query) use ($startDate, $endDate) {
            $query->with('details.service')
                ->whereBetween('created_at', [$startDate, $endDate])
                ->whereIn('status', ['completed', 'paid']);
        }])
        ->get()
        ->map(function ($mechanic) {
            $serviceDetails = $mechanic->serviceOrders
                ->flatMap(fn ($order) => $order->details)
                ->filter(fn ($detail) => !is_null($detail->service_id))
                ->values();

            $estimatedMinutes = $serviceDetails
                ->sum(fn ($detail) => (int) ($detail->service?->est_time_minutes ?? 0));

            $totalLaborCost = $mechanic->serviceOrders->sum('labor_cost');
            $totalMaterialCost = $mechanic->serviceOrders->sum('material_cost');
            $totalServiceRevenue = $serviceDetails->sum('final_amount');
            $totalAutoDiscount = $serviceDetails->sum('auto_discount_amount');
            $totalIncentive = $serviceDetails->sum('incentive_amount');
            $hourlyRate = (int) ($mechanic->hourly_rate ?? 0);
            $baseSalary = (int) round(($estimatedMinutes / 60) * $hourlyRate);
            $totalSalary = $baseSalary + (int) $totalIncentive;

            return [
                'id' => $mechanic->id,
                'name' => $mechanic->name,
                'specialty' => is_array($mechanic->specialization)
                    ? implode(', ', $mechanic->specialization)
                    : ($mechanic->specialization ?? '-'),
                'total_orders' => $mechanic->serviceOrders->count(),
                'total_revenue' => $mechanic->serviceOrders->sum('total'),
                'service_revenue' => $totalServiceRevenue,
                'total_auto_discount' => $totalAutoDiscount,
                'total_incentive' => $totalIncentive,
                'estimated_work_minutes' => $estimatedMinutes,
                'hourly_rate' => $hourlyRate,
                'base_salary' => $baseSalary,
                'total_salary' => $totalSalary,
                'total_labor_cost' => $totalLaborCost,
                'total_material_cost' => $totalMaterialCost,
                'average_order_value' => $mechanic->serviceOrders->count() > 0
                    ? round($mechanic->serviceOrders->sum('total') / $mechanic->serviceOrders->count())
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

        $mechanics = Mechanic::with(['serviceOrders' => function ($query) use ($startDate, $endDate) {
            $query->with('details.service')
                ->whereBetween('created_at', [$startDate, $endDate])
                ->whereIn('status', ['completed', 'paid']);
        }])->get()->map(function ($mechanic) {
            $serviceDetails = $mechanic->serviceOrders
                ->flatMap(fn ($order) => $order->details)
                ->filter(fn ($detail) => !is_null($detail->service_id))
                ->values();

            $estimatedMinutes = $serviceDetails->sum(fn ($detail) => (int) ($detail->service?->est_time_minutes ?? 0));
            $hourlyRate = (int) ($mechanic->hourly_rate ?? 0);
            $baseSalary = (int) round(($estimatedMinutes / 60) * $hourlyRate);
            $incentiveAmount = (int) $serviceDetails->sum('incentive_amount');

            return [
                'id' => $mechanic->id,
                'name' => $mechanic->name,
                'employee_number' => $mechanic->employee_number,
                'total_orders' => $mechanic->serviceOrders->count(),
                'service_count' => $serviceDetails->count(),
                'estimated_work_minutes' => $estimatedMinutes,
                'hourly_rate' => $hourlyRate,
                'base_salary' => $baseSalary,
                'incentive_amount' => $incentiveAmount,
                'take_home_pay' => $baseSalary + $incentiveAmount,
            ];
        })->sortByDesc('take_home_pay')->values();

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

    /**
     * Parts Inventory Analysis Report
     */
    public function partsInventory(Request $request)
    {
        $parts = Part::with('category')
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

        $totalOutstanding = ServiceOrder::where('status', 'completed')
            ->sum('total');

        return inertia('Dashboard/Reports/OutstandingPayments', [
            'orders' => $orders,
            'summary' => [
                'total_outstanding' => $totalOutstanding,
                'count_outstanding' => ServiceOrder::where('status', 'completed')
                    ->count(),
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

                $mechanics = Mechanic::with(['serviceOrders' => function ($query) use ($startDate, $endDate) {
                    $query->with('details.service')
                        ->whereBetween('created_at', [$startDate, $endDate])
                        ->whereIn('status', ['completed', 'paid']);
                }])->get();

                foreach ($mechanics as $mechanic) {
                    $serviceDetails = $mechanic->serviceOrders
                        ->flatMap(fn ($order) => $order->details)
                        ->filter(fn ($detail) => !is_null($detail->service_id))
                        ->values();

                    $estimatedMinutes = (int) $serviceDetails->sum(fn ($detail) => (int) ($detail->service?->est_time_minutes ?? 0));
                    $hourlyRate = (int) ($mechanic->hourly_rate ?? 0);
                    $baseSalary = (int) round(($estimatedMinutes / 60) * $hourlyRate);
                    $incentive = (int) $serviceDetails->sum('incentive_amount');

                    fputcsv($file, [
                        $mechanic->name,
                        $mechanic->serviceOrders->count(),
                        (int) $mechanic->serviceOrders->sum('total'),
                        (int) $serviceDetails->sum('auto_discount_amount'),
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

                $mechanics = Mechanic::with(['serviceOrders' => function ($query) use ($startDate, $endDate) {
                    $query->with('details.service')
                        ->whereBetween('created_at', [$startDate, $endDate])
                        ->whereIn('status', ['completed', 'paid']);
                }])->get();

                foreach ($mechanics as $mechanic) {
                    $serviceDetails = $mechanic->serviceOrders
                        ->flatMap(fn ($order) => $order->details)
                        ->filter(fn ($detail) => !is_null($detail->service_id))
                        ->values();

                    $estimatedMinutes = (int) $serviceDetails->sum(fn ($detail) => (int) ($detail->service?->est_time_minutes ?? 0));
                    $hourlyRate = (int) ($mechanic->hourly_rate ?? 0);
                    $baseSalary = (int) round(($estimatedMinutes / 60) * $hourlyRate);
                    $incentive = (int) $serviceDetails->sum('incentive_amount');

                    fputcsv($file, [
                        $mechanic->name,
                        $mechanic->employee_number,
                        $mechanic->serviceOrders->count(),
                        $serviceDetails->count(),
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

                $serviceRows = ServiceOrder::query()
                    ->with(['customer:id,name', 'vehicle:id,plate_number'])
                    ->whereIn('status', ['completed', 'paid'])
                    ->whereBetween('created_at', [$startDate, $endDate])
                    ->get()
                    ->map(function ($order) use ($formatStatusLabel) {
                        return [
                            'date' => optional($order->created_at)->format('Y-m-d H:i:s'),
                            'date_unix' => optional($order->created_at)?->timestamp ?? 0,
                            'source' => 'service_order',
                            'reference' => $order->order_number,
                            'description' => trim(implode(' | ', array_filter([
                                $order->customer?->name,
                                $order->vehicle?->plate_number,
                            ]))),
                            'flow' => 'in',
                            'amount' => (int) ($order->grand_total ?? $order->total ?? 0),
                            'status' => $order->status,
                            'status_label' => $formatStatusLabel($order->status),
                        ];
                    });

                $partRows = PartSale::query()
                    ->with(['customer:id,name'])
                    ->where('status', '!=', 'cancelled')
                    ->whereBetween('created_at', [$startDate, $endDate])
                    ->get()
                    ->map(function ($sale) use ($formatStatusLabel) {
                        return [
                            'date' => optional($sale->created_at)->format('Y-m-d H:i:s'),
                            'date_unix' => optional($sale->created_at)?->timestamp ?? 0,
                            'source' => 'part_sale',
                            'reference' => $sale->sale_number,
                            'description' => $sale->customer?->name,
                            'flow' => 'in',
                            'amount' => (int) ($sale->grand_total ?? 0),
                            'status' => $sale->status,
                            'status_label' => $formatStatusLabel($sale->status),
                        ];
                    });

                $cashRows = CashTransaction::query()
                    ->where(function ($query) use ($startDate, $endDate) {
                        $query->whereBetween('happened_at', [$startDate, $endDate])
                            ->orWhere(function ($fallback) use ($startDate, $endDate) {
                                $fallback->whereNull('happened_at')
                                    ->whereBetween('created_at', [$startDate, $endDate]);
                            });
                    })
                    ->get()
                    ->map(function ($tx) use ($formatStatusLabel) {
                        $flow = match ($tx->transaction_type) {
                            'income' => 'in',
                            'expense', 'change_given' => 'out',
                            default => 'neutral',
                        };
                        $eventDate = $tx->happened_at ?? $tx->created_at;

                        return [
                            'date' => optional($eventDate)->format('Y-m-d H:i:s'),
                            'date_unix' => optional($eventDate)?->timestamp ?? 0,
                            'source' => 'cash_transaction',
                            'reference' => 'CASH-' . str_pad((string) $tx->id, 6, '0', STR_PAD_LEFT),
                            'description' => $tx->description,
                            'flow' => $flow,
                            'amount' => (int) $tx->amount,
                            'status' => $tx->transaction_type,
                            'status_label' => $formatStatusLabel($tx->transaction_type),
                        ];
                    });

                $rows = $serviceRows->concat($partRows)->concat($cashRows)->sortByDesc('date_unix')->values();
                if ($source !== 'all') {
                    $rows = $rows->where('source', $source)->values();
                }
                if ($status !== 'all') {
                    $rows = $rows->where('status', $status)->values();
                }

                $rowsWithBalance = $rows
                    ->sortBy('date_unix')
                    ->values()
                    ->reduce(function ($carry, $row) {
                        $amount = (int) ($row['amount'] ?? 0);
                        $delta = match ($row['flow'] ?? 'neutral') {
                            'in' => $amount,
                            'out' => -$amount,
                            default => 0,
                        };
                        $running = (int) ($carry['running'] ?? 0) + $delta;
                        $row['running_balance'] = $running;
                        $carry['running'] = $running;
                        $carry['items'][] = $row;
                        return $carry;
                    }, ['running' => 0, 'items' => []]);

                $rows = collect($rowsWithBalance['items'] ?? [])->sortByDesc('date_unix')->values();

                fputcsv($file, ['Tanggal', 'Sumber', 'Referensi', 'Keterangan', 'Arus', 'Nominal', 'Status', 'Status Label', 'Saldo Berjalan']);
                foreach ($rows as $row) {
                    fputcsv($file, [
                        $row['date'] ?? '-',
                        $row['source'] ?? '-',
                        $row['reference'] ?? '-',
                        $row['description'] ?? '-',
                        $row['flow'] ?? '-',
                        (int) ($row['amount'] ?? 0),
                        $row['status'] ?? '-',
                        $row['status_label'] ?? '-',
                        (int) ($row['running_balance'] ?? 0),
                    ]);
                }
            }

            fclose($file);
        };

        return response()->stream($callback, 200, $headers);
    }
}
