<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class CashDenomination extends Model
{
    use HasFactory;

    protected $fillable = [
        'value',
        'is_active',
    ];

    protected $casts = [
        'value' => 'integer',
        'is_active' => 'boolean',
    ];

    public function drawerStock()
    {
        return $this->hasOne(CashDrawerDenomination::class, 'denomination_id');
    }

    public function transactionItems()
    {
        return $this->hasMany(CashTransactionItem::class, 'denomination_id');
    }
}
