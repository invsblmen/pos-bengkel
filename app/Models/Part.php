<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class Part extends Model
{
    use HasFactory, SoftDeletes;

    protected static function booted()
    {
        static::saved(function (self $part) {
            if ($part->minimal_stock > 0 && $part->stock <= $part->minimal_stock) {
                LowStockAlert::updateOrCreate(
                    ['part_id' => $part->id],
                    [
                        'current_stock' => $part->stock,
                        'minimal_stock' => $part->minimal_stock,
                    ]
                );
            } else {
                LowStockAlert::where('part_id', $part->id)->delete();
            }
        });
    }

    protected $fillable = [
        'part_number', 'barcode', 'name', 'description', 'buy_price', 'sell_price', 'stock', 'minimal_stock', 'rack_location',
        'supplier_id', 'part_category_id', 'unit_measure', 'reorder_level', 'status',
        'has_warranty', 'warranty_duration_days', 'warranty_terms'
    ];

    protected $casts = [
        'stock' => 'integer',
        'reorder_level' => 'integer',
        'minimal_stock' => 'integer',
        'buy_price' => 'integer',
        'sell_price' => 'integer',
        'has_warranty' => 'boolean',
        'warranty_duration_days' => 'integer',
    ];

    public function category()
    {
        return $this->belongsTo(PartCategory::class, 'part_category_id');
    }

    public function categories()
    {
        return $this->belongsToMany(PartCategory::class, 'part_part_category')->withTimestamps();
    }

    public function serviceOrderDetails()
    {
        return $this->hasMany(ServiceOrderDetail::class);
    }

    public function supplier()
    {
        return $this->belongsTo(Supplier::class);
    }

    public function stockMovements()
    {
        return $this->hasMany(PartStockMovement::class);
    }

    public function purchases()
    {
        return $this->hasMany(PartPurchase::class);
    }

    public function purchaseDetails()
    {
        return $this->hasMany(PartPurchaseDetail::class);
    }

    public function lowStockAlert()
    {
        return $this->hasOne(LowStockAlert::class);
    }

    /**
     * Get the current cost price based on FIFO (oldest remaining purchase)
     */
    public function getCurrentCostPrice()
    {
        $purchaseDetail = $this->purchaseDetails()
            ->whereHas('partPurchase', fn ($query) => $query->where('status', 'received'))
            ->orderBy('created_at', 'asc')
            ->get()
            ->first(fn ($detail) => $detail->getRemainingQuantity() > 0);

        return $purchaseDetail ? $purchaseDetail->getUnitCostPrice() : (int) ($this->buy_price ?? 0);
    }

    /**
     * Get the selling price for this purchase batch
     */
    public function getSellingPrice($purchase = null)
    {
        $purchaseDetail = $purchase instanceof PartPurchaseDetail
            ? $purchase
            : $this->purchaseDetails()
                ->whereHas('partPurchase', fn ($query) => $query->where('status', 'received'))
                ->orderBy('created_at', 'asc')
                ->get()
                ->first(fn ($detail) => $detail->getRemainingQuantity() > 0);

        return $purchaseDetail
            ? (int) ($purchaseDetail->selling_price ?: $purchaseDetail->calculateSellingPrice())
            : (int) ($this->sell_price ?? 0);
    }

    public function scopeActive($query)
    {
        return $query->where('status', 'active');
    }

    public function scopeLowStock($query)
    {
        return $query->whereRaw('stock <= minimal_stock')
            ->where('minimal_stock', '>', 0);
    }
    /**
     * Check if part stock is below minimal stock
     */
    public function isLowStock(): bool
    {
        if ($this->minimal_stock <= 0) {
            return false;
        }
        return $this->stock <= $this->minimal_stock;
    }

    /**
     * Get accessor for stock status
     */
    public function getStockStatusAttribute(): string
    {
        if ($this->minimal_stock > 0 && $this->stock <= $this->minimal_stock) {
            return 'low';
        }
        if ($this->stock == 0) {
            return 'out';
        }
        return 'normal';
    }
}
