<?php

namespace App\Events;

use Illuminate\Broadcasting\Channel;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Contracts\Broadcasting\ShouldBroadcastNow;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class PartPurchaseOrderCreated implements ShouldBroadcastNow
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public array $partPurchaseOrder;

    /**
     * Create a new event instance.
     */
    public function __construct(array $partPurchaseOrder)
    {
        $this->partPurchaseOrder = $partPurchaseOrder;
    }

    public function broadcastAs(): string
    {
        return 'partpurchaseorder.created';
    }

    public function broadcastWith(): array
    {
        return [
            'partPurchaseOrder' => $this->partPurchaseOrder,
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
