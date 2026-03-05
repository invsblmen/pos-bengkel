<?php

namespace App\Events;

use Illuminate\Broadcasting\Channel;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Contracts\Broadcasting\ShouldBroadcastNow;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class PartPurchaseCreated implements ShouldBroadcastNow
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public array $partPurchase;

    public function __construct(array $partPurchase)
    {
        $this->partPurchase = $partPurchase;
    }

    public function broadcastAs(): string
    {
        return 'partpurchase.created';
    }

    public function broadcastWith(): array
    {
        return ['purchase' => $this->partPurchase];
    }

    public function broadcastOn(): array
    {
        return [new Channel('workshop.partpurchases')];
    }
}
