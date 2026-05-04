<?php

namespace App\Services;

class DiscountTaxService
{
    /**
     * Calculate discount amount based on discount type and value
     *
     * @param float|int $subtotal The base amount to apply discount to
     * @param string $discountType 'none', 'percent', or 'fixed'
     * @param float|int $discountValue The discount percentage or fixed amount
     * @return int The discount amount (in cents/smallest unit)
     */
    public static function calculateDiscount($subtotal, $discountType = 'none', $discountValue = 0)
    {
        if ($discountType === 'none' || !$discountValue) {
            return 0;
        }

        $subtotal = (int) $subtotal;
        $discountValue = (float) $discountValue;

        if ($discountType === 'percent') {
            return (int) round($subtotal * ($discountValue / 100));
        }

        if ($discountType === 'fixed') {
            return (int) round($discountValue * 100); // Convert to cents
        }

        return 0;
    }

    /**
     * Calculate tax amount based on tax type and value
     *
     * @param float|int $amount The base amount to apply tax to
     * @param string $taxType 'none', 'percent', or 'fixed'
     * @param float|int $taxValue The tax percentage or fixed amount
     * @return int The tax amount (in cents/smallest unit)
     */
    public static function calculateTax($amount, $taxType = 'none', $taxValue = 0)
    {
        if ($taxType === 'none' || !$taxValue) {
            return 0;
        }

        $amount = (int) $amount;
        $taxValue = (float) $taxValue;

        if ($taxType === 'percent') {
            return (int) round($amount * ($taxValue / 100));
        }

        if ($taxType === 'fixed') {
            return (int) round($taxValue * 100); // Convert to cents
        }

        return 0;
    }

    /**
     * Calculate final amount with discount
     *
     * @param float|int $subtotal The base amount
     * @param string $discountType 'none', 'percent', or 'fixed'
     * @param float|int $discountValue The discount percentage or fixed amount
     * @return int The final amount after discount
     */
    public static function calculateAmountWithDiscount($subtotal, $discountType = 'none', $discountValue = 0)
    {
        $subtotal = (int) $subtotal;
        $discount = self::calculateDiscount($subtotal, $discountType, $discountValue);
        // Ensure result is never negative
        return max(0, $subtotal - $discount);
    }

    /**
     * Calculate grand total with discount and tax
     *
     * @param float|int $subtotal The base amount
     * @param string $discountType 'none', 'percent', or 'fixed'
     * @param float|int $discountValue The discount percentage or fixed amount
     * @param string $taxType 'none', 'percent', or 'fixed'
     * @param float|int $taxValue The tax percentage or fixed amount
     * @return array Array with keys: discount_amount, tax_amount, raw_total, rounding_adjustment, grand_total
     */
    public static function calculateTotal($subtotal, $discountType = 'none', $discountValue = 0, $taxType = 'none', $taxValue = 0)
    {
        $subtotal = (int) $subtotal;

        $discountAmount = self::calculateDiscount($subtotal, $discountType, $discountValue);
        $amountAfterDiscount = $subtotal - $discountAmount;
        $taxAmount = self::calculateTax($amountAfterDiscount, $taxType, $taxValue);
        $rawTotal = max(0, $amountAfterDiscount + $taxAmount);
        $rounding = CashRoundingService::roundToCashDenomination($rawTotal);

        return [
            'discount_amount' => $discountAmount,
            'tax_amount' => $taxAmount,
            'raw_total' => $rawTotal,
            'rounding_adjustment' => $rounding['rounding_adjustment'],
            'grand_total' => $rounding['grand_total'],
        ];
    }

    /**
     * Validate discount and tax parameters
     *
     * @param array $data The data to validate
     * @return bool True if valid, throws exception if invalid
     */
    public static function validate($data)
    {
        $discountType = $data['discount_type'] ?? 'none';
        $taxType = $data['tax_type'] ?? 'none';

        $validTypes = ['none', 'percent', 'fixed'];

        if (!in_array($discountType, $validTypes)) {
            throw new \InvalidArgumentException("Invalid discount_type: {$discountType}");
        }

        if (!in_array($taxType, $validTypes)) {
            throw new \InvalidArgumentException("Invalid tax_type: {$taxType}");
        }

        if ($discountType === 'percent' && (($data['discount_value'] ?? 0) < 0 || ($data['discount_value'] ?? 0) > 100)) {
            throw new \InvalidArgumentException("Discount percentage must be between 0 and 100");
        }

        if ($taxType === 'percent' && (($data['tax_value'] ?? 0) < 0 || ($data['tax_value'] ?? 0) > 100)) {
            throw new \InvalidArgumentException("Tax percentage must be between 0 and 100");
        }

        return true;
    }
}
