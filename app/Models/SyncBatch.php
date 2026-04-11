<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class SyncBatch extends Model
{
    use HasFactory;

    protected $fillable = [
        'sync_batch_id',
        'scope',
        'payload_type',
        'source_date',
        'source_workshop_id',
        'payload_hash',
        'payload_json',
        'status',
        'attempt_count',
        'last_attempt_at',
        'acknowledged_at',
        'last_error',
    ];

    protected $casts = [
        'source_date' => 'date',
        'payload_json' => 'array',
        'attempt_count' => 'integer',
        'last_attempt_at' => 'datetime',
        'acknowledged_at' => 'datetime',
    ];
}