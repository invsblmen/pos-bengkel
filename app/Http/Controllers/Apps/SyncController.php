<?php

namespace App\Http\Controllers\Apps;

use App\Http\Controllers\Controller;
use App\Models\SyncBatch;
use App\Models\SyncReceivedBatch;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;

class SyncController extends Controller
{
    public function index(Request $request)
    {
        $status = (string) $request->query('status', 'all');
        $scope = (string) $request->query('scope', 'all');
        $dateFrom = (string) $request->query('date_from', '');
        $dateTo = (string) $request->query('date_to', '');

        $query = SyncReceivedBatch::query()->latest('received_at');

        if ($status !== 'all') {
            $query->where('status', $status);
        }

        if ($scope !== 'all') {
            $query->where('scope', $scope);
        }

        if ($dateFrom !== '') {
            $query->whereDate('received_at', '>=', $dateFrom);
        }

        if ($dateTo !== '') {
            $query->whereDate('received_at', '<=', $dateTo);
        }

        $batches = $query->paginate(15)->withQueryString();

        return Inertia::render('Dashboard/Sync/Index', [
            'filters' => [
                'status' => $status,
                'scope' => $scope,
                'date_from' => $dateFrom,
                'date_to' => $dateTo,
            ],
            'summary' => [
                'received_total' => SyncReceivedBatch::count(),
                'acknowledged_total' => SyncReceivedBatch::where('status', 'acknowledged')->count(),
                'duplicate_total' => SyncReceivedBatch::where('status', 'duplicate')->count(),
                'failed_total' => SyncReceivedBatch::where('status', 'failed')->count(),
                'pending_total' => SyncBatch::whereIn('status', ['pending', 'retrying'])->count(),
            ],
            'batches' => $batches,
            'scopes' => ['all', 'daily', 'manual', 'retry'],
            'statuses' => ['all', 'received', 'acknowledged', 'duplicate', 'invalid', 'failed'],
        ]);
    }

    public function receiveBatch(Request $request): JsonResponse
    {
        $this->ensureSyncToken($request);

        $validated = $request->validate([
            'sync_batch_id' => ['required', 'uuid'],
            'source_workshop_id' => ['required', 'string', 'max:100'],
            'scope' => ['required', 'string', 'max:50'],
            'payload_type' => ['required', 'string', 'max:100'],
            'source_date' => ['nullable', 'date'],
            'payload_hash' => ['required', 'string', 'max:255'],
            'items' => ['required', 'array', 'min:1'],
            'items.*.entity_type' => ['required', 'string', 'max:100'],
            'items.*.entity_id' => ['required'],
            'items.*.event_type' => ['required', 'string', 'max:50'],
            'items.*.payload' => ['required', 'array'],
            'items.*.payload_hash' => ['required', 'string', 'max:255'],
        ]);

        $acknowledgedAt = Carbon::now();

        $record = DB::transaction(function () use ($validated, $acknowledgedAt) {
            $existing = SyncReceivedBatch::query()
                ->where('sync_batch_id', $validated['sync_batch_id'])
                ->lockForUpdate()
                ->first();

            $summary = [
                'received_items' => count($validated['items']),
                'duplicate_items' => 0,
                'invalid_items' => 0,
            ];

            if ($existing) {
                $existing->update([
                    'status' => 'duplicate',
                    'acknowledged_at' => $acknowledgedAt,
                    'last_error' => null,
                    'summary_json' => $summary,
                ]);

                return $existing->fresh();
            }

            $created = SyncReceivedBatch::query()->create([
                'sync_batch_id' => $validated['sync_batch_id'],
                'source_workshop_id' => $validated['source_workshop_id'],
                'scope' => $validated['scope'],
                'payload_type' => $validated['payload_type'],
                'source_date' => $validated['source_date'] ?? null,
                'payload_hash' => $validated['payload_hash'],
                'payload_json' => $validated,
                'summary_json' => $summary,
                'status' => 'acknowledged',
                'received_at' => $acknowledgedAt,
                'acknowledged_at' => $acknowledgedAt,
            ]);

            SyncBatch::query()->updateOrCreate(
                ['sync_batch_id' => $validated['sync_batch_id']],
                [
                    'scope' => $validated['scope'],
                    'payload_type' => $validated['payload_type'],
                    'source_date' => $validated['source_date'] ?? null,
                    'source_workshop_id' => $validated['source_workshop_id'],
                    'payload_hash' => $validated['payload_hash'],
                    'payload_json' => $validated,
                    'status' => 'acknowledged',
                    'acknowledged_at' => $acknowledgedAt,
                    'last_attempt_at' => $acknowledgedAt,
                    'last_error' => null,
                ]
            );

            return $created;
        });

        return response()->json([
            'sync_batch_id' => $record->sync_batch_id,
            'status' => $record->status,
            'received_items' => (int) ($record->summary_json['received_items'] ?? 0),
            'duplicate_items' => (int) ($record->summary_json['duplicate_items'] ?? 0),
            'invalid_items' => (int) ($record->summary_json['invalid_items'] ?? 0),
            'acknowledged_at' => optional($record->acknowledged_at)?->toIso8601String(),
        ]);
    }

    public function status(Request $request): JsonResponse
    {
        $this->ensureSyncToken($request);

        return response()->json([
            'ok' => true,
            'summary' => [
                'received_total' => SyncReceivedBatch::count(),
                'acknowledged_total' => SyncReceivedBatch::where('status', 'acknowledged')->count(),
                'duplicate_total' => SyncReceivedBatch::where('status', 'duplicate')->count(),
                'failed_total' => SyncReceivedBatch::where('status', 'failed')->count(),
                'pending_total' => SyncBatch::whereIn('status', ['pending', 'retrying'])->count(),
            ],
            'server_time' => now()->toIso8601String(),
        ]);
    }

    private function ensureSyncToken(Request $request): void
    {
        if (! (bool) config('go_backend.sync.enabled', false)) {
            throw ValidationException::withMessages([
                'sync' => 'Sinkronisasi belum diaktifkan di server hosting.',
            ]);
        }

        $expectedToken = trim((string) config('go_backend.sync.shared_token', ''));
        $providedToken = trim((string) $request->header('X-Sync-Token', ''));

        if ($expectedToken === '') {
            throw ValidationException::withMessages([
                'sync' => 'Token sinkron belum dikonfigurasi di server hosting.',
            ]);
        }

        if ($providedToken === '' || !hash_equals($expectedToken, $providedToken)) {
            throw ValidationException::withMessages([
                'sync' => 'Token sinkron tidak valid.',
            ]);
        }
    }
}