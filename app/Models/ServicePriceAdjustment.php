<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class ServicePriceAdjustment extends Model
{
    use HasFactory;

    protected $fillable = [
        'service_id',
        'trigger_service_id',
        'discount_type',
        'discount_value',
    ];

    protected $casts = [
        'discount_value' => 'decimal:2',
    ];

    public function service()
    {
        return $this->belongsTo(Service::class);
    }

    public function triggerService()
    {
        return $this->belongsTo(Service::class, 'trigger_service_id');
    }
}
