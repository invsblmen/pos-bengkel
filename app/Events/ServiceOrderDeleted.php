<?php

namespace App\Events;

use Illuminate\Broadcasting\Channel;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Contracts\Broadcasting\ShouldBroadcastNow;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class ServiceOrderDeleted implements ShouldBroadcastNow
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public int $serviceOrderId;

    /**
     * Create a new event instance.
     */
    public function __construct(int $serviceOrderId)
    {
        $this->serviceOrderId = $serviceOrderId;
    }

    public function broadcastAs(): string
    {
        return 'serviceorder.deleted';
    }

    public function broadcastWith(): array
    {
        return [
            'serviceOrderId' => $this->serviceOrderId,
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
            new Channel('workshop.serviceorders'),
        ];
    }
}
