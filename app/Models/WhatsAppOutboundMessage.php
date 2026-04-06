<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class WhatsAppOutboundMessage extends Model
{
    use HasFactory;

    protected $table = 'whatsapp_outbound_messages';

    protected $fillable = [
        'event_type',
        'related_type',
        'related_id',
        'customer_id',
        'device_id',
        'phone',
        'message',
        'status',
        'external_message_id',
        'response_body',
        'error_message',
        'sent_at',
        'failed_at',
    ];

    protected $casts = [
        'response_body' => 'array',
        'sent_at' => 'datetime',
        'failed_at' => 'datetime',
    ];
}
