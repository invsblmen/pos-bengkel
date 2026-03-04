<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class Service extends Model
{
    use HasFactory, SoftDeletes;

    protected $fillable = [
        'code', 'title', 'description', 'est_time_minutes', 'price',
        'service_category_id', 'complexity_level', 'required_tools', 'status',
        'incentive_mode', 'default_incentive_percentage'
    ];

    protected $casts = [
        'required_tools' => 'array',
        'est_time_minutes' => 'integer',
        'price' => 'integer',
        'default_incentive_percentage' => 'decimal:2',
    ];

    public function category()
    {
        return $this->belongsTo(ServiceCategory::class, 'service_category_id');
    }

    public function serviceOrderDetails()
    {
        return $this->hasMany(ServiceOrderDetail::class);
    }

    public function priceAdjustments()
    {
        return $this->hasMany(ServicePriceAdjustment::class);
    }

    public function mechanicIncentives()
    {
        return $this->hasMany(ServiceMechanicIncentive::class);
    }

    public function scopeActive($query)
    {
        return $query->where('status', 'active');
    }
}
