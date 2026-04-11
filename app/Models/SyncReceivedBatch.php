<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class SyncReceivedBatch extends Model
{
    use HasFactory;

    protected $fillable = [
        'sync_batch_id',
        'source_workshop_id',
        'scope',
        'payload_type',
        'source_date',
        'payload_hash',
        'payload_json',
        'summary_json',
        'status',
        'last_error',
        'received_at',
        'acknowledged_at',
    ];

    protected $casts = [
        'source_date' => 'date',
        'payload_json' => 'array',
        'summary_json' => 'array',
        'received_at' => 'datetime',
        'acknowledged_at' => 'datetime',
    ];
}