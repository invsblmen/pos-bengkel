<?php

namespace App\Http\Controllers\Apps;

use App\Events\AppointmentCreated;
use App\Events\AppointmentDeleted;
use App\Events\AppointmentUpdated;
use App\Http\Controllers\Controller;
use App\Models\Appointment;
use App\Models\Mechanic;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;

class AppointmentController extends Controller
{
    /**
     * Display appointments list view
     */
    public function index(Request $request)
    {
        $query = Appointment::with('customer', 'vehicle', 'mechanic');

        // Filter by status
        if ($request->status && $request->status !== 'all') {
            $query->where('status', $request->status);
        }

        // Filter by mechanic
        if ($request->mechanic_id && $request->mechanic_id !== 'all') {
            $query->where('mechanic_id', $request->mechanic_id);
        }

        // Filter by date range
        if ($request->date_from) {
            $query->whereDate('scheduled_at', '>=', $request->date_from);
        }
        if ($request->date_to) {
            $query->whereDate('scheduled_at', '<=', $request->date_to);
        }

        // Search
        if ($request->search) {
            $query->where(function($q) use ($request) {
                $q->whereHas('customer', function($q) use ($request) {
                    $q->where('name', 'like', '%' . $request->search . '%')
                      ->orWhere('phone', 'like', '%' . $request->search . '%');
                })
                ->orWhereHas('vehicle', function($q) use ($request) {
                    $q->where('plate_number', 'like', '%' . $request->search . '%');
                });
            });
        }

        $appointments = $query
            ->orderBy('scheduled_at')
            ->paginate(20)
            ->withQueryString()
            ->through(function ($apt) {
                return [
                    'id' => $apt->id,
                    'status' => $apt->status,
                    'customer' => $apt->customer ? [
                        'id' => $apt->customer->id,
                        'name' => $apt->customer->name,
                        'phone' => $apt->customer->phone,
                    ] : null,
                    'vehicle' => $apt->vehicle ? [
                        'id' => $apt->vehicle->id,
                        'plate_number' => $apt->vehicle->plate_number,
                        'brand' => $apt->vehicle->brand,
                        'model' => $apt->vehicle->model,
                    ] : null,
                    'mechanic' => $apt->mechanic ? [
                        'id' => $apt->mechanic->id,
                        'name' => $apt->mechanic->name,
                        'specialty' => $apt->mechanic->specialty,
                    ] : null,
                    'mechanic_id' => $apt->mechanic_id,
                    'scheduled_at' => $apt->scheduled_at ? $apt->scheduled_at->format('Y-m-d H:i:s') : null,
                    'notes' => $apt->notes,
                ];
            });

        // Stats
        $stats = [
            'scheduled' => Appointment::where('status', 'scheduled')->count(),
            'confirmed' => Appointment::where('status', 'confirmed')->count(),
            'completed' => Appointment::where('status', 'completed')->count(),
            'cancelled' => Appointment::where('status', 'cancelled')->count(),
            'today' => Appointment::whereDate('scheduled_at', today())->count(),
        ];

        $payload = [
            'appointments' => $appointments,
            'stats' => $stats,
            'mechanics' => Mechanic::all(['id', 'name']),
            'filters' => $request->only(['search', 'status', 'date_from', 'date_to', 'mechanic_id']),
        ];

        return inertia('Dashboard/Appointments/Index', $payload);
    }

    /**
     * Display calendar view
     */
    public function calendar(Request $request)
    {
        $currentYear = now()->year;
        $currentMonth = now()->month;

        $yearInput = (int) $request->query('year', $currentYear);
        $monthInput = (int) $request->query('month', $currentMonth);

        if ($yearInput < 1970 || $yearInput > 9999) {
            $yearInput = $currentYear;
        }

        if ($monthInput === 0) {
            $monthInput = $currentMonth;
        }

        // Normalize overflow/underflow months (e.g. 21 => Sep next year, 0 => Dec previous year).
        $totalMonths = ($yearInput * 12) + ($monthInput - 1);
        $year = (int) floor($totalMonths / 12);
        $month = (($totalMonths % 12) + 12) % 12 + 1;

        if ($year < 1970 || $year > 9999) {
            $year = $currentYear;
            $month = $currentMonth;
        }

        $startDate = Carbon::createFromDate($year, $month, 1);
        $endDate = $startDate->clone()->endOfMonth();

        $appointments = Appointment::with('customer', 'vehicle', 'mechanic')
            ->whereBetween('scheduled_at', [$startDate, $endDate])
            ->get()
            ->groupBy(function ($appointment) {
                return $appointment->scheduled_at->format('Y-m-d');
            });

        // Get mechanics for filter
        $mechanics = Mechanic::all();

        // Calculate calendar data
        $calendarDays = [];
        $dayOfWeek = $startDate->dayOfWeek;

        // Add empty days for days before month starts
        for ($i = 0; $i < $dayOfWeek; $i++) {
            $calendarDays[] = null;
        }

        // Add days of the month
        while ($startDate <= $endDate) {
            $dateStr = $startDate->format('Y-m-d');
            $calendarDays[] = [
                'date' => $dateStr, // Send as string to avoid serialization issues
                'day_num' => $startDate->day,
                'appointments' => $appointments->get($dateStr, collect())->map(function ($apt) {
                    return [
                        'id' => $apt->id,
                        'status' => $apt->status,
                        'customer' => $apt->customer ? ['name' => $apt->customer->name] : null,
                        'mechanic' => $apt->mechanic ? ['id' => $apt->mechanic->id, 'name' => $apt->mechanic->name] : null,
                        'mechanic_id' => $apt->mechanic_id,
                        'scheduled_at' => $apt->scheduled_at->format('Y-m-d H:i:s'),
                    ];
                })->toArray(),
            ];
            $startDate->addDay();
        }

        $payload = [
            'calendar_days' => $calendarDays,
            'current_date' => now(),
            'year' => $year,
            'month' => $month,
            'mechanics' => $mechanics,
            'csrf_token' => csrf_token(),
        ];

        return inertia('Dashboard/Appointments/Calendar', $payload);
    }

    /**
     * Show available time slots for a mechanic on a specific date
     */
    public function getAvailableSlots(Request $request)
    {
        $request->validate([
            'mechanic_id' => 'required|exists:mechanics,id',
            'date' => 'required|date',
        ]);

        $mechanic = Mechanic::findOrFail($request->mechanic_id);
        $date = Carbon::parse($request->date);

        // Define working hours (9 AM to 5 PM)
        $workStart = 9;
        $workEnd = 17;
        $slotDuration = 2; // 2 hour slots

        $availableSlots = [];
        $existingAppointments = Appointment::where('mechanic_id', $mechanic->id)
            ->whereDate('scheduled_at', $date)
            ->get();

        for ($hour = $workStart; $hour < $workEnd; $hour += $slotDuration) {
            $slotStart = $date->clone()->setHour($hour)->setMinute(0);
            $slotEnd = $slotStart->clone()->addHours($slotDuration);

            // Check if slot is available
            $isBooked = $existingAppointments->some(function ($appointment) use ($slotStart, $slotEnd) {
                $appointmentStart = Carbon::parse($appointment->scheduled_at);
                $appointmentEnd = $appointmentStart->clone()->addHours(2);

                return !($slotEnd <= $appointmentStart || $slotStart >= $appointmentEnd);
            });

            if (!$isBooked) {
                $availableSlots[] = [
                    'time' => $slotStart->format('H:i'),
                    'display' => $slotStart->format('H:i') . ' - ' . $slotEnd->format('H:i'),
                    'timestamp' => $slotStart->format('Y-m-d H:i:s'),
                ];
            }
        }

        $payload = [
            'available_slots' => $availableSlots,
            'mechanic_name' => $mechanic->name,
        ];

        return response()->json($payload);
    }

    /**
     * Store appointment with time slot
     */
    public function store(Request $request)
    {
        $request->validate([
            'customer_id' => 'nullable|exists:customers,id',
            'vehicle_id' => 'nullable|exists:vehicles,id',
            'mechanic_id' => 'required|exists:mechanics,id',
            'scheduled_at' => 'required|date',
            'notes' => 'nullable|string',
        ]);

        // Check if slot is available
        $existingAppointment = Appointment::where('mechanic_id', $request->mechanic_id)
            ->where('scheduled_at', $request->scheduled_at)
            ->first();

        if ($existingAppointment) {
            return back()->withErrors(['scheduled_at' => 'Slot ini sudah dibooking.']);
        }

        // Parse scheduled_at in app timezone (Asia/Jakarta)
        $scheduledAt = \Carbon\Carbon::parse($request->scheduled_at, config('app.timezone'));

        $appointment = Appointment::create([
            'customer_id' => $request->customer_id,
            'vehicle_id' => $request->vehicle_id,
            'mechanic_id' => $request->mechanic_id,
            'scheduled_at' => $scheduledAt,
            'status' => 'scheduled',
            'notes' => $request->notes,
        ]);

        try {
            $broadcast = broadcast(new AppointmentCreated($appointment->toArray()));
            unset($broadcast);
        } catch (\Throwable $e) {
            Log::warning('AppointmentCreated broadcast failed after local store', [
                'message' => $e->getMessage(),
            ]);
        }

        return redirect()->route('appointments.calendar')->with('success', 'Appointment berhasil dijadwalkan.');
    }

    /**
     * Update appointment status
     */
    public function updateStatus(Request $request, $id)
    {
        $request->validate(['status' => 'required|in:scheduled,confirmed,cancelled,completed']);

        $appointment = Appointment::findOrFail($id);
        $appointment->status = $request->status;
        $appointment->save();

        return back()->with('success', 'Appointment updated.');
    }

    /**
     * Show edit form for appointment
     */
    public function edit($id)
    {
        $appointment = Appointment::with('customer', 'vehicle', 'mechanic')->findOrFail($id);
        // Normalize datetime to string to avoid timezone serialization issues
        $appointmentPayload = $appointment->toArray();
        $appointmentPayload['scheduled_at'] = $appointment->scheduled_at
            ? $appointment->scheduled_at->format('Y-m-d H:i:s')
            : null;
        $mechanics = Mechanic::all();

        return inertia('Dashboard/Appointments/Edit', [
            'appointment' => $appointmentPayload,
            'mechanics' => $mechanics,
        ]);
    }

    /**
     * Update appointment
     */
    public function update(Request $request, $id)
    {
        $appointment = Appointment::findOrFail($id);

        $request->validate([
            'customer_id' => 'nullable|exists:customers,id',
            'vehicle_id' => 'nullable|exists:vehicles,id',
            'mechanic_id' => 'required|exists:mechanics,id',
            'scheduled_at' => 'required|date',
            'notes' => 'nullable|string',
        ]);

        // Check if new slot is available (if mechanic or time changed)
        if ($appointment->mechanic_id != $request->mechanic_id || $appointment->scheduled_at->format('Y-m-d H:i') != (new \DateTime($request->scheduled_at))->format('Y-m-d H:i')) {
            $existingAppointment = Appointment::where('mechanic_id', $request->mechanic_id)
                ->where('scheduled_at', $request->scheduled_at)
                ->where('id', '!=', $id)
                ->first();

            if ($existingAppointment) {
                return back()->withErrors(['scheduled_at' => 'Slot ini sudah dibooking mekanik lain.']);
            }
        }

        // Parse scheduled_at in app timezone (Asia/Jakarta)
        $scheduledAt = \Carbon\Carbon::parse($request->scheduled_at, config('app.timezone'));

        $appointment->update([
            'customer_id' => $request->customer_id,
            'vehicle_id' => $request->vehicle_id,
            'mechanic_id' => $request->mechanic_id,
            'scheduled_at' => $scheduledAt,
            'notes' => $request->notes,
        ]);

        broadcast(new AppointmentUpdated($appointment->fresh()->toArray()));

        return redirect()->route('appointments.calendar')->with('success', 'Appointment berhasil diperbarui.');
    }

    /**
     * Delete appointment
     */
    public function destroy($id)
    {
        $appointment = Appointment::findOrFail($id);
        $appointmentId = $appointment->id;
        $appointment->delete();

        try {
            $broadcast = broadcast(new AppointmentDeleted($appointmentId));
            unset($broadcast);
        } catch (\Throwable $e) {
            Log::warning('AppointmentDeleted broadcast failed after local delete', [
                'message' => $e->getMessage(),
            ]);
        }

        return back()->with('success', 'Appointment cancelled.');
    }

    /**
     * Export appointments to ICS format
     */
    public function exportIcs($id)
    {
        $appointment = Appointment::with('customer', 'vehicle', 'mechanic')->findOrFail($id);

        $ics = "BEGIN:VCALENDAR\r\n";
        $ics .= "VERSION:2.0\r\n";
        $ics .= "PRODID:-//POS Bengkel//Calendar//EN\r\n";
        $ics .= "CALSCALE:GREGORIAN\r\n";
        $ics .= "BEGIN:VEVENT\r\n";
        $ics .= "UID:" . $appointment->id . "@pos-bengkel.local\r\n";
        $ics .= "DTSTAMP:" . now()->format('Ymd\THis\Z') . "\r\n";
        $ics .= "DTSTART:" . $appointment->scheduled_at->format('Ymd\THis') . "\r\n";
        $ics .= "DTEND:" . $appointment->scheduled_at->clone()->addHours(2)->format('Ymd\THis') . "\r\n";
        $ics .= "SUMMARY:Service Appointment - " . ($appointment->customer->name ?? 'No Customer') . "\r\n";
        $ics .= "DESCRIPTION:" . ($appointment->notes ?? '') . "\r\n";
        $ics .= "LOCATION:" . ($appointment->vehicle->plate_number ?? '') . "\r\n";
        $ics .= "ORGANIZER;CN=" . ($appointment->mechanic->name ?? '') . ":mailto:info@pos-bengkel.local\r\n";
        $ics .= "STATUS:CONFIRMED\r\n";
        $ics .= "END:VEVENT\r\n";
        $ics .= "END:VCALENDAR\r\n";

        return response($ics, 200)
            ->header('Content-Type', 'text/calendar')
            ->header('Content-Disposition', 'attachment; filename="appointment_' . $appointment->id . '.ics"');
    }

}
