<?php

namespace App\Events;

use Illuminate\Broadcasting\Channel;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Contracts\Broadcasting\ShouldBroadcastNow;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class ServiceDeleted implements ShouldBroadcastNow
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public int $serviceId;

    /**
     * Create a new event instance.
     */
    public function __construct(int $serviceId)
    {
        $this->serviceId = $serviceId;
    }

    public function broadcastAs(): string
    {
        return 'service.deleted';
    }

    public function broadcastWith(): array
    {
        return [
            'serviceId' => $this->serviceId,
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
            new Channel('workshop.services'),
        ];
    }
}
