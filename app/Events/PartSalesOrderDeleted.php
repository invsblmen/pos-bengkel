<?php

namespace App\Events;

use Illuminate\Broadcasting\Channel;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Contracts\Broadcasting\ShouldBroadcastNow;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class PartSalesOrderDeleted implements ShouldBroadcastNow
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public int $partSalesOrderId;

    /**
     * Create a new event instance.
     */
    public function __construct(int $partSalesOrderId)
    {
        $this->partSalesOrderId = $partSalesOrderId;
    }

    public function broadcastAs(): string
    {
        return 'partsalesorder.deleted';
    }

    public function broadcastWith(): array
    {
        return [
            'partSalesOrderId' => $this->partSalesOrderId,
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
