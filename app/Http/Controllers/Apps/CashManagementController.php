<?php

namespace App\Http\Controllers\Apps;

use App\Http\Controllers\Controller;
use App\Models\CashDenomination;
use App\Models\CashDrawerDenomination;
use App\Models\CashTransaction;
use App\Models\CashTransactionItem;
use App\Services\CashChangeSuggestionService;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;

class CashManagementController extends Controller
{
    public function index()
    {
        $denominations = CashDenomination::query()
            ->with('drawerStock')
            ->where('is_active', true)
            ->orderBy('value')
            ->get()
            ->map(function ($denomination) {
                $quantity = (int) ($denomination->drawerStock->quantity ?? 0);
                $value = (int) $denomination->value;

                return [
                    'id' => $denomination->id,
                    'value' => $value,
                    'quantity' => $quantity,
                    'subtotal' => $value * $quantity,
                ];
            })
            ->values();

        $totalCash = (int) $denominations->sum('subtotal');

        $recentTransactions = CashTransaction::query()
            ->with(['items.denomination:id,value', 'user:id,name'])
            ->orderByDesc('happened_at')
            ->orderByDesc('id')
            ->take(25)
            ->get()
            ->map(function ($transaction) {
                return [
                    'id' => $transaction->id,
                    'transaction_type' => $transaction->transaction_type,
                    'amount' => (int) $transaction->amount,
                    'source' => $transaction->source,
                    'description' => $transaction->description,
                    'happened_at' => optional($transaction->happened_at)->format('Y-m-d H:i:s'),
                    'created_by' => $transaction->user?->name,
                    'items' => $transaction->items->map(function ($item) {
                        return [
                            'direction' => $item->direction,
                            'denomination_value' => (int) ($item->denomination?->value ?? 0),
                            'quantity' => (int) $item->quantity,
                            'line_total' => (int) $item->line_total,
                        ];
                    })->values(),
                ];
            })
            ->values();

        $monthStart = now()->startOfMonth();
        $monthEnd = now()->endOfMonth();

        $monthIncome = (int) CashTransaction::query()
            ->whereIn('transaction_type', ['income'])
            ->whereBetween('happened_at', [$monthStart, $monthEnd])
            ->sum('amount');

        $monthExpense = (int) CashTransaction::query()
            ->whereIn('transaction_type', ['expense', 'change_given'])
            ->whereBetween('happened_at', [$monthStart, $monthEnd])
            ->sum('amount');

        return Inertia::render('Dashboard/Accounting/CashDrawer', [
            'denominations' => $denominations,
            'summary' => [
                'total_cash' => $totalCash,
                'month_income' => $monthIncome,
                'month_expense' => $monthExpense,
                'month_net' => $monthIncome - $monthExpense,
            ],
            'recentTransactions' => $recentTransactions,
        ]);
    }

    public function updateStock(Request $request)
    {
        $validated = $request->validate([
            'denominations' => 'required|array|min:1',
            'denominations.*.denomination_id' => 'required|exists:cash_denominations,id',
            'denominations.*.quantity' => 'required|integer|min:0',
            'description' => 'nullable|string|max:500',
        ]);

        DB::transaction(function () use ($validated, $request) {
            $transaction = CashTransaction::create([
                'transaction_type' => 'adjustment',
                'amount' => 0,
                'source' => 'manual-stock-adjustment',
                'description' => $validated['description'] ?? 'Penyesuaian stok pecahan kas',
                'happened_at' => now(),
                'created_by' => $request->user()->id,
            ]);

            $totalIn = 0;
            $totalOut = 0;

            foreach ($validated['denominations'] as $row) {
                $denominationId = (int) $row['denomination_id'];
                $newQuantity = (int) $row['quantity'];

                $drawer = CashDrawerDenomination::firstOrCreate(
                    ['denomination_id' => $denominationId],
                    ['quantity' => 0]
                );

                $oldQuantity = (int) $drawer->quantity;
                if ($oldQuantity === $newQuantity) {
                    continue;
                }

                $delta = $newQuantity - $oldQuantity;
                $direction = $delta > 0 ? 'in' : 'out';
                $quantity = abs($delta);
                $value = (int) CashDenomination::whereKey($denominationId)->value('value');

                CashTransactionItem::create([
                    'cash_transaction_id' => $transaction->id,
                    'denomination_id' => $denominationId,
                    'direction' => $direction,
                    'quantity' => $quantity,
                    'line_total' => $value * $quantity,
                ]);

                if ($direction === 'in') {
                    $totalIn += $value * $quantity;
                } else {
                    $totalOut += $value * $quantity;
                }

                $drawer->update(['quantity' => $newQuantity]);
            }

            $transaction->update([
                'amount' => abs($totalIn - $totalOut),
                'meta' => [
                    'total_in' => $totalIn,
                    'total_out' => $totalOut,
                    'net_adjustment' => $totalIn - $totalOut,
                ],
            ]);
        });

        return back()->with('success', 'Stok pecahan kas berhasil diperbarui.');
    }

    public function storeTransaction(Request $request)
    {
        $validated = $request->validate([
            'transaction_type' => 'required|in:income,expense',
            'description' => 'nullable|string|max:500',
            'happened_at' => 'nullable|date',
            'denominations' => 'required|array|min:1',
            'denominations.*.denomination_id' => 'required|exists:cash_denominations,id',
            'denominations.*.quantity' => 'required|integer|min:0',
        ]);

        DB::transaction(function () use ($validated, $request) {
            $direction = $validated['transaction_type'] === 'income' ? 'in' : 'out';
            $total = 0;

            foreach ($validated['denominations'] as $row) {
                $quantity = (int) $row['quantity'];
                if ($quantity === 0) {
                    continue;
                }

                $denominationId = (int) $row['denomination_id'];
                $currentQty = (int) CashDrawerDenomination::where('denomination_id', $denominationId)->value('quantity');

                if ($direction === 'out' && $quantity > $currentQty) {
                    $value = (int) CashDenomination::whereKey($denominationId)->value('value');
                    throw ValidationException::withMessages([
                        'denominations' => ["Stok pecahan Rp " . number_format($value, 0, ',', '.') . " tidak mencukupi."],
                    ]);
                }

                $value = (int) CashDenomination::whereKey($denominationId)->value('value');
                $total += $value * $quantity;
            }

            $transaction = CashTransaction::create([
                'transaction_type' => $validated['transaction_type'],
                'amount' => $total,
                'source' => 'manual-entry',
                'description' => $validated['description'] ?? null,
                'happened_at' => isset($validated['happened_at']) ? Carbon::parse($validated['happened_at']) : now(),
                'created_by' => $request->user()->id,
            ]);

            foreach ($validated['denominations'] as $row) {
                $quantity = (int) $row['quantity'];
                if ($quantity === 0) {
                    continue;
                }

                $denominationId = (int) $row['denomination_id'];
                $value = (int) CashDenomination::whereKey($denominationId)->value('value');

                CashTransactionItem::create([
                    'cash_transaction_id' => $transaction->id,
                    'denomination_id' => $denominationId,
                    'direction' => $direction,
                    'quantity' => $quantity,
                    'line_total' => $value * $quantity,
                ]);

                $drawer = CashDrawerDenomination::firstOrCreate(
                    ['denomination_id' => $denominationId],
                    ['quantity' => 0]
                );

                $newQty = $direction === 'in'
                    ? ((int) $drawer->quantity + $quantity)
                    : ((int) $drawer->quantity - $quantity);

                if ($newQty < 0) {
                    throw ValidationException::withMessages([
                        'denominations' => ['Stok kas tidak mencukupi untuk transaksi ini.'],
                    ]);
                }

                $drawer->update(['quantity' => $newQty]);
            }
        });

        return back()->with('success', 'Transaksi kas berhasil dicatat.');
    }

    public function suggestChange(Request $request, CashChangeSuggestionService $service)
    {
        if ((bool) config('go_backend.features.cash_change_suggest', false)) {
            $proxied = $this->suggestChangeViaGo($request);
            if ($proxied !== null) {
                return $proxied;
            }
        }

        $validated = $request->validate([
            'total_due' => 'required|integer|min:0',
            'received' => 'required|array|min:1',
            'received.*.denomination_id' => 'required|exists:cash_denominations,id',
            'received.*.quantity' => 'required|integer|min:0',
        ]);

        $receivedBreakdown = collect($validated['received'])
            ->map(function ($row) {
                $value = (int) CashDenomination::whereKey((int) $row['denomination_id'])->value('value');
                $quantity = (int) $row['quantity'];

                return [
                    'denomination_id' => (int) $row['denomination_id'],
                    'value' => $value,
                    'quantity' => $quantity,
                    'line_total' => $value * $quantity,
                ];
            })
            ->filter(fn ($row) => $row['quantity'] > 0)
            ->values();

        $receivedTotal = (int) $receivedBreakdown->sum('line_total');
        $totalDue = (int) $validated['total_due'];

        if ($receivedTotal < $totalDue) {
            return response()->json([
                'ok' => false,
                'message' => 'Nominal uang diterima lebih kecil dari total tagihan.',
                'total_due' => $totalDue,
                'received_total' => $receivedTotal,
            ], 422);
        }

        $changeAmount = $receivedTotal - $totalDue;

        $availableByValue = CashDrawerDenomination::query()
            ->join('cash_denominations', 'cash_drawer_denominations.denomination_id', '=', 'cash_denominations.id')
            ->selectRaw('cash_denominations.value as value, cash_drawer_denominations.quantity as quantity')
            ->get()
            ->mapWithKeys(function ($row) {
                return [(int) $row->value => (int) $row->quantity];
            })
            ->toArray();

        // Customer cash is added first, then change can be taken from updated drawer.
        foreach ($receivedBreakdown as $item) {
            $availableByValue[$item['value']] = (int) ($availableByValue[$item['value']] ?? 0) + (int) $item['quantity'];
        }

        $suggestion = $service->suggest($changeAmount, $availableByValue);

        $valueToId = CashDenomination::query()
            ->pluck('id', 'value')
            ->map(fn ($id) => (int) $id)
            ->toArray();

        $suggestionItems = collect($suggestion['items'])
            ->map(function ($item) use ($valueToId) {
                return [
                    'denomination_id' => (int) ($valueToId[(int) $item['value']] ?? 0),
                    'value' => (int) $item['value'],
                    'quantity' => (int) $item['quantity'],
                    'line_total' => (int) $item['line_total'],
                ];
            })
            ->filter(fn ($item) => $item['denomination_id'] > 0)
            ->values();

        return response()->json([
            'ok' => true,
            'total_due' => $totalDue,
            'received_total' => $receivedTotal,
            'change_amount' => (int) $suggestion['change_amount'],
            'suggestion' => [
                'exact' => (bool) $suggestion['exact'],
                'allocated_amount' => (int) $suggestion['allocated_amount'],
                'remaining' => (int) $suggestion['remaining'],
                'pieces' => (int) $suggestion['pieces'],
                'items' => $suggestionItems,
            ],
            'received_breakdown' => $receivedBreakdown,
        ]);
    }

    private function suggestChangeViaGo(Request $request): ?\Illuminate\Http\JsonResponse
    {
        $baseUrl = rtrim((string) config('go_backend.base_url', 'http://127.0.0.1:8081'), '/');
        $timeout = (int) config('go_backend.timeout_seconds', 5);
        $requestId = (string) ($request->header('X-Request-Id') ?: Str::uuid());

        try {
            $response = Http::timeout($timeout)
                ->acceptJson()
                ->withHeaders([
                    'X-Request-Id' => $requestId,
                    'Content-Type' => 'application/json',
                ])
                ->post($baseUrl . '/api/v1/cash-management/change/suggest', $request->all());

            $json = $response->json();
            if (! is_array($json)) {
                Log::warning('Cash change suggest Go bridge returned non JSON object response', [
                    'status' => $response->status(),
                ]);

                return null;
            }

            return response()->json($json, $response->status());
        } catch (\Throwable $e) {
            return null;
        }
    }

    public function settleSaleCash(Request $request, CashChangeSuggestionService $service)
    {
        if ((bool) config('go_backend.features.cash_sale_settle', false)) {
            $proxied = $this->settleSaleCashViaGo($request);
            if ($proxied !== null) {
                return $proxied;
            }
        }

        $validated = $request->validate([
            'total_due' => 'required|integer|min:0',
            'description' => 'nullable|string|max:500',
            'received' => 'required|array|min:1',
            'received.*.denomination_id' => 'required|exists:cash_denominations,id',
            'received.*.quantity' => 'required|integer|min:0',
        ]);

        $receivedRows = collect($validated['received'])
            ->map(function ($row) {
                $denominationId = (int) $row['denomination_id'];
                $quantity = (int) $row['quantity'];
                $value = (int) CashDenomination::whereKey($denominationId)->value('value');

                return [
                    'denomination_id' => $denominationId,
                    'quantity' => $quantity,
                    'value' => $value,
                    'line_total' => $value * $quantity,
                ];
            })
            ->filter(fn ($row) => $row['quantity'] > 0)
            ->values();

        $receivedTotal = (int) $receivedRows->sum('line_total');
        $totalDue = (int) $validated['total_due'];

        if ($receivedTotal < $totalDue) {
            return response()->json([
                'ok' => false,
                'message' => 'Nominal uang diterima lebih kecil dari total tagihan.',
            ], 422);
        }

        $changeAmount = $receivedTotal - $totalDue;

        DB::transaction(function () use ($request, $receivedRows, $receivedTotal, $totalDue, $changeAmount, $validated, $service) {
            $availableByValue = CashDrawerDenomination::query()
                ->join('cash_denominations', 'cash_drawer_denominations.denomination_id', '=', 'cash_denominations.id')
                ->selectRaw('cash_denominations.value as value, cash_drawer_denominations.quantity as quantity')
                ->get()
                ->mapWithKeys(function ($row) {
                    return [(int) $row->value => (int) $row->quantity];
                })
                ->toArray();

            foreach ($receivedRows as $item) {
                $availableByValue[$item['value']] = (int) ($availableByValue[$item['value']] ?? 0) + (int) $item['quantity'];
            }

            $suggestion = $service->suggest($changeAmount, $availableByValue);
            if (!$suggestion['exact']) {
                throw ValidationException::withMessages([
                    'received' => ['Stok kas tidak cukup untuk memberikan kembalian pas.'],
                ]);
            }

            $valueToId = CashDenomination::query()
                ->pluck('id', 'value')
                ->map(fn ($id) => (int) $id)
                ->toArray();

            $receivedTransaction = CashTransaction::create([
                'transaction_type' => 'income',
                'amount' => $receivedTotal,
                'source' => 'cash-sale-received',
                'description' => $validated['description'] ?? 'Pembayaran cash pelanggan',
                'meta' => [
                    'total_due' => $totalDue,
                    'received_total' => $receivedTotal,
                ],
                'happened_at' => now(),
                'created_by' => $request->user()->id,
            ]);

            foreach ($receivedRows as $row) {
                CashTransactionItem::create([
                    'cash_transaction_id' => $receivedTransaction->id,
                    'denomination_id' => $row['denomination_id'],
                    'direction' => 'in',
                    'quantity' => $row['quantity'],
                    'line_total' => $row['line_total'],
                ]);

                $drawer = CashDrawerDenomination::firstOrCreate(
                    ['denomination_id' => $row['denomination_id']],
                    ['quantity' => 0]
                );
                $drawer->update(['quantity' => (int) $drawer->quantity + (int) $row['quantity']]);
            }

            if ($changeAmount > 0) {
                $changeTransaction = CashTransaction::create([
                    'transaction_type' => 'change_given',
                    'amount' => $changeAmount,
                    'source' => 'cash-sale-change',
                    'description' => 'Kembalian transaksi cash pelanggan',
                    'meta' => [
                        'total_due' => $totalDue,
                        'received_total' => $receivedTotal,
                    ],
                    'happened_at' => now(),
                    'created_by' => $request->user()->id,
                ]);

                foreach ($suggestion['items'] as $item) {
                    $value = (int) $item['value'];
                    $qty = (int) $item['quantity'];
                    $denominationId = (int) ($valueToId[$value] ?? 0);
                    if ($denominationId <= 0 || $qty <= 0) {
                        continue;
                    }

                    CashTransactionItem::create([
                        'cash_transaction_id' => $changeTransaction->id,
                        'denomination_id' => $denominationId,
                        'direction' => 'out',
                        'quantity' => $qty,
                        'line_total' => $value * $qty,
                    ]);

                    $drawer = CashDrawerDenomination::firstOrCreate(
                        ['denomination_id' => $denominationId],
                        ['quantity' => 0]
                    );

                    $newQty = (int) $drawer->quantity - $qty;
                    if ($newQty < 0) {
                        throw ValidationException::withMessages([
                            'received' => ['Stok kas tidak mencukupi untuk pecahan kembalian.'],
                        ]);
                    }

                    $drawer->update(['quantity' => $newQty]);
                }
            }
        });

        return response()->json([
            'ok' => true,
            'message' => 'Pembayaran cash dan kembalian berhasil dicatat.',
            'net_cash_in' => $totalDue,
            'received_total' => $receivedTotal,
            'change_amount' => $changeAmount,
        ]);
    }

    private function settleSaleCashViaGo(Request $request): ?\Illuminate\Http\JsonResponse
    {
        $baseUrl = rtrim((string) config('go_backend.base_url', 'http://127.0.0.1:8081'), '/');
        $timeout = (int) config('go_backend.timeout_seconds', 5);
        $requestId = (string) ($request->header('X-Request-Id') ?: Str::uuid());

        try {
            $payload = $request->all();
            $payload['actor_user_id'] = $request->user()?->id;

            $response = Http::timeout($timeout)
                ->acceptJson()
                ->withHeaders([
                    'X-Request-Id' => $requestId,
                    'Content-Type' => 'application/json',
                ])
                ->post($baseUrl . '/api/v1/cash-management/sale/settle', $payload);

            $json = $response->json();
            if (! is_array($json)) {
                Log::warning('Cash sale settle Go bridge returned non JSON object response', [
                    'status' => $response->status(),
                ]);

                return null;
            }

            return response()->json($json, $response->status());
        } catch (\Throwable $e) {
            return null;
        }
    }
}
