<?php

namespace App\Models;

use App\Models\Concerns\HandlesPaymentSettlement;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;
use App\Services\CashRoundingService;
use App\Services\DiscountTaxService;

class ServiceOrder extends Model
{
    use HasFactory, SoftDeletes, HandlesPaymentSettlement;

    protected $fillable = [
        'order_number', 'customer_id', 'vehicle_id', 'mechanic_id', 'status', 'odometer_km',
        'estimated_start_at', 'estimated_finish_at',
        'actual_start_at', 'actual_finish_at',
        'total', 'labor_cost', 'material_cost', 'warranty_period', 'notes',
        'maintenance_type', 'next_service_km', 'next_service_date',
        'discount_type', 'discount_value', 'discount_amount',
        'voucher_id', 'voucher_code', 'voucher_discount_amount',
        'tax_type', 'tax_value', 'tax_amount', 'rounding_adjustment', 'grand_total',
        'payment_method', 'paid_amount', 'remaining_amount', 'payment_status', 'transfer_destination', 'payment_meta'
    ];

    protected $casts = [
        'estimated_start_at' => 'datetime',
        'estimated_finish_at' => 'datetime',
        'actual_start_at' => 'datetime',
        'actual_finish_at' => 'datetime',
        'total' => 'integer',
        'labor_cost' => 'integer',
        'material_cost' => 'integer',
        'warranty_period' => 'integer',
        'odometer_km' => 'integer',
        'discount_amount' => 'integer',
        'voucher_id' => 'integer',
        'voucher_discount_amount' => 'integer',
        'tax_amount' => 'integer',
        'rounding_adjustment' => 'integer',
        'grand_total' => 'integer',
        'payment_method' => 'string',
        'transfer_destination' => 'string',
        'payment_meta' => 'array',
        'paid_amount' => 'integer',
        'remaining_amount' => 'integer',
        'payment_status' => 'string',
    ];

    public function customer()
    {
        return $this->belongsTo(Customer::class);
    }

    public function vehicle()
    {
        return $this->belongsTo(Vehicle::class);
    }

    public function mechanic()
    {
        return $this->belongsTo(Mechanic::class);
    }

    public function details()
    {
        return $this->hasMany(ServiceOrderDetail::class);
    }

    public function tags()
    {
        return $this->belongsToMany(Tag::class, 'service_order_tags');
    }

    public function statusHistories()
    {
        return $this->hasMany(ServiceOrderStatusHistory::class)->orderByDesc('created_at');
    }

    public function voucher()
    {
        return $this->belongsTo(Voucher::class);
    }

    /**
     * Calculate and update the service order totals
     */
    public function recalculateTotals()
    {
        $amountSum = $this->details()->sum('amount') ?? 0;
        $finalSum = $this->details()->sum('final_amount') ?? 0;

        // Subtotal uses amounts after item-level discount
        $subtotal = $finalSum;
        $itemDiscount = max(0, $amountSum - $finalSum);

        $transactionDiscount = DiscountTaxService::calculateDiscount(
            $subtotal,
            $this->discount_type ?? 'none',
            $this->discount_value ?? 0
        );

        $voucherDiscount = max(0, (int) ($this->voucher_discount_amount ?? 0));
        $taxBase = max(0, $subtotal - $transactionDiscount - $voucherDiscount);
        $taxAmount = DiscountTaxService::calculateTax(
            $taxBase,
            $this->tax_type ?? 'none',
            $this->tax_value ?? 0
        );

        $this->total = $subtotal;
        $this->discount_amount = $itemDiscount + $transactionDiscount;
        $this->tax_amount = $taxAmount;
        $rounding = CashRoundingService::roundToCashDenomination($taxBase + $taxAmount);
        $this->rounding_adjustment = $rounding['rounding_adjustment'];
        $this->grand_total = $rounding['grand_total'];

        $this->applyManualPaymentRounding();
        $this->syncPaymentSettlementStatus();

        return $this;
    }

    public function scopePending($query)
    {
        return $query->where('status', 'pending');
    }

    public function scopeInProgress($query)
    {
        return $query->where('status', 'in_progress');
    }

    public function scopeCompleted($query)
    {
        return $query->where('status', 'completed');
    }
}
