<?php

namespace App\Notifications;

use App\Models\PartSaleDetail;
use Illuminate\Bus\Queueable;
use Illuminate\Notifications\Notification;

class PartSaleWarrantyExpiringNotification extends Notification
{
    use Queueable;

    public function __construct(private PartSaleDetail $detail, private int $daysLeft)
    {
    }

    public function via(object $notifiable): array
    {
        return ['database'];
    }

    public function toDatabase(object $notifiable): array
    {
        $saleNumber = $this->detail->partSale?->sale_number ?? '-';
        $partName = $this->detail->part?->name ?? 'Sparepart';
        $customerName = $this->detail->partSale?->customer?->name ?? '-';
        $endDate = optional($this->detail->warranty_end_date)->format('d M Y') ?? '-';

        return [
            'title' => 'Garansi Sparepart Akan Expired',
            'message' => "Garansi {$partName} untuk transaksi {$saleNumber} ({$customerName}) berakhir {$endDate} ({$this->daysLeft} hari lagi).",
            'reference' => $saleNumber,
            'sale_id' => $this->detail->part_sale_id,
            'part_id' => $this->detail->part_id,
            'part_sale_detail_id' => $this->detail->id,
            'warranty_end_date' => optional($this->detail->warranty_end_date)->toDateString(),
            'days_left' => $this->daysLeft,
            'context' => 'part-sale-warranty-expiring',
        ];
    }
}
