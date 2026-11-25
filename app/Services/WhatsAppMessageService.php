<?php

namespace App\Services;

use App\Events\WhatsAppOutboundUpdated;
use App\Jobs\SendWhatsAppMessageJob;
use App\Models\Appointment;
use App\Models\Customer;
use App\Models\PartSale;
use App\Models\ServiceOrder;
use App\Models\WhatsAppOutboundMessage;
use Carbon\Carbon;
use Carbon\CarbonInterface;
use Illuminate\Http\Client\RequestException;
use Illuminate\Support\Facades\Http;
use Illuminate\Validation\ValidationException;

class WhatsAppMessageService
{
    public function __construct(private WhatsAppClient $whatsAppClient)
    {
    }

    /**
     * @return array{is_on_whatsapp: bool, phone: string, normalized_phone: string, raw: array}
     */
    public function checkCustomer(Customer $customer): array
    {
        $normalizedPhone = $this->whatsAppClient->normalizePhone((string) $customer->phone);
        $baseUrl = (string) config('whatsapp.api.base_url');
        $timeout = (int) config('whatsapp.api.timeout_seconds', 15);
        $retryTimes = (int) config('whatsapp.api.retry_times', 2);
        $retrySleep = (int) config('whatsapp.api.retry_sleep_ms', 250);
        $username = config('whatsapp.api.username');
        $password = config('whatsapp.api.password');
        $deviceId = config('whatsapp.api.device_id');

        $request = Http::acceptJson()
            ->contentType('application/json')
            ->baseUrl(rtrim($baseUrl, '/'))
            ->timeout($timeout)
            ->retry($retryTimes, $retrySleep);

        if ($username && $password) {
            $request = $request->withBasicAuth((string) $username, (string) $password);
        }

        if ($deviceId) {
            $request = $request->withHeaders([
                'X-Device-Id' => (string) $deviceId,
            ]);
        }

        $response = $request
            ->get('/user/check', ['phone' => $normalizedPhone])
            ->throw();

        $json = $response->json();

        if (!is_array($json) || ($json['code'] ?? null) !== 'SUCCESS') {
            throw new RequestException($response);
        }

        $results = is_array($json['results'] ?? null) ? $json['results'] : [];

        return [
            'is_on_whatsapp' => (bool) ($results['is_on_whatsapp'] ?? false),
            'phone' => (string) $customer->phone,
            'normalized_phone' => $normalizedPhone,
            'raw' => $json,
        ];
    }

    public function sendServiceOrderSummary(ServiceOrder $order, ?string $note = null): ?WhatsAppOutboundMessage
    {
        $customer = $order->customer;

        if (!$customer || trim((string) $customer->phone) === '') {
            return null;
        }

        return $this->queueCustomerMessage(
            $customer,
            $this->buildServiceOrderSummary($order, $note),
            'service_order.summary',
            'service_order',
            $order->id
        );
    }

    public function sendAppointmentReminder(Appointment $appointment, ?string $note = null): ?WhatsAppOutboundMessage
    {
        $customer = $appointment->customer;

        if (!$customer || trim((string) $customer->phone) === '') {
            return null;
        }

        return $this->queueCustomerMessage(
            $customer,
            $this->buildAppointmentReminder($appointment, $note),
            'appointment.reminder',
            'appointment',
            $appointment->id
        );
    }

    public function sendPartSaleReadyNotification(PartSale $sale, ?string $note = null): ?WhatsAppOutboundMessage
    {
        $customer = $sale->customer;

        if (!$customer || trim((string) $customer->phone) === '') {
            return null;
        }

        return $this->queueCustomerMessage(
            $customer,
            $this->buildPartSaleReadyMessage($sale, $note),
            'part_sale.order_ready',
            'part_sale',
            $sale->id
        );
    }

    public function queueCustomerMessage(Customer $customer, string $message, string $eventType, ?string $relatedType = null, ?int $relatedId = null): ?WhatsAppOutboundMessage
    {
        $phone = trim((string) $customer->phone);

        if ($phone === '') {
            return null;
        }

        $numberCheck = $this->whatsAppClient->checkNumber($phone);

        if (!($numberCheck['is_on_whatsapp'] ?? false)) {
            $outbound = WhatsAppOutboundMessage::create([
                'event_type' => $eventType,
                'related_type' => $relatedType,
                'related_id' => $relatedId,
                'customer_id' => $customer->id,
                'device_id' => config('whatsapp.api.device_id'),
                'phone' => $phone,
                'message' => $message,
                'status' => 'failed',
                'error_message' => 'Nomor tujuan tidak terdaftar WhatsApp: ' . ($numberCheck['normalized_phone'] ?? $phone),
                'failed_at' => now(),
            ]);

            event(new WhatsAppOutboundUpdated($outbound));

            throw ValidationException::withMessages([
                'phone' => 'Nomor tujuan tidak terdaftar WhatsApp: ' . ($numberCheck['normalized_phone'] ?? $phone),
            ]);
        }

        $outbound = WhatsAppOutboundMessage::create([
            'event_type' => $eventType,
            'related_type' => $relatedType,
            'related_id' => $relatedId,
            'customer_id' => $customer->id,
            'device_id' => config('whatsapp.api.device_id'),
            'phone' => $phone,
            'message' => $message,
            'status' => 'queued',
        ]);

        event(new WhatsAppOutboundUpdated($outbound));

        SendWhatsAppMessageJob::dispatch($outbound->id)
            ->onQueue((string) config('whatsapp.notifications.queue', 'default'));

        return $outbound;
    }

    public function queueRawMessage(string $phone, string $message, string $eventType, ?int $customerId = null, ?string $relatedType = null, ?int $relatedId = null): ?WhatsAppOutboundMessage
    {
        $phone = trim($phone);

        if ($phone === '') {
            return null;
        }

        $numberCheck = $this->whatsAppClient->checkNumber($phone);

        if (!($numberCheck['is_on_whatsapp'] ?? false)) {
            $outbound = WhatsAppOutboundMessage::create([
                'event_type' => $eventType,
                'related_type' => $relatedType,
                'related_id' => $relatedId,
                'customer_id' => $customerId,
                'device_id' => config('whatsapp.api.device_id'),
                'phone' => $phone,
                'message' => $message,
                'status' => 'failed',
                'error_message' => 'Nomor tujuan tidak terdaftar WhatsApp: ' . ($numberCheck['normalized_phone'] ?? $phone),
                'failed_at' => now(),
            ]);

            event(new WhatsAppOutboundUpdated($outbound));

            throw ValidationException::withMessages([
                'phone' => 'Nomor tujuan tidak terdaftar WhatsApp: ' . ($numberCheck['normalized_phone'] ?? $phone),
            ]);
        }

        $outbound = WhatsAppOutboundMessage::create([
            'event_type' => $eventType,
            'related_type' => $relatedType,
            'related_id' => $relatedId,
            'customer_id' => $customerId,
            'device_id' => config('whatsapp.api.device_id'),
            'phone' => $phone,
            'message' => $message,
            'status' => 'queued',
        ]);

        event(new WhatsAppOutboundUpdated($outbound));

        SendWhatsAppMessageJob::dispatch($outbound->id)
            ->onQueue((string) config('whatsapp.notifications.queue', 'default'));

        return $outbound;
    }

    public function buildServiceOrderSummary(ServiceOrder $order, ?string $note = null): string
    {
        $customerName = $order->customer?->name ?? 'Pelanggan';
        $vehicleLabel = trim(implode(' ', array_filter([
            $order->vehicle?->brand,
            $order->vehicle?->model,
        ]))) ?: '-';
        $plateNumber = $order->vehicle?->plate_number ?? '-';
        $mechanicName = $order->mechanic?->name ?? '-';
        $workshopName = (string) config('app.name');

        $details = $order->details->map(function ($detail) {
            $itemName = $detail->service?->title ?? $detail->part?->name ?? '-';
            $qty = max(1, (int) ($detail->qty ?? 1));
            $subtotal = (int) ($detail->final_amount ?? $detail->amount ?? 0);

            return sprintf(
                '- %s x%d = Rp%s',
                $itemName,
                $qty,
                number_format($subtotal, 0, ',', '.')
            );
        })->implode("\n");

        $lines = [
            "Halo {$customerName},",
            'Berikut rincian service order Anda:',
            "No. Order: {$order->order_number}",
            "Kendaraan: {$plateNumber} / {$vehicleLabel}",
            "Mekanik: {$mechanicName}",
        ];

        if ($details !== '') {
            $lines[] = 'Rincian pekerjaan:';
            $lines[] = $details;
        }

        $lines = array_merge($lines, [
            'Ringkasan biaya:',
            '• Total Jasa: Rp' . number_format((int) ($order->labor_cost ?? 0), 0, ',', '.'),
            '• Total Sparepart: Rp' . number_format((int) ($order->material_cost ?? 0), 0, ',', '.'),
            '• Diskon: Rp' . number_format((int) ($order->discount_amount ?? 0), 0, ',', '.'),
            '• Pajak: Rp' . number_format((int) ($order->tax_amount ?? 0), 0, ',', '.'),
            '• Grand Total: Rp' . number_format((int) ($order->grand_total ?? $order->total ?? 0), 0, ',', '.'),
            'Status: ' . strtoupper((string) ($order->status ?? 'pending')),
            "Bengkel: {$workshopName}",
        ]);

        if ($note) {
            $lines[] = '';
            $lines[] = 'Catatan:';
            $lines[] = $note;
        }

        return implode("\n", $lines);
    }

    public function buildAppointmentReminder(Appointment $appointment, ?string $note = null): string
    {
        $customerName = $appointment->customer?->name ?? 'Pelanggan';
        $vehiclePlate = $appointment->vehicle?->plate_number ?? '-';
        $mechanicName = $appointment->mechanic?->name ?? '-';
        $workshopName = (string) config('app.name');
        $scheduledAt = $appointment->scheduled_at instanceof CarbonInterface
            ? $appointment->scheduled_at->timezone(config('app.timezone'))->format('d-m-Y H:i')
            : ($appointment->scheduled_at ? Carbon::parse($appointment->scheduled_at)->timezone(config('app.timezone'))->format('d-m-Y H:i') : '-');

        $lines = [
            "Halo {$customerName},",
            'Ini pengingat jadwal servis Anda.',
            "Jadwal: {$scheduledAt}",
            "Plat Kendaraan: {$vehiclePlate}",
            "Mekanik: {$mechanicName}",
            "Bengkel: {$workshopName}",
        ];

        if ($note) {
            $lines[] = '';
            $lines[] = 'Catatan:';
            $lines[] = $note;
        }

        $lines[] = 'Silakan datang tepat waktu agar pelayanan berjalan lancar.';

        return implode("\n", $lines);
    }

    public function buildPartSaleReadyMessage(PartSale $sale, ?string $note = null): string
    {
        $customerName = $sale->customer?->name ?? 'Pelanggan';
        $workshopName = (string) config('app.name');
        $grandTotal = (int) ($sale->grand_total ?? 0);
        $paidAmount = (int) ($sale->paid_amount ?? 0);
        $remainingAmount = (int) ($sale->remaining_amount ?? max(0, $grandTotal - $paidAmount));

        $details = $sale->details->map(function ($detail) {
            $itemName = $detail->part?->name ?? '-';
            $qty = max(1, (int) ($detail->quantity ?? 1));
            $subtotal = (int) ($detail->final_amount ?? $detail->subtotal ?? 0);

            return sprintf(
                '- %s x%d = Rp%s',
                $itemName,
                $qty,
                number_format($subtotal, 0, ',', '.')
            );
        })->implode("\n");

        $lines = [
            "Halo {$customerName},",
            '',
            'Kabar baik, pesanan sparepart Anda sudah datang dan siap diambil.',
            '',
            "No. Penjualan: {$sale->sale_number}",
        ];

        if ($details !== '') {
            $lines[] = 'Rincian pesanan:';
            $lines[] = $details;
        }

        $lines[] = '';
        $lines[] = 'Total: Rp' . number_format($grandTotal, 0, ',', '.');
        $lines[] = 'Sudah dibayar: Rp' . number_format($paidAmount, 0, ',', '.');

        if ($remainingAmount > 0) {
            $lines[] = 'Sisa pembayaran: Rp' . number_format($remainingAmount, 0, ',', '.');
        } else {
            $lines[] = 'Status pembayaran: LUNAS';
        }

        $lines[] = '';
        $lines[] = 'Silakan datang ke bengkel untuk mengambil pesanan Anda. Tunjukkan nomor penjualan di atas saat pengambilan.';
        $lines[] = '';
        $lines[] = "Bengkel: {$workshopName}";

        if ($note) {
            $lines[] = '';
            $lines[] = 'Catatan:';
            $lines[] = $note;
        }

        return implode("\n", $lines);
    }

    public function buildPromoMessage(string $headline, string $body, ?string $note = null): string
    {
        $lines = [
            'Halo Pelanggan,',
            $headline,
            '',
            $body,
        ];

        if ($note) {
            $lines[] = '';
            $lines[] = $note;
        }

        $lines[] = '';
        $lines[] = (string) config('app.name');

        return implode("\n", $lines);
    }
}
