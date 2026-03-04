<?php

namespace App\Http\Controllers;

use App\Models\LowStockAlert;
use Illuminate\Http\Request;
use Illuminate\Notifications\DatabaseNotification;
use Illuminate\Pagination\LengthAwarePaginator;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Schema;
use Inertia\Inertia;

class NotificationController extends Controller
{
    public function index(Request $request)
    {
        $status = $request->string('status')->toString() ?: 'all';
        $source = $request->string('source')->toString() ?: 'all';

        if (!Schema::hasTable('notifications')) {
            return Inertia::render('Dashboard/Notifications/Index', [
                'notifications' => [
                    'data' => [],
                    'links' => [],
                    'current_page' => 1,
                    'last_page' => 1,
                    'total' => 0,
                ],
                'summary' => [
                    'total' => 0,
                    'unread' => 0,
                ],
                'filters' => [
                    'status' => $status,
                    'source' => $source,
                ],
            ]);
        }

        $user = $request->user();

        $databaseNotifications = collect();
        if (in_array($source, ['all', 'system'], true)) {
            $databaseQuery = $user->notifications();

            if ($status === 'unread') {
                $databaseQuery->whereNull('read_at');
            } elseif ($status === 'read') {
                $databaseQuery->whereNotNull('read_at');
            }

            $databaseNotifications = $databaseQuery
                ->get()
                ->map(function ($notification) {
                    $data = $notification->data ?? [];

                    return [
                        'id' => $notification->id,
                        'source' => 'system',
                        'title' => $data['title'] ?? 'Notifikasi',
                        'message' => $data['message'] ?? '',
                        'reference' => $data['reference'] ?? null,
                        'purchase_id' => $data['purchase_id'] ?? null,
                        'sale_id' => $data['sale_id'] ?? null,
                        'context' => $data['context'] ?? null,
                        'read_at' => $notification->read_at,
                        'created_at' => $notification->created_at,
                        'created_at_human' => $notification->created_at?->diffForHumans(),
                    ];
                });
        }

        $lowStockNotifications = collect();
        if (in_array($source, ['all', 'low_stock'], true)) {
            $lowStockQuery = LowStockAlert::query()->with('part:id,name,part_number');

            if ($status === 'unread') {
                $lowStockQuery->where('is_read', false);
            } elseif ($status === 'read') {
                $lowStockQuery->where('is_read', true);
            }

            $lowStockNotifications = $lowStockQuery
                ->get()
                ->map(function ($alert) {
                    $partName = $alert->part?->name ?? 'Part';
                    $partNumber = $alert->part?->part_number;

                    return [
                        'id' => (string) $alert->id,
                        'source' => 'low_stock',
                        'title' => 'Stok minimal',
                        'message' => $partNumber
                            ? "{$partName} ({$partNumber}) stok {$alert->current_stock}/{$alert->minimal_stock}"
                            : "{$partName} stok {$alert->current_stock}/{$alert->minimal_stock}",
                        'reference' => $partNumber,
                        'purchase_id' => null,
                        'part_id' => $alert->part_id,
                        'context' => null,
                        'read_at' => $alert->is_read ? $alert->updated_at : null,
                        'created_at' => $alert->created_at,
                        'created_at_human' => $alert->created_at?->diffForHumans(),
                    ];
                });
        }

        $merged = $databaseNotifications
            ->concat($lowStockNotifications)
            ->sortByDesc('created_at')
            ->values();

        $perPage = 20;
        $page = LengthAwarePaginator::resolveCurrentPage();
        $notifications = new LengthAwarePaginator(
            $merged->forPage($page, $perPage)->values(),
            $merged->count(),
            $perPage,
            $page,
            [
                'path' => $request->url(),
                'query' => $request->query(),
            ]
        );

        return Inertia::render('Dashboard/Notifications/Index', [
            'notifications' => $notifications,
            'summary' => [
                'total' => $user->notifications()->count() + LowStockAlert::count(),
                'unread' => $user->unreadNotifications()->count() + LowStockAlert::where('is_read', false)->count(),
            ],
            'filters' => [
                'status' => $status,
                'source' => $source,
            ],
        ]);
    }

    public function markRead(Request $request)
    {
        $data = $request->validate([
            'id' => 'required',
            'source' => 'required|in:system,low_stock',
        ]);

        if ($data['source'] === 'system') {
            $notification = DatabaseNotification::findOrFail($data['id']);
            abort_unless($notification->notifiable_id === $request->user()->id && $notification->notifiable_type === get_class($request->user()), 403);

            if (is_null($notification->read_at)) {
                $notification->markAsRead();
            }
        } else {
            $alert = LowStockAlert::findOrFail($data['id']);
            if (!$alert->is_read) {
                $alert->update(['is_read' => true]);
            }
        }

        return back()->with('success', 'Notifikasi ditandai sudah dibaca.');
    }

    public function markAllRead(Request $request)
    {
        $source = $request->input('source', 'all');

        if (Schema::hasTable('notifications')) {
            if (in_array($source, ['all', 'system'], true)) {
                $request->user()->unreadNotifications->markAsRead();
            }

            if (in_array($source, ['all', 'low_stock'], true)) {
                LowStockAlert::where('is_read', false)->update(['is_read' => true]);
            }
        }

        return back()->with('success', 'Semua notifikasi ditandai sudah dibaca.');
    }

    public function destroy(Request $request)
    {
        $data = $request->validate([
            'id' => 'required',
            'source' => 'required|in:system,low_stock',
        ]);

        if ($data['source'] === 'system') {
            $notification = DatabaseNotification::findOrFail($data['id']);
            abort_unless($notification->notifiable_id === $request->user()->id && $notification->notifiable_type === get_class($request->user()), 403);
            $notification->delete();
        } else {
            LowStockAlert::whereKey($data['id'])->delete();
        }

        return back()->with('success', 'Notifikasi berhasil dihapus.');
    }
}
