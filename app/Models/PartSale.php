<?php

namespace App\Models;

use App\Models\Concerns\HandlesPaymentSettlement;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use App\Services\CashRoundingService;
use App\Services\DiscountTaxService;

class PartSale extends Model
{
    use HasFactory, HandlesPaymentSettlement;

    protected $fillable = [
        'sale_number',
        'customer_id',
        'sale_date',
        'part_sales_order_id',
        'subtotal',
        'discount_type',
        'discount_value',
        'discount_amount',
        'voucher_id',
        'voucher_code',
        'voucher_discount_amount',
        'tax_type',
        'tax_value',
        'tax_amount',
        'rounding_adjustment',
        'grand_total',
        'payment_method',
        'paid_amount',
        'remaining_amount',
        'payment_status',
        'transfer_destination',
        'payment_meta',
        'status',
        'notes',
        'created_by',
    ];

    protected $casts = [
        'sale_date' => 'date',
        'subtotal' => 'integer',
        'discount_value' => 'float',
        'discount_amount' => 'integer',
        'voucher_id' => 'integer',
        'voucher_discount_amount' => 'integer',
        'tax_value' => 'float',
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

    // Relationships
    public function customer()
    {
        return $this->belongsTo(Customer::class);
    }

    public function salesOrder()
    {
        return $this->belongsTo(PartSalesOrder::class, 'part_sales_order_id');
    }

    public function details()
    {
        return $this->hasMany(PartSaleDetail::class);
    }

    public function creator()
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function user()
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function stockMovements()
    {
        return $this->morphMany(PartStockMovement::class, 'reference');
    }

    public function voucher()
    {
        return $this->belongsTo(Voucher::class);
    }

    // Methods
    public function recalculateTotals()
    {
        // Calculate subtotal from details (use final_amount which includes item discounts)
        $subtotal = $this->details->sum(function($detail) {
            return $detail->final_amount ?? $detail->subtotal;
        });

        $this->subtotal = $subtotal;

        // Apply transaction-level discount
        $this->discount_amount = DiscountTaxService::calculateDiscount(
            $subtotal,
            $this->discount_type ?? 'none',
            $this->discount_value ?? 0
        );

        $voucherDiscountAmount = max(0, (int) ($this->voucher_discount_amount ?? 0));
        $amountAfterDiscount = max(0, $subtotal - $this->discount_amount - $voucherDiscountAmount);

        // Apply transaction-level tax
        $this->tax_amount = DiscountTaxService::calculateTax(
            $amountAfterDiscount,
            $this->tax_type ?? 'none',
            $this->tax_value ?? 0
        );

        $rawTotal = $amountAfterDiscount + $this->tax_amount;
        $rounding = CashRoundingService::roundToCashDenomination($rawTotal);
        $this->rounding_adjustment = $rounding['rounding_adjustment'];
        $this->grand_total = $rounding['grand_total'];

        $this->applyManualPaymentRounding();
        $this->syncPaymentSettlementStatus();

        return $this;
    }

    public static function generateSaleNumber()
    {
        $prefix = 'SAL';
        $date = now()->format('Ymd');
        $lastSale = static::whereDate('created_at', now()->toDateString())
            ->latest('id')
            ->first();

        $number = $lastSale ? (intval(substr($lastSale->sale_number, -4)) + 1) : 1;

        return $prefix . $date . str_pad($number, 4, '0', STR_PAD_LEFT);
    }
}
