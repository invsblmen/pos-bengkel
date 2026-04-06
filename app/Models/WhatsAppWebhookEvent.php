<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class WhatsAppWebhookEvent extends Model
{
    use HasFactory;

    protected $table = 'whatsapp_webhook_events';

    protected $fillable = [
        'event',
        'device_id',
        'signature_valid',
        'headers',
        'payload',
        'received_at',
    ];

    protected $casts = [
        'headers' => 'array',
        'payload' => 'array',
        'signature_valid' => 'boolean',
        'received_at' => 'datetime',
    ];
}
