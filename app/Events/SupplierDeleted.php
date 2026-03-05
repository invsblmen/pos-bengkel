<?php

namespace App\Events;

use Illuminate\Broadcasting\Channel;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Contracts\Broadcasting\ShouldBroadcastNow;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class SupplierDeleted implements ShouldBroadcastNow
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public int $supplierId;

    public function __construct(int $supplierId)
    {
        $this->supplierId = $supplierId;
    }

    public function broadcastAs(): string
    {
        return 'supplier.deleted';
    }

    public function broadcastWith(): array
    {
        return ['supplierId' => $this->supplierId];
    }

    public function broadcastOn(): array
    {
        return [new Channel('workshop.suppliers')];
    }
}
