<?php

namespace App\Events;

use Illuminate\Broadcasting\Channel;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Contracts\Broadcasting\ShouldBroadcastNow;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class PartPurchaseOrderDeleted implements ShouldBroadcastNow
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public int $partPurchaseOrderId;

    /**
     * Create a new event instance.
     */
    public function __construct(int $partPurchaseOrderId)
    {
        $this->partPurchaseOrderId = $partPurchaseOrderId;
    }

    public function broadcastAs(): string
    {
        return 'partpurchaseorder.deleted';
    }

    public function broadcastWith(): array
    {
        return [
            'partPurchaseOrderId' => $this->partPurchaseOrderId,
        ];
    }

    /**
     * Get the channels the event should broadcast on.
     *
     * @return array<int, \Illuminate\Broadcasting\Channel>
     */
    public function broadcastOn(): array
    {
        return [
            new Channel('workshop.partpurchaseorders'),
        ];
    }
}
