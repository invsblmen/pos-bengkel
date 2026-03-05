<?php

namespace App\Events;

use Illuminate\Broadcasting\Channel;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Contracts\Broadcasting\ShouldBroadcastNow;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class VehicleDeleted implements ShouldBroadcastNow
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public int $vehicleId;

    public function __construct(int $vehicleId)
    {
        $this->vehicleId = $vehicleId;
    }

    public function broadcastAs(): string
    {
        return 'vehicle.deleted';
    }

    public function broadcastWith(): array
    {
        return ['vehicleId' => $this->vehicleId];
    }

    public function broadcastOn(): array
    {
        return [new Channel('workshop.vehicles')];
    }
}
