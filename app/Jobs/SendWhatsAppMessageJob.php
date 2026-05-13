<?php

namespace App\Jobs;

use App\Events\WhatsAppOutboundUpdated;
use App\Models\WhatsAppOutboundMessage;
use App\Services\WhatsAppClient;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;

class SendWhatsAppMessageJob implements ShouldQueue
{
    use Queueable;

    public int $tries = 5;

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
            $numberCheck = $whatsAppClient->checkNumber($outbound->phone);

            if (!($numberCheck['is_on_whatsapp'] ?? false)) {
                $outbound->update([
                    'status' => 'failed',
                    'error_message' => 'Nomor tujuan tidak terdaftar WhatsApp: ' . ($numberCheck['normalized_phone'] ?? $outbound->phone),
                    'failed_at' => now(),
                ]);

                event(new WhatsAppOutboundUpdated($outbound->fresh()));

                return;
            }

            $result = $whatsAppClient->sendText($outbound->phone, $outbound->message);

            $outbound->update([
                'status' => 'sent',
                'external_message_id' => $result['message_id'] ?? null,
                'response_body' => $result['raw'] ?? null,
                'error_message' => null,
                'sent_at' => now(),
                'failed_at' => null,
            ]);

            event(new WhatsAppOutboundUpdated($outbound->fresh()));
        } catch (\Throwable $e) {
            $outbound->update([
                'status' => 'failed',
                'error_message' => $e->getMessage(),
                'failed_at' => now(),
            ]);

            event(new WhatsAppOutboundUpdated($outbound->fresh()));

            throw $e;
        }
    }

    /**
     * Exponential backoff retries (in seconds).
     * Failed jobs will end up in the failed_jobs table as dead-letter records.
     *
     * @return array<int,int>
     */
    public function backoff(): array
    {
        return [10, 30, 60, 120, 300];
    }
}
