<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class CashTransactionItem extends Model
{
    use HasFactory;

    protected $fillable = [
        'cash_transaction_id',
        'denomination_id',
        'direction',
        'quantity',
        'line_total',
    ];

    protected $casts = [
        'quantity' => 'integer',
        'line_total' => 'integer',
    ];

    public function transaction()
    {
        return $this->belongsTo(CashTransaction::class, 'cash_transaction_id');
    }

    public function denomination()
    {
        return $this->belongsTo(CashDenomination::class, 'denomination_id');
    }
}
