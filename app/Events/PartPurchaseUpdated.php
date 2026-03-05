<?php

namespace App\Events;

use Illuminate\Broadcasting\Channel;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Contracts\Broadcasting\ShouldBroadcastNow;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class PartPurchaseUpdated implements ShouldBroadcastNow
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public array $partPurchase;

    /**
     * Create a new event instance.
     */
    public function __construct(array $partPurchase)
    {
        $this->partPurchase = $partPurchase;
    }

    /**
     * Get the channels the event should broadcast on.
     *
     * @return array<int, \Illuminate\Broadcasting\Channel>
     */
    public function broadcastOn(): array
    {
        return [
            new Channel('workshop.partpurchases'),
        ];
    }

    public function broadcastAs(): string
    {
        return 'partpurchase.updated';
    }

    public function broadcastWith(): array
    {
        return ['purchase' => $this->partPurchase];
    }
}
