<?php

namespace App\Services;

use App\Models\PartSale;
use App\Services\VoucherService;

class VoucherApplier
{
    public function __construct(private readonly VoucherService $voucherService)
    {
    }

    public function applyToPartSale(PartSale $sale, ?string $voucherCode): void
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

        $subtotal = 0;
        foreach ($sale->details as $detail) {
            $subtotal += max(0, (int) ($detail->final_amount ?? $detail->subtotal ?? 0));
        }

        $voucherResult = $this->voucherService->validateForTransaction($voucherCode, [
            'customer_id' => (int) ($sale->customer_id ?? 0),
            'subtotal' => (int) $subtotal,
            'part_ids' => array_values(array_unique($partIds)),
            'part_category_ids' => array_values(array_unique($partCategoryIds)),
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
                    'reference' => $sale->sale_number ?? ($sale->invoice ?? null),
                ]
            );
        }
    }
}
