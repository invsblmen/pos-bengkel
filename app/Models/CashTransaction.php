<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class CashTransaction extends Model
{
    use HasFactory;

    protected $fillable = [
        'transaction_type',
        'amount',
        'source',
        'description',
        'meta',
        'happened_at',
        'created_by',
    ];

    protected $casts = [
        'amount' => 'integer',
        'meta' => 'array',
        'happened_at' => 'datetime',
    ];

    public function items()
    {
        return $this->hasMany(CashTransactionItem::class, 'cash_transaction_id');
    }

    public function user()
    {
        return $this->belongsTo(User::class, 'created_by');
    }
}
