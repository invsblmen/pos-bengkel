<?php

namespace App\Http\Controllers\Apps;

use App\Events\PartSaleCreated;
use App\Http\Controllers\Controller;
use App\Models\Part;
use App\Models\PartSale;
use App\Models\PartSaleDetail;
use App\Models\PartStockMovement;
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
            'notes' => 'nullable|string',
            'items' => 'required|array|min:1',
            'items.*.part_id' => 'required|exists:parts,id',
            'items.*.qty' => 'required|integer|min:1',
            'items.*.unit_price' => 'required|numeric|min:0',
            'items.*.discount_type' => 'nullable|in:none,percent,fixed',
            'items.*.discount_value' => 'nullable|numeric|min:0',
            'discount_type' => 'nullable|in:none,percent,fixed',
            'discount_value' => 'nullable|numeric|min:0',
            'tax_type' => 'nullable|in:none,percent,fixed',
            'tax_value' => 'nullable|numeric|min:0',
        ]);

        $sale = DB::transaction(function () use ($data) {
            $invoice = 'PS-' . strtoupper(Str::random(8));
            $total = 0;

            $sale = PartSale::create([
                'invoice' => $invoice,
                'notes' => $data['notes'] ?? null,
                'total' => 0,
                'created_by' => Auth::id(),
                'discount_type' => $data['discount_type'] ?? 'none',
                'discount_value' => $data['discount_value'] ?? 0,
                'tax_type' => $data['tax_type'] ?? 'none',
                'tax_value' => $data['tax_value'] ?? 0,
            ]);

            foreach ($data['items'] as $item) {
                $part = Part::findOrFail($item['part_id']);
                $qty = (int) $item['qty'];
                $unitPrice = (float) $item['unit_price'];
                $subtotal = (int) round($qty * $unitPrice);

                if ($part->stock < $qty) {
                    throw ValidationException::withMessages(['items' => ["Stok tidak mencukupi untuk {$part->name}"]]);
                }

                // Allocate stock using FIFO
                $fifoResult = FIFOCostingService::allocateStock($part->id, $qty);

                if (!$fifoResult['success']) {
                    throw ValidationException::withMessages(['items' => [$fifoResult['message']]]);
                }

                // Calculate weighted average cost and selling price from FIFO allocations
                $prices = FIFOCostingService::calculateWeightedPrices($fifoResult['allocations']);

                $detail = $sale->details()->create([
                    'part_id' => $part->id,
                    'quantity' => $qty,
                    'unit_price' => $unitPrice,
                    'subtotal' => $subtotal,
                    'discount_type' => $item['discount_type'] ?? 'none',
                    'discount_value' => $item['discount_value'] ?? 0,
                    'source_purchase_detail_id' => $fifoResult['allocations'][0]['purchase_detail_id'] ?? null,
                    'cost_price' => $prices['cost_price'],
                    'selling_price' => $prices['selling_price'],
                ]);

                // Calculate final amount for item discount
                $detail->calculateFinalAmount()->save();

                // Create stock movements for FIFO allocations
                FIFOCostingService::createStockMovements($detail, $fifoResult['allocations']);

                $before = $part->stock;
                $part->stock = max(0, $part->stock - $qty);
                $part->save();

                // Use final_amount (after item discount) for total calculation
                $total += $detail->final_amount ?? $subtotal;
            }

            $sale->total = $total;
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
}
