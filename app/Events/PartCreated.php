<?php

namespace App\Events;

use Illuminate\Broadcasting\Channel;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Contracts\Broadcasting\ShouldBroadcastNow;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class PartCreated implements ShouldBroadcastNow
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public array $part;

    public function __construct(array $part)
    {
        $this->part = $part;
    }

    public function broadcastAs(): string
    {
        return 'part.created';
    }

    public function broadcastWith(): array
    {
        return ['part' => $this->part];
    }

    public function broadcastOn(): array
    {
        return [new Channel('workshop.parts')];
    }
}
