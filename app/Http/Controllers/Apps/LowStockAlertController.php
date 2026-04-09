<?php

namespace App\Http\Controllers\Apps;

use App\Http\Controllers\Controller;
use App\Models\LowStockAlert;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;
use Inertia\Inertia;

class LowStockAlertController extends Controller
{
    public function index(Request $request)
    {
        if ((bool) config('go_backend.features.parts_low_stock', false)) {
            $proxied = $this->lowStockIndexViaGo($request);
            if ($proxied !== null) {
                return Inertia::render('Dashboard/Parts/LowStock', $proxied);
            }
        }

        LowStockAlert::where('is_read', false)->update(['is_read' => true]);

        $sortBy = $request->query('sort_by', 'created_at');
        $sortDirection = $request->query('sort_direction', 'desc');

        $query = LowStockAlert::with(['part.supplier', 'part.category']);

        // Sorting
        $allowedSorts = ['name', 'part_number', 'rack_location', 'current_stock', 'minimal_stock', 'created_at'];
        if (in_array($sortBy, ['name', 'part_number', 'rack_location'])) {
            // Sort by part relationship
            $query->join('parts', 'low_stock_alerts.part_id', '=', 'parts.id')
                  ->select('low_stock_alerts.*')
                  ->orderBy('parts.' . $sortBy, $sortDirection);
        } elseif (in_array($sortBy, ['current_stock', 'minimal_stock'])) {
            $query->orderBy($sortBy, $sortDirection);
        } else {
            $query->latest();
        }

        $alerts = $query
            ->paginate(10)
            ->withQueryString()
            ->through(function ($alert) {
                return [
                    'id' => $alert->id,
                    'current_stock' => $alert->current_stock,
                    'minimal_stock' => $alert->minimal_stock,
                    'is_read' => $alert->is_read,
                    'created_at' => $alert->created_at?->diffForHumans(),
                    'part' => $alert->part
                        ? [
                            'id' => $alert->part->id,
                            'name' => $alert->part->name,
                            'part_number' => $alert->part->part_number,
                            'rack_location' => $alert->part->rack_location,
                            'supplier' => $alert->part->supplier
                                ? [
                                    'id' => $alert->part->supplier->id,
                                    'name' => $alert->part->supplier->name,
                                ]
                                : null,
                        ]
                        : null,
                ];
            });

        return Inertia::render('Dashboard/Parts/LowStock', [
            'alerts' => $alerts,
            'filters' => [
                'sort_by' => $sortBy,
                'sort_direction' => $sortDirection,
            ],
        ]);
    }

    private function lowStockIndexViaGo(Request $request): ?array
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
                ->get($baseUrl . '/api/v1/parts/low-stock', $request->query());

            $json = $response->json();
            if (! $response->successful() || ! is_array($json)) {
                Log::warning('Low stock Go bridge returned an invalid response', [
                    'status' => $response->status(),
                ]);

                return null;
            }

            if (! isset($json['alerts'], $json['filters'])) {
                Log::warning('Low stock Go bridge response is missing expected keys', [
                    'keys' => array_keys($json),
                ]);

                return null;
            }

            return $json;
        } catch (\Throwable $e) {
            return null;
        }
    }
}
