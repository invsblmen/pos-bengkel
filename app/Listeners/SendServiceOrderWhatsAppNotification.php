<?php

namespace App\Listeners;

use App\Events\ServiceOrderCreated;
use App\Events\ServiceOrderUpdated;
use App\Jobs\SendWhatsAppMessageJob;
use App\Models\WhatsAppOutboundMessage;

class SendServiceOrderWhatsAppNotification
{
    public function handle(ServiceOrderCreated|ServiceOrderUpdated $event): void
    {
        if (!config('whatsapp.enabled')) {
            return;
        }

        $serviceOrder = $event->serviceOrder;
        $customer = $serviceOrder['customer'] ?? [];

        $phone = (string) ($customer['phone'] ?? '');
        if ($phone === '') {
            return;
        }

        $isCreated = $event instanceof ServiceOrderCreated;

        if ($isCreated && !config('whatsapp.notifications.service_order_created')) {
            return;
        }

        if (!$isCreated && !config('whatsapp.notifications.service_order_updated')) {
            return;
        }

        $message = $this->buildMessage($serviceOrder, $isCreated);

        $outbound = WhatsAppOutboundMessage::create([
            'event_type' => $isCreated ? 'service_order.created' : 'service_order.updated',
            'related_type' => 'service_order',
            'related_id' => $serviceOrder['id'] ?? null,
            'customer_id' => $serviceOrder['customer_id'] ?? null,
            'device_id' => config('whatsapp.api.device_id'),
            'phone' => $phone,
            'message' => $message,
            'status' => 'queued',
        ]);

        SendWhatsAppMessageJob::dispatch($outbound->id)
            ->onQueue((string) config('whatsapp.notifications.queue', 'default'));
    }

    /**
     * @param array<string,mixed> $serviceOrder
     */
    private function buildMessage(array $serviceOrder, bool $isCreated): string
    {
        $customer = $serviceOrder['customer']['name'] ?? 'Pelanggan';
        $orderNumber = $serviceOrder['order_number'] ?? '-';
        $status = strtoupper((string) ($serviceOrder['status'] ?? 'pending'));
        $workshopName = (string) config('app.name');

        if ($isCreated) {
            return implode("\n", [
                "Halo {$customer},",
                "Service order Anda telah dibuat.",
                "No. Order: {$orderNumber}",
                "Status: {$status}",
                "Bengkel: {$workshopName}",
                "Terima kasih sudah mempercayakan kendaraan Anda kepada kami.",
            ]);
        }

        return implode("\n", [
            "Halo {$customer},",
            "Ada pembaruan service order Anda.",
            "No. Order: {$orderNumber}",
            "Status terbaru: {$status}",
            "Bengkel: {$workshopName}",
            "Terima kasih.",
        ]);
    }
}
