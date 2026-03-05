<?php

namespace App\Events;

use Illuminate\Broadcasting\Channel;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Contracts\Broadcasting\ShouldBroadcastNow;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class ServiceOrderUpdated implements ShouldBroadcastNow
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public array $serviceOrder;

    /**
     * Create a new event instance.
     */
    public function __construct(array $serviceOrder)
    {
        $this->serviceOrder = $serviceOrder;
    }

    public function broadcastAs(): string
    {
        return 'serviceorder.updated';
    }

    public function broadcastWith(): array
    {
        return [
            'serviceOrder' => $this->serviceOrder,
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
