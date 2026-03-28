<?php

namespace App\Events;

use Illuminate\Broadcasting\Channel;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Contracts\Broadcasting\ShouldBroadcastNow;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class VoucherUpdated implements ShouldBroadcastNow
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public array $voucher;

    public function __construct(array $voucher)
    {
        $this->voucher = $voucher;
    }

    public function broadcastAs(): string
    {
        return 'voucher.updated';
    }

    public function broadcastWith(): array
    {
        return [
            'voucher' => $this->voucher,
        ];
    }

    public function broadcastOn(): array
    {
        return [new Channel('workshop.vouchers')];
    }
}
