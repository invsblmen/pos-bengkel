<?php

namespace App\Services;

use App\Models\Part;
use App\Models\PartPurchaseDetail;
use App\Models\PartSaleDetail;
use App\Models\PartStockMovement;
use App\Models\ServiceOrderDetail;
use Illuminate\Validation\ValidationException;
use Illuminate\Support\Facades\DB;

class FIFOCostingService
{
    /**
     * Allocate stock from the oldest received purchase batches.
     */
    public static function allocateStock(int $partId, int $quantityNeeded, bool $useLock = false): array
    {
        $allocations = [];
        $remainingQty = max(0, $quantityNeeded);

        $query = PartPurchaseDetail::query()
            ->where('part_id', $partId)
            ->whereHas('partPurchase', fn ($query) => $query->where('status', 'received'))
            ->orderBy('created_at')
            ->orderBy('id');

        if ($useLock) {
            $purchaseDetails = $query->lockForUpdate()->get();
        } else {
            $purchaseDetails = $query->get();
        }

        foreach ($purchaseDetails as $detail) {
            if ($remainingQty <= 0) {
                break;
            }

            $remainingStock = $detail->getRemainingQuantity();
            if ($remainingStock <= 0) {
                continue;
            }

            $allocatedQty = min($remainingStock, $remainingQty);
            $allocations[] = [
                'purchase_detail_id' => $detail->id,
                'purchase_detail' => $detail,
                'quantity' => $allocatedQty,
                'cost_price' => $detail->getUnitCostPrice(),
                'selling_price' => (int) ($detail->selling_price ?: $detail->calculateSellingPrice()),
            ];

            $remainingQty -= $allocatedQty;
        }

        if ($remainingQty > 0) {
            return [
                'success' => false,
                'allocations' => [],
                'message' => "Stok batch FIFO tidak mencukupi. Dibutuhkan {$quantityNeeded}, tersedia " . ($quantityNeeded - $remainingQty) . '.',
            ];
        }

        return [
            'success' => true,
            'allocations' => $allocations,
            'message' => 'Stock allocated successfully',
        ];
    }

    public static function calculateWeightedPrices(array $allocations): array
    {
        $totalQty = 0;
        $totalCost = 0;
        $totalSelling = 0;

        foreach ($allocations as $allocation) {
            $qty = (int) ($allocation['quantity'] ?? 0);
            $totalQty += $qty;
            $totalCost += (int) ($allocation['cost_price'] ?? 0) * $qty;
            $totalSelling += (int) ($allocation['selling_price'] ?? 0) * $qty;
        }

        if ($totalQty <= 0) {
            return ['cost_price' => 0, 'selling_price' => 0];
        }

        return [
            'cost_price' => (int) round($totalCost / $totalQty),
            'selling_price' => (int) round($totalSelling / $totalQty),
        ];
    }

    public static function consumeStock(
        Part $part,
        int $quantity,
        string $referenceType,
        int $referenceId,
        string $notes,
        ?int $createdBy = null,
        ?PartSaleDetail $saleDetail = null,
        ?ServiceOrderDetail $serviceOrderDetail = null,
        ?int $fallbackUnitPrice = null,
        string $movementType = 'out'
    ): array {
        return DB::transaction(function () use ($part, $quantity, $referenceType, $referenceId, $notes, $createdBy, $saleDetail, $serviceOrderDetail, $fallbackUnitPrice, $movementType) {
            // Lock part row to avoid concurrent oversell
            $lockedPart = Part::where('id', $part->id)->lockForUpdate()->first();

            if ((int) $lockedPart->stock < $quantity) {
                throw ValidationException::withMessages([
                    'items' => ["Stock {$lockedPart->name} tidak mencukupi. Tersedia: {$lockedPart->stock}, diminta: {$quantity}"],
                ]);
            }

            $fifoResult = self::allocateStock((int) $lockedPart->id, $quantity, true);
            if (!$fifoResult['success']) {
                throw ValidationException::withMessages(['items' => [$fifoResult['message']]]);
            }

            $beforeStock = (int) $lockedPart->stock;
            $runningStock = $beforeStock;

            foreach ($fifoResult['allocations'] as $allocation) {
                $allocatedQty = (int) $allocation['quantity'];
                $afterStock = max(0, $runningStock - $allocatedQty);

                PartStockMovement::create([
                    'part_id' => $lockedPart->id,
                    'part_purchase_detail_id' => $allocation['purchase_detail_id'],
                    'part_sale_detail_id' => $saleDetail?->id,
                    'service_order_detail_id' => $serviceOrderDetail?->id,
                    'reference_type' => $referenceType,
                    'reference_id' => $referenceId,
                    'type' => $movementType,
                    'qty' => $allocatedQty,
                    'before_stock' => $runningStock,
                    'after_stock' => $afterStock,
                    'unit_price' => $fallbackUnitPrice ?? $allocation['selling_price'],
                    'notes' => $notes,
                    'created_by' => $createdBy,
                ]);

                $runningStock = $afterStock;
            }

            $lockedPart->update(['stock' => $runningStock]);

            $prices = self::calculateWeightedPrices($fifoResult['allocations']);

            return [
                ...$prices,
                'source_purchase_detail_id' => $fifoResult['allocations'][0]['purchase_detail_id'] ?? null,
                'allocations' => $fifoResult['allocations'],
                'before_stock' => $beforeStock,
                'after_stock' => $runningStock,
            ];
        });
    }

    /**
     * Backward-compatible helper for older controller paths.
     */
    public static function createStockMovements(PartSaleDetail $saleDetail, array $allocations): void
    {
        foreach ($allocations as $allocation) {
            PartStockMovement::create([
                'part_id' => $saleDetail->part_id,
                'part_purchase_detail_id' => $allocation['purchase_detail_id'] ?? null,
                'part_sale_detail_id' => $saleDetail->id,
                'reference_type' => PartSaleDetail::class,
                'reference_id' => $saleDetail->id,
                'type' => 'out',
                'qty' => (int) ($allocation['quantity'] ?? 0),
                'unit_price' => $saleDetail->unit_price,
                'notes' => "FIFO allocation from purchase detail #{$allocation['purchase_detail_id']}",
            ]);
        }
    }

    public static function releaseStockForReference(
        string $referenceType,
        int $referenceId,
        string $notes,
        ?int $createdBy = null,
        ?int $partSaleDetailId = null,
        ?int $serviceOrderDetailId = null
    ): void {
        $movements = PartStockMovement::query()
            ->where('reference_type', $referenceType)
            ->where('reference_id', $referenceId)
            ->where('type', 'out')
            ->whereNotNull('part_purchase_detail_id')
            ->when($partSaleDetailId, fn ($query) => $query->where('part_sale_detail_id', $partSaleDetailId))
            ->when($serviceOrderDetailId, fn ($query) => $query->where('service_order_detail_id', $serviceOrderDetailId))
            ->get();

        $releasedByBatch = PartStockMovement::query()
            ->where('reference_type', $referenceType)
            ->where('reference_id', $referenceId)
            ->where('type', 'in')
            ->whereNotNull('part_purchase_detail_id')
            ->when($partSaleDetailId, fn ($query) => $query->where('part_sale_detail_id', $partSaleDetailId))
            ->when($serviceOrderDetailId, fn ($query) => $query->where('service_order_detail_id', $serviceOrderDetailId))
            ->selectRaw('part_purchase_detail_id, SUM(qty) as released_qty')
            ->groupBy('part_purchase_detail_id')
            ->pluck('released_qty', 'part_purchase_detail_id')
            ->map(fn ($qty) => (int) $qty)
            ->all();

        foreach ($movements as $movement) {
            $batchId = (int) $movement->part_purchase_detail_id;
            $alreadyReleased = (int) ($releasedByBatch[$batchId] ?? 0);

            if ($alreadyReleased >= (int) $movement->qty) {
                $releasedByBatch[$batchId] = $alreadyReleased - (int) $movement->qty;
                continue;
            }

            $qtyToRelease = (int) $movement->qty - max(0, $alreadyReleased);
            $releasedByBatch[$batchId] = 0;

            $part = $movement->part;
            if (!$part) {
                continue;
            }

            $beforeStock = (int) $part->stock;
            $afterStock = $beforeStock + $qtyToRelease;
            $part->update(['stock' => $afterStock]);

            PartStockMovement::create([
                'part_id' => $movement->part_id,
                'part_purchase_detail_id' => $movement->part_purchase_detail_id,
                'part_sale_detail_id' => $movement->part_sale_detail_id,
                'service_order_detail_id' => $movement->service_order_detail_id,
                'reference_type' => $referenceType,
                'reference_id' => $referenceId,
                'type' => 'in',
                'qty' => $qtyToRelease,
                'before_stock' => $beforeStock,
                'after_stock' => $afterStock,
                'unit_price' => $movement->unit_price,
                'notes' => $notes,
                'created_by' => $createdBy,
            ]);
        }
    }
}
