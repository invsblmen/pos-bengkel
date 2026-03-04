<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use App\Services\DiscountTaxService;

class ServiceOrderDetail extends Model
{
    use HasFactory;

    protected $fillable = [
        'service_order_id', 'service_id', 'part_id', 'qty', 'price', 'notes', 'amount',
        'base_amount', 'auto_discount_amount', 'auto_discount_notes',
        'discount_type', 'discount_value', 'discount_amount', 'final_amount',
        'incentive_percentage', 'incentive_amount'
    ];

    protected $casts = [
        'amount' => 'integer',
        'base_amount' => 'integer',
        'auto_discount_amount' => 'integer',
        'discount_amount' => 'integer',
        'final_amount' => 'integer',
        'incentive_percentage' => 'decimal:2',
        'incentive_amount' => 'integer',
    ];

    public function serviceOrder()
    {
        return $this->belongsTo(ServiceOrder::class);
    }

    public function service()
    {
        return $this->belongsTo(Service::class);
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
        $amount = $this->amount ?? 0;

        $this->final_amount = DiscountTaxService::calculateAmountWithDiscount(
            $amount,
            $this->discount_type ?? 'none',
            $this->discount_value ?? 0
        );

        if ($this->discount_type !== 'none' && $this->discount_value) {
            $this->discount_amount = $amount - $this->final_amount;
        } else {
            $this->discount_amount = 0;
        }

        return $this;
    }
}
