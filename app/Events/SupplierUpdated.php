<?php

namespace App\Events;

use Illuminate\Broadcasting\Channel;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Contracts\Broadcasting\ShouldBroadcastNow;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class SupplierUpdated implements ShouldBroadcastNow
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public array $supplier;

    public function __construct(array $supplier)
    {
        $this->supplier = $supplier;
    }

    public function broadcastAs(): string
    {
        return 'supplier.updated';
    }

    public function broadcastWith(): array
    {
        return ['supplier' => $this->supplier];
    }

    public function broadcastOn(): array
    {
        return [new Channel('workshop.suppliers')];
    }
}
