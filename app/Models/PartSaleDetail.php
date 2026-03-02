<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use App\Services\DiscountTaxService;

class PartSaleDetail extends Model
{
    use HasFactory;

    protected $fillable = [
        'part_sale_id',
        'part_id',
        'quantity',
        'reserved_quantity',
        'unit_price',
        'subtotal',
        'discount_type',
        'discount_value',
        'discount_amount',
        'final_amount',
        'source_purchase_detail_id',
        'cost_price',
        'selling_price',
    ];

    protected $casts = [
        'quantity' => 'integer',
        'reserved_quantity' => 'integer',
        'unit_price' => 'integer',
        'subtotal' => 'integer',
        'discount_value' => 'float',
        'discount_amount' => 'integer',
        'final_amount' => 'integer',
        'cost_price' => 'integer',
        'selling_price' => 'integer',
    ];

    // Relationships
    public function partSale()
    {
        return $this->belongsTo(PartSale::class);
    }

    public function part()
    {
        return $this->belongsTo(Part::class);
    }

    public function sourcePurchaseDetail()
    {
        return $this->belongsTo(PartPurchaseDetail::class, 'source_purchase_detail_id');
    }

    // Methods
    public function calculateFinalAmount()
    {
        // Calculate subtotal
        $this->subtotal = $this->quantity * $this->unit_price;

        // Apply item-level discount
        $this->discount_amount = DiscountTaxService::calculateDiscount(
            $this->subtotal,
            $this->discount_type ?? 'none',
            $this->discount_value ?? 0
        );

        $this->final_amount = $this->subtotal - $this->discount_amount;

        return $this;
    }

    /**
     * Calculate profit for this sale detail
     * Profit = (selling_price - cost_price) * quantity
     */
    public function calculateProfit()
    {
        return ($this->selling_price - $this->cost_price) * $this->quantity;
    }

    /**
     * Calculate profit margin percentage
     * Margin % = ((selling_price - cost_price) / cost_price) * 100
     */
    public function calculateProfitMargin()
    {
        if ($this->cost_price == 0) {
            return 0;
        }
        return (($this->selling_price - $this->cost_price) / $this->cost_price) * 100;
    }
}
