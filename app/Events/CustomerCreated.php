<?php

namespace App\Events;

use Illuminate\Broadcasting\Channel;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Contracts\Broadcasting\ShouldBroadcastNow;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class CustomerCreated implements ShouldBroadcastNow
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public array $customer;

    /**
     * Create a new event instance.
     */
    public function __construct(array $customer)
    {
        $this->customer = $customer;
    }

    public function broadcastAs(): string
    {
        return 'customer.created';
    }

    public function broadcastWith(): array
    {
        return [
            'customer' => $this->customer,
        ];
    }

    /**
     * Get the channels the event should broadcast on.
     *
     * @return array<int, \Illuminate\Broadcasting\Channel>
     */
    public function broadcastOn(): array
    {
        return [
            new Channel('workshop.customers'),
        ];
    }
}
