<?php

namespace App\Events;

use Illuminate\Broadcasting\Channel;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Contracts\Broadcasting\ShouldBroadcastNow;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class PartDeleted implements ShouldBroadcastNow
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public int $partId;

    public function __construct(int $partId)
    {
        $this->partId = $partId;
    }

    public function broadcastAs(): string
    {
        return 'part.deleted';
    }

    public function broadcastWith(): array
    {
        return ['partId' => $this->partId];
    }

    public function broadcastOn(): array
    {
        return [new Channel('workshop.parts')];
    }
}
