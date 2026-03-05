<?php

namespace App\Events;

use Illuminate\Broadcasting\Channel;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Contracts\Broadcasting\ShouldBroadcastNow;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class PartSaleCreated implements ShouldBroadcastNow
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public array $partSale;

    /**
     * Create a new event instance.
     */
    public function __construct(array $partSale)
    {
        $this->partSale = $partSale;
    }

    /**
     * Get the channels the event should broadcast on.
     *
     * @return array<int, \Illuminate\Broadcasting\Channel>
     */
    public function broadcastOn(): array
    {
        return [
            new Channel('workshop.partsales'),
        ];
    }

    public function broadcastAs(): string
    {
        return 'partsale.created';
    }

    public function broadcastWith(): array
    {
        return ['partSale' => $this->partSale];
    }
}
