<?php

namespace App\Events;

use Illuminate\Broadcasting\Channel;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Contracts\Broadcasting\ShouldBroadcastNow;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class VoucherDeleted implements ShouldBroadcastNow
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public int $voucherId;

    public function __construct(int $voucherId)
    {
        $this->voucherId = $voucherId;
    }

    public function broadcastAs(): string
    {
        return 'voucher.deleted';
    }

    public function broadcastWith(): array
    {
        return [
            'voucherId' => $this->voucherId,
        ];
    }

    public function broadcastOn(): array
    {
        return [new Channel('workshop.vouchers')];
    }
}
