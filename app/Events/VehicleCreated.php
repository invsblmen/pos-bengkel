<?php

namespace App\Events;

use Illuminate\Broadcasting\Channel;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Contracts\Broadcasting\ShouldBroadcastNow;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class VehicleCreated implements ShouldBroadcastNow
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public array $vehicle;

    /**
     * Create a new event instance.
     */
    public function __construct(array $vehicle)
    {
        $this->vehicle = $vehicle;
    }

    public function broadcastAs(): string
    {
        return 'vehicle.created';
    }

    public function broadcastWith(): array
    {
        return [
            'vehicle' => $this->vehicle,
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
            new Channel('workshop.vehicles'),
        ];
    }
}
