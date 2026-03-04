<?php

namespace App\Http\Middleware;

use App\Models\LowStockAlert;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Schema;
use Inertia\Middleware;

class HandleInertiaRequests extends Middleware
{
    /**
     * The root template that is loaded on the first page visit.
     *
     * @var string
     */
    protected $rootView = 'app';

    /**
     * Determine the current asset version.
     */
    public function version(Request $request): string|null
    {
        return parent::version($request);
    }

    /**
     * Define the props that are shared by default.
     *
     * @return array<string, mixed>
     */
    public function share(Request $request): array
    {
        return [
            ...parent::share($request),
            'auth' => [
                'user' => $request->user(),
                'permissions' => $request->user() ? $request->user()->getPermissions() : [],
                'super' => $request->user() ? $request->user()->isSuperAdmin() : false,
            ],
            'lowStockAlerts' => $request->user()
                ? [
                    'count' => LowStockAlert::where('is_read', false)->count(),
                    'total_count' => LowStockAlert::count(),
                    'items' => LowStockAlert::with('part:id,name,part_number,rack_location')
                        ->latest()
                        ->take(5)
                        ->get()
                        ->map(function ($alert) {
                            return [
                                'id' => $alert->id,
                                'is_read' => $alert->is_read,
                                'current_stock' => $alert->current_stock,
                                'minimal_stock' => $alert->minimal_stock,
                                'created_at' => $alert->created_at?->diffForHumans(),
                                'part' => $alert->part
                                    ? [
                                        'id' => $alert->part->id,
                                        'name' => $alert->part->name,
                                        'part_number' => $alert->part->part_number,
                                        'rack_location' => $alert->part->rack_location,
                                    ]
                                    : null,
                            ];
                        }),
                ]
                : [
                    'count' => 0,
                    'total_count' => 0,
                    'items' => [],
                ],
            'notifications' => $request->user() && Schema::hasTable('notifications')
                ? [
                    'count' => $request->user()->unreadNotifications()->count(),
                    'items' => $request->user()->notifications()
                        ->latest()
                        ->take(5)
                        ->get()
                        ->map(function ($notification) {
                            $data = $notification->data ?? [];

                            return [
                                'id' => $notification->id,
                                'title' => $data['title'] ?? 'Notifikasi',
                                'message' => $data['message'] ?? '',
                                'reference' => $data['reference'] ?? null,
                                'purchase_id' => $data['purchase_id'] ?? null,
                                'sale_id' => $data['sale_id'] ?? null,
                                'context' => $data['context'] ?? null,
                                'read_at' => $notification->read_at,
                                'created_at' => $notification->created_at?->diffForHumans(),
                            ];
                        }),
                ]
                : [
                    'count' => 0,
                    'items' => [],
                ],
        ];
    }
}
