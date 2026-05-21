<?php

namespace App\Http\Controllers\Apps;

use App\Events\PartSaleCreated;
use App\Http\Controllers\Controller;
use App\Models\Part;
use App\Models\PartSale;
use App\Models\PartSaleDetail;
use App\Models\PartStockMovement;
use App\Services\VoucherService;
use App\Services\DiscountTaxService;
use App\Services\FIFOCostingService;
use App\Support\DispatchesBroadcastSafely;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Inertia\Inertia;
use Illuminate\Support\Facades\Auth;
use Illuminate\Validation\ValidationException;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use App\Http\Controllers\Concerns\RespondsWithJsonOrRedirect;

class PartSaleController extends Controller
{
    use DispatchesBroadcastSafely;
    use RespondsWithJsonOrRedirect;

    public function __construct(private readonly VoucherService $voucherService)
    {
    }

    public function index(Request $request)
    {
        // Proxy to GO backend when enabled
        if (config('go_backend.features.part_sales_index', false)) {
            $baseUrl = rtrim((string) config('go_backend.base_url', 'http://127.0.0.1:8081'), '/');
            try {
                $resp = Http::timeout((int) config('go_backend.timeout_seconds', 5))->get($baseUrl . '/api/v1/part-sales', $request->query());
                $json = $resp->json();
                if (is_array($json)) {
                    return Inertia::render('Dashboard/Parts/Sales/Index', $json);
                }
            } catch (\Throwable $e) {
                Log::error('Part sales index proxy error: ' . $e->getMessage());
            }
        }

        $sales = PartSale::with(['user'])->orderByDesc('created_at')->paginate(15)->withQueryString();
        return Inertia::render('Dashboard/Parts/Sales/Index', [
            'sales' => $sales,
            'filters' => $request->only(['search', 'status', 'payment_status']),
        ]);
    }

    public function create()
    {
        // Proxy to GO backend when enabled
        if (config('go_backend.features.part_sales_create', false)) {
            $baseUrl = rtrim((string) config('go_backend.base_url', 'http://127.0.0.1:8081'), '/');
            try {
                $resp = Http::timeout((int) config('go_backend.timeout_seconds', 5))->get($baseUrl . '/api/v1/part-sales/create');
                $json = $resp->json();
                if (is_array($json)) {
                    return Inertia::render('Dashboard/Parts/Sales/Create', $json);
                }
            } catch (\Throwable $e) {
                Log::error('Part sales create proxy error: ' . $e->getMessage());
            }
        }

        return Inertia::render('Dashboard/Parts/Sales/Create', [
            'parts' => Part::with('category')->orderBy('name')->get(),
        ]);
    }

    public function show($id)
    {
        // Proxy to GO backend when enabled
        if (config('go_backend.features.part_sales_show', false)) {
            $baseUrl = rtrim((string) config('go_backend.base_url', 'http://127.0.0.1:8081'), '/');
            try {
                $resp = Http::timeout((int) config('go_backend.timeout_seconds', 5))->get($baseUrl . '/api/v1/part-sales/' . $id);
                $json = $resp->json();
                if (is_array($json)) {
                    return Inertia::render('Dashboard/Parts/Sales/Show', $json);
                }
            } catch (\Throwable $e) {
                Log::error('Part sale show proxy error: ' . $e->getMessage());
            }
        }

        $sale = PartSale::with(['details.part', 'user'])->findOrFail($id);

        return Inertia::render('Dashboard/Parts/Sales/Show', [
            'sale' => $sale,
        ]);
    }

    public function store(Request $request)
    {
        $data = $request->validate([
            'customer_id' => 'required|exists:customers,id',
            'sale_date' => 'required|date',
            'notes' => 'nullable|string',
            'voucher_code' => 'nullable|string|max:50',
            'items' => 'required|array|min:1',
            'items.*.part_id' => 'required|exists:parts,id',
            'items.*.quantity' => 'required|integer|min:1',
            'items.*.unit_price' => 'required|numeric|min:0',
            'items.*.discount_type' => 'nullable|in:none,percent,fixed',
            'items.*.discount_value' => 'nullable|numeric|min:0',
            'discount_type' => 'nullable|in:none,percent,fixed',
            'discount_value' => 'nullable|numeric|min:0',
            'tax_type' => 'nullable|in:none,percent,fixed',
            'tax_value' => 'nullable|numeric|min:0',
            'payment_method' => 'nullable|string|max:50',
            'paid_amount' => 'nullable|integer|min:0',
            'payment_meta' => 'nullable|array',
            'status' => 'nullable|string|max:50',
            'transfer_destination' => 'nullable|string|max:50',
        ]);

        $sale = DB::transaction(function () use ($data) {
            $invoice = 'PS-' . strtoupper(Str::random(8));

            $sale = PartSale::create([
                'invoice' => $invoice,
                'customer_id' => $data['customer_id'],
                'sale_date' => $data['sale_date'],
                'notes' => $data['notes'] ?? null,
                'total' => 0,
                'created_by' => Auth::id(),
                'discount_type' => $data['discount_type'] ?? 'none',
                'discount_value' => $data['discount_value'] ?? 0,
                'tax_type' => $data['tax_type'] ?? 'none',
                'tax_value' => $data['tax_value'] ?? 0,
                'payment_method' => $data['payment_method'] ?? 'cash',
                'paid_amount' => $data['paid_amount'] ?? 0,
                'payment_meta' => $data['payment_meta'] ?? null,
                'status' => $data['status'] ?? 'confirmed',
                'transfer_destination' => $data['transfer_destination'] ?? null,
            ]);

            $sale->total = $this->syncPartSaleItems($sale, $data['items']);
            $this->applyVoucherToPartSale($sale, $data['voucher_code'] ?? null);

            // Calculate transaction-level discount and tax
            $sale->recalculateTotals()->save();

            $this->dispatchBroadcastSafely(
                fn () => broadcast(new PartSaleCreated($sale->fresh()->toArray())),
                PartSaleCreated::class
            );
            return $sale;
        });

        return $this->jsonOrRedirect('part-sales.index', [], 'Penjualan sparepart berhasil disimpan', $sale->toArray());
    }

    public function update(Request $request, PartSale $partSale)
    {
        $data = $request->validate([
            'customer_id' => 'required|exists:customers,id',
            'sale_date' => 'required|date',
            'notes' => 'nullable|string',
            'voucher_code' => 'nullable|string|max:50',
            'items' => 'required|array|min:1',
            'items.*.part_id' => 'required|exists:parts,id',
            'items.*.quantity' => 'required|integer|min:1',
            'items.*.unit_price' => 'required|numeric|min:0',
            'items.*.discount_type' => 'nullable|in:none,percent,fixed',
            'items.*.discount_value' => 'nullable|numeric|min:0',
            'discount_type' => 'nullable|in:none,percent,fixed',
            'discount_value' => 'nullable|numeric|min:0',
            'tax_type' => 'nullable|in:none,percent,fixed',
            'tax_value' => 'nullable|numeric|min:0',
            'payment_method' => 'nullable|string|max:50',
            'paid_amount' => 'nullable|integer|min:0',
            'payment_meta' => 'nullable|array',
            'status' => 'nullable|string|max:50',
            'transfer_destination' => 'nullable|string|max:50',
        ]);

        $updatedSale = DB::transaction(function () use ($partSale, $data) {
            $this->voucherService->clearUsageBySource(PartSale::class, (int) $partSale->id);

            FIFOCostingService::releaseStockForReference(
                PartSale::class,
                (int) $partSale->id,
                "Revisi Penjualan Sparepart: {$partSale->invoice}",
                Auth::id()
            );

            $partSale->details()->delete();

            $partSale->update([
                'customer_id' => $data['customer_id'],
                'sale_date' => $data['sale_date'],
                'notes' => $data['notes'] ?? null,
                'discount_type' => $data['discount_type'] ?? 'none',
                'discount_value' => $data['discount_value'] ?? 0,
                'tax_type' => $data['tax_type'] ?? 'none',
                'tax_value' => $data['tax_value'] ?? 0,
                'payment_method' => $data['payment_method'] ?? $partSale->payment_method ?? 'cash',
                'paid_amount' => $data['paid_amount'] ?? $partSale->paid_amount ?? 0,
                'payment_meta' => $data['payment_meta'] ?? $partSale->payment_meta ?? null,
                'status' => $data['status'] ?? $partSale->status,
                'transfer_destination' => $data['transfer_destination'] ?? $partSale->transfer_destination ?? null,
                'voucher_id' => null,
                'voucher_code' => null,
                'voucher_discount_amount' => 0,
            ]);

            $partSale->total = $this->syncPartSaleItems($partSale, $data['items']);
            $this->applyVoucherToPartSale($partSale, $data['voucher_code'] ?? null);

            $partSale->recalculateTotals()->save();

            return $partSale->fresh(['details.part', 'user']);
        });

        return $this->jsonOrRedirect('part-sales.show', [$updatedSale->id], 'Penjualan sparepart berhasil diperbarui', $updatedSale->toArray());
    }

    private function applyVoucherToPartSale(PartSale $sale, ?string $voucherCode): void
    {
        $context = $this->collectPartSaleVoucherContext($sale);

        $voucherResult = $this->voucherService->validateForTransaction($voucherCode, [
            'customer_id' => (int) ($sale->customer_id ?? 0),
            'subtotal' => (int) ($sale->total ?? 0),
            'part_ids' => $context['part_ids'],
            'part_category_ids' => $context['part_category_ids'],
            'service_ids' => [],
            'service_category_ids' => [],
            'transaction_discount_type' => $sale->discount_type ?? 'none',
            'transaction_discount_value' => $sale->discount_value ?? 0,
        ]);

        $voucher = $voucherResult['voucher'];
        $voucherDiscountAmount = (int) ($voucherResult['discount_amount'] ?? 0);

        $sale->update([
            'voucher_id' => $voucher?->id,
            'voucher_code' => $voucher?->code,
            'voucher_discount_amount' => $voucher ? $voucherDiscountAmount : 0,
        ]);

        $sale->recalculateTotals()->save();

        if ($voucher) {
            $this->voucherService->markUsed(
                $voucher,
                PartSale::class,
                (int) $sale->id,
                (int) ($sale->customer_id ?? 0),
                $voucherDiscountAmount,
                [
                    'invoice' => $sale->invoice,
                ]
            );
        }
    }

    private function collectPartSaleVoucherContext(PartSale $sale): array
    {
        $sale->loadMissing('details.part.category');

        $partIds = [];
        $partCategoryIds = [];

        foreach ($sale->details as $detail) {
            if ($detail->part_id) {
                $partIds[] = (int) $detail->part_id;

                if ($detail->part && $detail->part->part_category_id) {
                    $partCategoryIds[] = (int) $detail->part->part_category_id;
                }
            }
        }

        return [
            'part_ids' => array_values(array_unique($partIds)),
            'part_category_ids' => array_values(array_unique($partCategoryIds)),
        ];
    }

    private function syncPartSaleItems(PartSale $sale, array $items): int
    {
        $total = 0;

        foreach ($items as $item) {
            $part = Part::findOrFail($item['part_id']);
            $qty = (int) ($item['quantity'] ?? $item['qty'] ?? 0);
            $unitPrice = (float) $item['unit_price'];
            $subtotal = (int) round($qty * $unitPrice);

            if ($part->stock < $qty) {
                throw ValidationException::withMessages(['items' => ["Stok tidak mencukupi untuk {$part->name}"]]);
            }

            $detail = $sale->details()->create([
                'part_id' => $part->id,
                'quantity' => $qty,
                'unit_price' => $unitPrice,
                'subtotal' => $subtotal,
                'discount_type' => $item['discount_type'] ?? 'none',
                'discount_value' => $item['discount_value'] ?? 0,
                'source_purchase_detail_id' => null,
                'cost_price' => 0,
                'selling_price' => 0,
            ]);

            $detail->calculateFinalAmount()->save();

            $pricing = FIFOCostingService::consumeStock(
                $part,
                $qty,
                PartSale::class,
                $sale->id,
                "Part sale {$sale->invoice}",
                Auth::id(),
                $detail,
                null,
                (int) $unitPrice,
                'out'
            );

            $detail->update([
                'source_purchase_detail_id' => $pricing['source_purchase_detail_id'] ?? null,
                'cost_price' => $pricing['cost_price'] ?? 0,
                'selling_price' => $pricing['selling_price'] ?? $detail->selling_price,
            ]);

            $total += $detail->final_amount ?? $subtotal;
        }

        return $total;
    }
}
