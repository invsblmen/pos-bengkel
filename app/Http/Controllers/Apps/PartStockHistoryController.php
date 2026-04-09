<?php

namespace App\Http\Controllers\Apps;

use App\Http\Controllers\Controller;
use App\Models\Part;
use App\Models\PartSale;
use App\Models\PartStockMovement;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;
use Inertia\Inertia;

class PartStockHistoryController extends Controller
{
    public function index(Request $request)
    {
        if ((bool) config('go_backend.features.part_stock_history_index', false)) {
            $proxied = $this->partStockHistoryIndexViaGo($request);
            if ($proxied !== null) {
                return Inertia::render('Dashboard/PartStockHistory/Index', $proxied);
            }
        }

        // Build query - only include references used by active workshop flows
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
                    // Only search in active model types (exclude legacy Transaction/Purchase references)
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

    private function partStockHistoryIndexViaGo(Request $request): ?array
    {
        $baseUrl = rtrim((string) config('go_backend.base_url', 'http://127.0.0.1:8081'), '/');
        $timeout = (int) config('go_backend.timeout_seconds', 5);
        $requestId = (string) ($request->header('X-Request-Id') ?: Str::uuid());

        try {
            $response = Http::timeout($timeout)
                ->acceptJson()
                ->withHeaders([
                    'X-Request-Id' => $requestId,
                ])
                ->get($baseUrl . '/api/v1/part-stock-history', $request->query());

            $json = $response->json();
            if (! $response->successful() || ! is_array($json)) {
                Log::warning('Part stock history Go bridge returned an invalid response', [
                    'status' => $response->status(),
                ]);

                return null;
            }

            if (! isset($json['movements'], $json['parts'], $json['types'], $json['filters'])) {
                Log::warning('Part stock history Go bridge response is missing expected keys', [
                    'keys' => array_keys($json),
                ]);

                return null;
            }

            return $json;
        } catch (\Throwable $e) {
            return null;
        }
    }

    public function export(Request $request)
    {
        if ((bool) config('go_backend.features.part_stock_history_export', false)) {
            $proxied = $this->partStockHistoryExportViaGo($request);
            if ($proxied !== null) {
                return $proxied;
            }
        }

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

    private function partStockHistoryExportViaGo(Request $request): ?\Illuminate\Http\Response
    {
        $baseUrl = rtrim((string) config('go_backend.base_url', 'http://127.0.0.1:8081'), '/');
        $timeout = (int) config('go_backend.timeout_seconds', 5);
        $requestId = (string) ($request->header('X-Request-Id') ?: Str::uuid());

        try {
            $response = Http::timeout($timeout)
                ->withHeaders([
                    'X-Request-Id' => $requestId,
                ])
                ->get($baseUrl . '/api/v1/part-stock-history/export', $request->query());

            if (! $response->successful()) {
                Log::warning('Part stock history export Go bridge returned an invalid response', [
                    'status' => $response->status(),
                ]);

                return null;
            }

            $contentType = (string) $response->header('Content-Type', 'text/csv');
            $contentDisposition = (string) $response->header('Content-Disposition', 'attachment; filename=part-stock-history-export.csv');

            return response($response->body(), $response->status(), [
                'Content-Type' => $contentType,
                'Content-Disposition' => $contentDisposition,
            ]);
        } catch (\Throwable $e) {
            return null;
        }
    }
}

