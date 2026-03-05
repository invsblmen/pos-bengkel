<?php

namespace App\Events;

use Illuminate\Broadcasting\Channel;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Contracts\Broadcasting\ShouldBroadcastNow;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class MechanicDeleted implements ShouldBroadcastNow
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public int $mechanicId;

    public function __construct(int $mechanicId)
    {
        $this->mechanicId = $mechanicId;
    }

    public function broadcastAs(): string
    {
        return 'mechanic.deleted';
    }

    public function broadcastWith(): array
    {
        return ['mechanicId' => $this->mechanicId];
    }

    public function broadcastOn(): array
    {
        return [new Channel('workshop.mechanics')];
    }
}
