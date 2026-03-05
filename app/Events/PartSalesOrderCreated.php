<?php

namespace App\Events;

use Illuminate\Broadcasting\Channel;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Contracts\Broadcasting\ShouldBroadcastNow;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class PartSalesOrderCreated implements ShouldBroadcastNow
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public array $partSalesOrder;

    /**
     * Create a new event instance.
     */
    public function __construct(array $partSalesOrder)
    {
        $this->partSalesOrder = $partSalesOrder;
    }

    public function broadcastAs(): string
    {
        return 'partsalesorder.created';
    }

    public function broadcastWith(): array
    {
        return [
            'partSalesOrder' => $this->partSalesOrder,
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
            new Channel('workshop.partsalesorders'),
        ];
    }
}
