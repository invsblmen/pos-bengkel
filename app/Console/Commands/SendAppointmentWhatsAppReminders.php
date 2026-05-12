<?php

namespace App\Console\Commands;

use App\Models\Appointment;
use App\Models\WhatsAppOutboundMessage;
use App\Services\WhatsAppMessageService;
use Carbon\Carbon;
use Illuminate\Console\Command;

class SendAppointmentWhatsAppReminders extends Command
{
    protected $signature = 'whatsapp:send-appointment-reminders {--days=1 : How many days ahead to scan for upcoming appointments} {--limit=100 : Maximum reminders to queue in one run}';

    protected $description = 'Queue WhatsApp reminders for upcoming appointments';

    public function handle(WhatsAppMessageService $whatsAppMessageService): int
    {
        if (!config('whatsapp.enabled')) {
            $this->warn('WhatsApp integration is disabled.');
            return self::SUCCESS;
        }

        $daysAhead = max(1, (int) $this->option('days'));
        $limit = max(1, (int) $this->option('limit'));
        $now = Carbon::now();
        $end = $now->copy()->addDays($daysAhead)->endOfDay();

        $appointments = Appointment::query()
            ->with(['customer', 'vehicle', 'mechanic'])
            ->whereIn('status', ['scheduled', 'confirmed'])
            ->whereBetween('scheduled_at', [$now, $end])
            ->whereHas('customer', function ($query) {
                $query->where('phone', '!=', '');
            })
            ->orderBy('scheduled_at')
            ->limit($limit)
            ->get();

        $queued = 0;
        $skipped = 0;

        foreach ($appointments as $appointment) {
            $alreadyQueued = WhatsAppOutboundMessage::query()
                ->where('event_type', 'appointment.reminder')
                ->where('related_type', 'appointment')
                ->where('related_id', $appointment->id)
                ->whereIn('status', ['queued', 'sent'])
                ->exists();

            if ($alreadyQueued) {
                $skipped++;
                continue;
            }

            $outbound = $whatsAppMessageService->sendAppointmentReminder($appointment, 'Pengingat otomatis dari scheduler harian.');

            if ($outbound) {
                $queued++;
                $this->line(sprintf('Queued reminder for appointment #%d (%s)', $appointment->id, $appointment->customer?->name ?? '-'));
            } else {
                $skipped++;
            }
        }

        $this->info(sprintf('Appointment reminder scan complete. queued=%d skipped=%d scanned=%d', $queued, $skipped, $appointments->count()));

        return self::SUCCESS;
    }
}
