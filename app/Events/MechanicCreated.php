<?php

namespace App\Events;

use Illuminate\Broadcasting\Channel;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Contracts\Broadcasting\ShouldBroadcastNow;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class MechanicCreated implements ShouldBroadcastNow
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public array $mechanic;

    public function __construct(array $mechanic)
    {
        $this->mechanic = $mechanic;
    }

    public function broadcastAs(): string
    {
        return 'mechanic.created';
    }

    public function broadcastWith(): array
    {
        return ['mechanic' => $this->mechanic];
    }

    public function broadcastOn(): array
    {
        return [new Channel('workshop.mechanics')];
    }
}
