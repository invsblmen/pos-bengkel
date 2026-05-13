<?php

namespace App\Http\Controllers\Apps;

use App\Http\Controllers\Concerns\RespondsWithJsonOrRedirect;
use App\Http\Controllers\Controller;
use App\Models\Appointment;
use App\Models\Customer;
use App\Models\WhatsAppOutboundMessage;
use App\Services\WhatsAppMessageService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;

class WhatsAppMessageController extends Controller
{
    use RespondsWithJsonOrRedirect;

    public function index()
    {
        $customers = Customer::query()
            ->where('phone', '!=', '')
            ->orderBy('name')
            ->get(['id', 'name', 'phone']);

        $appointments = Appointment::query()
            ->with(['customer:id,name,phone', 'vehicle:id,plate_number', 'mechanic:id,name'])
            ->whereIn('status', ['scheduled', 'confirmed'])
            ->whereDate('scheduled_at', '>=', now()->toDateString())
            ->whereDate('scheduled_at', '<=', now()->addDays(7)->toDateString())
            ->orderBy('scheduled_at')
            ->get();

        return Inertia::render('Dashboard/WhatsApp/Manage', [
            'summary' => [
                'customers' => $customers->count(),
                'appointments' => $appointments->count(),
                'outbound_total' => WhatsAppOutboundMessage::query()->get()->count(),
                'outbound_queued' => WhatsAppOutboundMessage::query()->where('status', 'queued')->get()->count(),
                'outbound_sent' => WhatsAppOutboundMessage::query()->where('status', 'sent')->get()->count(),
                'outbound_failed' => WhatsAppOutboundMessage::query()->where('status', 'failed')->get()->count(),
            ],
            'customers' => $customers,
            'appointments' => $appointments,
        ]);
    }

    public function sendReminder(Appointment $appointment, WhatsAppMessageService $whatsAppMessageService)
    {
        $appointment->load(['customer', 'vehicle', 'mechanic']);

        $outbound = $whatsAppMessageService->sendAppointmentReminder($appointment);

        if (!$outbound) {
            throw ValidationException::withMessages([
                'phone' => 'Pelanggan tidak memiliki nomor WhatsApp yang valid.',
            ]);
        }

        return $this->jsonOrRedirect('whatsapp.messages.index', [], 'Reminder servis berhasil di-queue ke WhatsApp pelanggan.');
    }

    public function broadcast(Request $request, WhatsAppMessageService $whatsAppMessageService)
    {
        $validated = $request->validate([
            'recipient_mode' => 'required|in:selected,all',
            'customer_ids' => 'nullable|array',
            'customer_ids.*' => 'integer|exists:customers,id',
            'headline' => 'required|string|max:255',
            'body' => 'required|string|max:4000',
            'note' => 'nullable|string|max:1000',
        ]);

        $customers = Customer::query()
            ->where('phone', '!=', '');

        if ($validated['recipient_mode'] === 'selected') {
            $customerIds = $validated['customer_ids'] ?? [];

            if (empty($customerIds)) {
                throw ValidationException::withMessages([
                    'customer_ids' => 'Pilih minimal satu pelanggan untuk broadcast promo.',
                ]);
            }

            $customers = $customers->whereIn('id', $customerIds);
        }

        $customerCollection = $customers->orderBy('name')->get(['id', 'name', 'phone']);

        if ($customerCollection->isEmpty()) {
            throw ValidationException::withMessages([
                'customer_ids' => 'Tidak ada pelanggan dengan nomor WhatsApp yang valid.',
            ]);
        }

        $message = $whatsAppMessageService->buildPromoMessage(
            $validated['headline'],
            $validated['body'],
            $validated['note'] ?? null
        );

        $queued = 0;
        $skipped = 0;
        foreach ($customerCollection as $customer) {
            try {
                $outbound = $whatsAppMessageService->queueCustomerMessage(
                    $customer,
                    $message,
                    'whatsapp.promo'
                );

                if ($outbound) {
                    $queued++;
                }
            } catch (\Illuminate\Validation\ValidationException $e) {
                $skipped++;
                continue;
            }
        }

        return $this->jsonOrRedirect('whatsapp.messages.index', [], "Broadcast promo berhasil di-queue ke {$queued} pelanggan" . ($skipped > 0 ? " dan {$skipped} nomor dilewati karena bukan WhatsApp." : "."));
    }
}
