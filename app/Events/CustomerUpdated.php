<?php

namespace App\Events;

use Illuminate\Broadcasting\Channel;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Contracts\Broadcasting\ShouldBroadcastNow;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class CustomerUpdated implements ShouldBroadcastNow
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public array $customer;

    public function __construct(array $customer)
    {
        $this->customer = $customer;
    }

    public function broadcastAs(): string
    {
        return 'customer.updated';
    }

    public function broadcastWith(): array
    {
        return ['customer' => $this->customer];
    }

    public function broadcastOn(): array
    {
        return [new Channel('workshop.customers')];
    }
}
