<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Mechanic extends Model
{
    use HasFactory;

    protected $fillable = [
        'name', 'phone', 'email', 'employee_number', 'notes',
        'status', 'specialization', 'hourly_rate', 'commission_percentage', 'certification'
    ];

    protected $casts = [
        'specialization' => 'array',
        'certification' => 'array',
        'hourly_rate' => 'integer',
        'commission_percentage' => 'decimal:2',
    ];

    public function serviceOrders()
    {
        return $this->hasMany(ServiceOrder::class);
    }

    public function appointments()
    {
        return $this->hasMany(Appointment::class);
    }

    public function serviceIncentives()
    {
        return $this->hasMany(ServiceMechanicIncentive::class);
    }

    public function getDisplayAttribute()
    {
        return $this->employee_number ? $this->name . ' (' . $this->employee_number . ')' : $this->name;
    }

    public function scopeActive($query)
    {
        return $query->where('status', 'active');
    }
}
