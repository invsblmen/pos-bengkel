<?php

namespace App\Models;

use App\Models\Concerns\HandlesPaymentSettlement;
use Illuminate\Database\Eloquent\Model;
use App\Services\DiscountTaxService;

class PartPurchase extends Model
{
    use HandlesPaymentSettlement;

    protected $fillable = [
        'purchase_number',
        'supplier_id',
        'purchase_date',
        'expected_delivery_date',
        'actual_delivery_date',
        'status',
        'total_amount',
        'notes',
        'payment_method', 'paid_amount', 'remaining_amount', 'payment_status', 'transfer_destination', 'payment_meta',
        'discount_type', 'discount_value', 'discount_amount',
        'tax_type', 'tax_value', 'tax_amount', 'rounding_adjustment', 'grand_total',
        'unit_cost', 'margin_type', 'margin_value', 'promo_discount_type', 'promo_discount_value',
        'updated_by'
    ];

    protected $casts = [
        'purchase_date' => 'date',
        'expected_delivery_date' => 'date',
        'actual_delivery_date' => 'date',
        'total_amount' => 'integer',
        'discount_amount' => 'integer',
        'tax_amount' => 'integer',
        'rounding_adjustment' => 'integer',
        'grand_total' => 'integer',
        'payment_method' => 'string',
        'transfer_destination' => 'string',
        'payment_meta' => 'array',
        'paid_amount' => 'integer',
        'remaining_amount' => 'integer',
        'payment_status' => 'string',
        'unit_cost' => 'integer',
        'margin_value' => 'decimal:2',
        'promo_discount_value' => 'decimal:2',
    ];

    public function supplier()
    {
        return $this->belongsTo(Supplier::class);
    }

    public function details()
    {
        return $this->hasMany(PartPurchaseDetail::class);
    }

    public function stockMovements()
    {
        return $this->morphMany(PartStockMovement::class, 'reference');
    }

    /**
     * Calculate selling price based on margin type and value
     */
    public function calculateSellingPrice()
    {
        if ($this->margin_type === 'percent') {
            return $this->unit_cost + ($this->unit_cost * $this->margin_value / 100);
        } else {
            return $this->unit_cost + $this->margin_value;
        }
    }

    /**
     * Get remaining quantity from stock movements
     */
    public function getRemainingQuantity()
    {
        return $this->details->sum(function($detail) {
            $used = PartStockMovement::where('reference_id', $this->id)
                ->where('reference_type', 'App\\Models\\PartPurchase')
                ->where('type', 'out')
                ->sum('quantity');

            return $detail->quantity - $used;
        });
    }

    /**
     * Calculate and update the purchase totals
     */
    public function recalculateTotals()
    {
        // Calculate subtotal from details (use final_amount if available, otherwise subtotal)
        $subtotal = $this->details->sum(function($detail) {
            return $detail->final_amount ?? $detail->subtotal;
        });

        $totals = DiscountTaxService::calculateTotal(
            $subtotal,
            $this->discount_type ?? 'none',
            $this->discount_value ?? 0,
            $this->tax_type ?? 'none',
            $this->tax_value ?? 0
        );

        $this->total_amount = $subtotal;
        $this->discount_amount = $totals['discount_amount'];
        $this->tax_amount = $totals['tax_amount'];
        $this->rounding_adjustment = $totals['rounding_adjustment'];
        $this->grand_total = $totals['grand_total'];

        $this->applyManualPaymentRounding();
        $this->syncPaymentSettlementStatus();

        return $this;
    }

    protected static function boot()
    {
        parent::boot();

        static::creating(function ($model) {
            if (empty($model->purchase_number)) {
                $model->purchase_number = self::generatePurchaseNumber();
            }
        });
    }

    public static function generatePurchaseNumber()
    {
        $date = now()->format('Ymd');
        $prefix = "PUR-{$date}-";

        $lastPurchase = self::where('purchase_number', 'like', $prefix . '%')
            ->orderBy('purchase_number', 'desc')
            ->first();

        if ($lastPurchase) {
            $lastNumber = intval(substr($lastPurchase->purchase_number, -4));
            $newNumber = $lastNumber + 1;
        } else {
            $newNumber = 1;
        }

        return $prefix . str_pad($newNumber, 4, '0', STR_PAD_LEFT);
    }
}
