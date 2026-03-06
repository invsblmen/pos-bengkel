<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class CashDrawerDenomination extends Model
{
    use HasFactory;

    protected $fillable = [
        'denomination_id',
        'quantity',
    ];

    protected $casts = [
        'quantity' => 'integer',
    ];

    public function denomination()
    {
        return $this->belongsTo(CashDenomination::class, 'denomination_id');
    }

    public function getSubtotalAttribute(): int
    {
        return (int) ($this->quantity * ($this->denomination?->value ?? 0));
    }
}
