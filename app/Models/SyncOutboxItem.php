<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class SyncOutboxItem extends Model
{
    use HasFactory;

    protected $fillable = [
        'sync_batch_id',
        'entity_type',
        'entity_id',
        'event_type',
        'payload',
        'payload_hash',
        'status',
        'attempt_count',
        'last_attempt_at',
        'last_error',
    ];

    protected $casts = [
        'payload' => 'array',
        'attempt_count' => 'integer',
        'last_attempt_at' => 'datetime',
    ];
}