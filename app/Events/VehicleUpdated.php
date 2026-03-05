<?php

namespace App\Events;

use Illuminate\Broadcasting\Channel;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Contracts\Broadcasting\ShouldBroadcastNow;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class VehicleUpdated implements ShouldBroadcastNow
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public array $vehicle;

    public function __construct(array $vehicle)
    {
        $this->vehicle = $vehicle;
    }

    public function broadcastAs(): string
    {
        return 'vehicle.updated';
    }

    public function broadcastWith(): array
    {
        return ['vehicle' => $this->vehicle];
    }

    public function broadcastOn(): array
    {
        return [new Channel('workshop.vehicles')];
    }
}
