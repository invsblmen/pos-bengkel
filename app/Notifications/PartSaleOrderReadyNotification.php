<?php

namespace App\Notifications;

use App\Models\PartSale;
use Illuminate\Bus\Queueable;
use Illuminate\Notifications\Notification;

class PartSaleOrderReadyNotification extends Notification
{
    use Queueable;

    public function __construct(private PartSale $sale)
    {
    }

    public function via(object $notifiable): array
    {
        return ['database'];
    }

    public function toDatabase(object $notifiable): array
    {
        return [
            'title' => 'Pesanan Sparepart Siap Diproses',
            'message' => "Pesanan {$this->sale->sale_number} sudah terpenuhi stoknya dan siap diberitahukan ke konsumen.",
            'reference' => $this->sale->sale_number,
            'sale_id' => $this->sale->id,
            'status' => $this->sale->status,
            'context' => 'part-sale-order-ready',
        ];
    }
}
