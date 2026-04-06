<?php

namespace App\Jobs;

use App\Models\WhatsAppOutboundMessage;
use App\Services\WhatsAppClient;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;

class SendWhatsAppMessageJob implements ShouldQueue
{
    use Queueable;

    public int $tries = 3;

    public int $backoff = 10;

    public function __construct(public int $outboundMessageId)
    {
    }

    public function handle(WhatsAppClient $whatsAppClient): void
    {
        $outbound = WhatsAppOutboundMessage::find($this->outboundMessageId);

        if (!$outbound || $outbound->status === 'sent') {
            return;
        }

        try {
            $result = $whatsAppClient->sendText($outbound->phone, $outbound->message);

            $outbound->update([
                'status' => 'sent',
                'external_message_id' => $result['message_id'] ?? null,
                'response_body' => $result['raw'] ?? null,
                'error_message' => null,
                'sent_at' => now(),
                'failed_at' => null,
            ]);
        } catch (\Throwable $e) {
            $outbound->update([
                'status' => 'failed',
                'error_message' => $e->getMessage(),
                'failed_at' => now(),
            ]);

            throw $e;
        }
    }
}
