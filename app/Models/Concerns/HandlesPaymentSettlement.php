<?php

namespace App\Models\Concerns;

trait HandlesPaymentSettlement
{
    protected function applyManualPaymentRounding(): void
    {
        $grandTotal = max(0, (int) ($this->grand_total ?? 0));
        $meta = $this->payment_meta ?? [];

        if (is_string($meta)) {
            $meta = json_decode($meta, true) ?: [];
        }

        if (!is_array($meta) || empty($meta['manual_rounding_enabled'])) {
            return;
        }

        $originalTotal = isset($meta['total_due'])
            ? max(0, (int) $meta['total_due'])
            : $grandTotal;
        $roundedTotal = isset($meta['payable_total_after_manual_rounding'])
            ? max(0, (int) $meta['payable_total_after_manual_rounding'])
            : $grandTotal;

        if ($originalTotal !== $grandTotal || $roundedTotal > $grandTotal) {
            return;
        }

        $manualAdjustment = $roundedTotal - $grandTotal;

        $this->rounding_adjustment = (int) ($this->rounding_adjustment ?? 0) + $manualAdjustment;
        $this->grand_total = $roundedTotal;
    }

    public function getPaymentSettlementTotal(): int
    {
        $grandTotal = max(0, (int) ($this->grand_total ?? 0));
        $meta = $this->payment_meta ?? [];

        if (is_string($meta)) {
            $meta = json_decode($meta, true) ?: [];
        }

        if (!is_array($meta) || empty($meta['manual_rounding_enabled'])) {
            return $grandTotal;
        }

        $roundedTotal = isset($meta['payable_total_after_manual_rounding'])
            ? max(0, (int) $meta['payable_total_after_manual_rounding'])
            : $grandTotal;

        $originalTotal = isset($meta['total_due'])
            ? max(0, (int) $meta['total_due'])
            : $grandTotal;

        if ($originalTotal !== $grandTotal) {
            return $grandTotal;
        }

        return min($roundedTotal, $grandTotal);
    }

    public function applyPaymentSettlementStatus(): self
    {
        $paidAmount = max(0, (int) ($this->paid_amount ?? 0));
        $settlementTotal = $this->getPaymentSettlementTotal();

        $this->paid_amount = $paidAmount;
        $this->remaining_amount = max(0, $settlementTotal - $paidAmount);

        if ($paidAmount >= $settlementTotal) {
            $this->payment_status = 'paid';
            $this->remaining_amount = 0;
        } elseif ($paidAmount > 0) {
            $this->payment_status = 'partial';
        } else {
            $this->payment_status = 'unpaid';
        }

        return $this;
    }

    protected function syncPaymentSettlementStatus(): void
    {
        $this->applyPaymentSettlementStatus();
    }
}
