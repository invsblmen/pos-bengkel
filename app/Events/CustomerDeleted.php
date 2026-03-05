<?php

namespace App\Events;

use Illuminate\Broadcasting\Channel;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Contracts\Broadcasting\ShouldBroadcastNow;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class CustomerDeleted implements ShouldBroadcastNow
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public int $customerId;

    public function __construct(int $customerId)
    {
        $this->customerId = $customerId;
    }

    public function broadcastAs(): string
    {
        return 'customer.deleted';
    }

    public function broadcastWith(): array
    {
        return ['customerId' => $this->customerId];
    }

    public function broadcastOn(): array
    {
        return [new Channel('workshop.customers')];
    }
}
