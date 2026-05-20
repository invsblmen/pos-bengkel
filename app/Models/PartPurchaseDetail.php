<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use App\Services\DiscountTaxService;

class PartPurchaseDetail extends Model
{
    protected $fillable = [
        'part_purchase_id',
        'part_id',
        'quantity',
        'unit_price',
        'subtotal',
        'discount_type',
        'discount_value',
        'discount_amount',
        'final_amount',
        'margin_type',
        'margin_value',
        'margin_amount',
        'normal_unit_price',
        'promo_discount_type',
        'promo_discount_value',
        'promo_discount_amount',
        'selling_price',
        'created_by',
    ];

    protected $casts = [
        'quantity' => 'integer',
        'unit_price' => 'integer',
        'subtotal' => 'integer',
        'discount_value' => 'float',
        'discount_amount' => 'integer',
        'final_amount' => 'integer',
        'margin_value' => 'float',
        'margin_amount' => 'integer',
        'normal_unit_price' => 'integer',
        'promo_discount_value' => 'float',
        'promo_discount_amount' => 'integer',
        'selling_price' => 'integer',
    ];

    public function partPurchase()
    {
        return $this->belongsTo(PartPurchase::class);
    }

    public function part()
    {
        return $this->belongsTo(Part::class);
    }

    /**
     * Calculate final amount with discount
     */
    public function calculateFinalAmount()
    {
        $this->final_amount = DiscountTaxService::calculateAmountWithDiscount(
            $this->subtotal ?? 0,
            $this->discount_type ?? 'none',
            $this->discount_value ?? 0
        );

        if ($this->discount_type !== 'none' && $this->discount_value) {
            $this->discount_amount = $this->subtotal - $this->final_amount;
        } else {
            $this->discount_amount = 0;
        }

        return $this;
    }

    /**
     * Calculate all pricing fields comprehensively
     * This ensures consistency between create and update operations
     *
     * @return self
     */
    public function calculateAllPrices()
    {
        // Step 1: Calculate item subtotal and discount
        $this->subtotal = $this->quantity * $this->unit_price;

        $itemDiscountAmount = DiscountTaxService::calculateDiscount(
            $this->subtotal,
            $this->discount_type ?? 'none',
            $this->discount_value ?? 0
        );

        $this->discount_amount = $itemDiscountAmount;
        $this->final_amount = $this->subtotal - $itemDiscountAmount;

        // Step 2: Calculate cost price after discount
        $priceAfterDiscount = DiscountTaxService::calculateAmountWithDiscount(
            $this->unit_price,
            $this->discount_type ?? 'none',
            $this->discount_value ?? 0
        );

        // Step 3: Calculate margin amount and normal unit price
        $this->margin_amount = DiscountTaxService::calculateDiscount(
            $priceAfterDiscount,
            $this->margin_type ?? 'percent',
            $this->margin_value ?? 0
        );

        $this->normal_unit_price = $priceAfterDiscount + $this->margin_amount;

        // Step 4: Calculate promo discount amount and final selling price
        $this->promo_discount_amount = DiscountTaxService::calculateDiscount(
            $this->normal_unit_price,
            $this->promo_discount_type ?? 'none',
            $this->promo_discount_value ?? 0
        );

        $this->selling_price = $this->normal_unit_price - $this->promo_discount_amount;

        return $this;
    }

    /**
     * Calculate selling price based on margin
     *
     * @return int selling price per unit
     */
    public function calculateSellingPrice()
    {
        $costPerUnit = $this->getUnitCostPrice();

        if ($this->margin_type === 'percent') {
            // Percentage margin: selling_price = cost + (cost * margin / 100)
            return (int) round($costPerUnit + ($costPerUnit * ($this->margin_value ?? 0) / 100));
        } else {
            // Fixed margin: selling_price = cost + fixed_amount
            return (int) round($costPerUnit + ($this->margin_value ?? 0));
        }
    }

    /**
     * Calculate remaining quantity available (for FIFO tracking)
     *
     * @return int quantity remaining from this purchase
     */
    public function getRemainingQuantity()
    {
        $outbound = PartStockMovement::where('part_purchase_detail_id', $this->id)
            ->where('type', 'out')
            ->sum('qty');

        $returned = PartStockMovement::where('part_purchase_detail_id', $this->id)
            ->where('type', 'in')
            ->sum('qty');

        return max(0, (int) $this->quantity - (int) $outbound + (int) $returned);
    }

    /**
     * Unit cost after supplier/item discount, used as HPP for FIFO.
     */
    public function getUnitCostPrice(): int
    {
        $quantity = max(1, (int) ($this->quantity ?? 1));

        if ((int) ($this->final_amount ?? 0) > 0) {
            return (int) round(((int) $this->final_amount) / $quantity);
        }

        return (int) DiscountTaxService::calculateAmountWithDiscount(
            (int) ($this->unit_price ?? 0),
            $this->discount_type ?? 'none',
            $this->discount_value ?? 0
        );
    }
}
