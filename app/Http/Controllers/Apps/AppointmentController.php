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
        if ((bool) config('go_backend.features.appointment_index', false)) {
            $proxied = $this->appointmentIndexViaGo($request);
            if ($proxied !== null) {
                if ($request->expectsJson() || $request->wantsJson()) {
                    return response()->json($proxied);
                }

                return inertia('Dashboard/Appointments/Index', $proxied);
            }
        }

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

        return inertia('Dashboard/Appointments/Index', [
            'appointments' => $appointments,
            'stats' => $stats,
            'mechanics' => Mechanic::all(['id', 'name']),
            'filters' => $request->only(['search', 'status', 'date_from', 'date_to', 'mechanic_id']),
        ]);
    }

    private function appointmentIndexViaGo(Request $request): ?array
    {
        $baseUrl = rtrim((string) config('go_backend.base_url', 'http://127.0.0.1:8081'), '/');
        $timeout = (int) config('go_backend.timeout_seconds', 5);
        $requestId = (string) ($request->header('X-Request-Id') ?: Str::uuid());

        try {
            $response = Http::timeout($timeout)
                ->acceptJson()
                ->withHeaders([
                    'X-Request-Id' => $requestId,
                ])
                ->get($baseUrl . '/api/v1/appointments', $request->query());

            $json = $response->json();
            if (! $response->successful() || ! is_array($json)) {
                Log::warning('Appointment index Go bridge returned an invalid response', [
                    'status' => $response->status(),
                ]);

                return null;
            }

            if (! isset($json['appointments'], $json['stats'], $json['mechanics'], $json['filters'])) {
                Log::warning('Appointment index Go bridge response is missing expected keys', [
                    'keys' => array_keys($json),
                ]);

                return null;
            }

            return $json;
        } catch (\Throwable $e) {
            Log::warning('Appointment index Go bridge failed and fallback will be used', [
                'message' => $e->getMessage(),
            ]);

            return null;
        }
    }

    /**
     * Display calendar view
     */
    public function calendar(Request $request)
    {
        if ((bool) config('go_backend.features.appointment_calendar', false)) {
            $proxied = $this->appointmentCalendarViaGo($request);
            if ($proxied !== null) {
                $proxied['csrf_token'] = $proxied['csrf_token'] ?? csrf_token();

                if ($request->expectsJson() || $request->wantsJson()) {
                    return response()->json($proxied);
                }

                return inertia('Dashboard/Appointments/Calendar', $proxied);
            }
        }

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

        return inertia('Dashboard/Appointments/Calendar', [
            'calendar_days' => $calendarDays,
            'current_date' => now(),
            'year' => $year,
            'month' => $month,
            'mechanics' => $mechanics,
            'csrf_token' => csrf_token(),
        ]);
    }

    private function appointmentCalendarViaGo(Request $request): ?array
    {
        $baseUrl = rtrim((string) config('go_backend.base_url', 'http://127.0.0.1:8081'), '/');
        $timeout = (int) config('go_backend.timeout_seconds', 5);
        $requestId = (string) ($request->header('X-Request-Id') ?: Str::uuid());

        try {
            $response = Http::timeout($timeout)
                ->acceptJson()
                ->withHeaders([
                    'X-Request-Id' => $requestId,
                ])
                ->get($baseUrl . '/api/v1/appointments/calendar', $request->query());

            $json = $response->json();
            if (! $response->successful() || ! is_array($json)) {
                Log::warning('Appointment calendar Go bridge returned an invalid response', [
                    'status' => $response->status(),
                ]);

                return null;
            }

            if (! isset($json['calendar_days'], $json['current_date'], $json['year'], $json['month'], $json['mechanics'])) {
                Log::warning('Appointment calendar Go bridge response is missing expected keys', [
                    'keys' => array_keys($json),
                ]);

                return null;
            }

            return $json;
        } catch (\Throwable $e) {
            Log::warning('Appointment calendar Go bridge failed and fallback will be used', [
                'message' => $e->getMessage(),
            ]);

            return null;
        }
    }

    /**
     * Show available time slots for a mechanic on a specific date
     */
    public function getAvailableSlots(Request $request)
    {
        if ((bool) config('go_backend.features.appointment_slots', false)) {
            $proxied = $this->appointmentAvailableSlotsViaGo($request);
            if ($proxied !== null) {
                return response()->json($proxied);
            }
        }

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

        return response()->json([
            'available_slots' => $availableSlots,
            'mechanic_name' => $mechanic->name,
        ]);
    }

    private function appointmentAvailableSlotsViaGo(Request $request): ?array
    {
        $validated = $request->validate([
            'mechanic_id' => 'required|exists:mechanics,id',
            'date' => 'required|date',
        ]);

        $baseUrl = rtrim((string) config('go_backend.base_url', 'http://127.0.0.1:8081'), '/');
        $timeout = (int) config('go_backend.timeout_seconds', 5);
        $requestId = (string) ($request->header('X-Request-Id') ?: Str::uuid());

        try {
            $response = Http::timeout($timeout)
                ->acceptJson()
                ->withHeaders([
                    'X-Request-Id' => $requestId,
                ])
                ->get($baseUrl . '/api/v1/appointments/slots', $validated);

            $json = $response->json();
            if (! $response->successful() || ! is_array($json)) {
                Log::warning('Appointment slots Go bridge returned an invalid response', [
                    'status' => $response->status(),
                ]);

                return null;
            }

            if (! isset($json['available_slots'], $json['mechanic_name'])) {
                Log::warning('Appointment slots Go bridge response is missing expected keys', [
                    'keys' => array_keys($json),
                ]);

                return null;
            }

            return $json;
        } catch (\Throwable $e) {
            Log::warning('Appointment slots Go bridge failed and fallback will be used', [
                'message' => $e->getMessage(),
            ]);

            return null;
        }
    }

    /**
     * Store appointment with time slot
     */
    public function store(Request $request)
    {
        if ((bool) config('go_backend.features.appointment_store', false)) {
            $proxied = $this->appointmentStoreViaGo($request);
            if ($proxied !== null) {
                if ($proxied['status'] === 'validation_error') {
                    return back()->withErrors($proxied['errors'] ?? ['scheduled_at' => 'Gagal membuat appointment.']);
                }

                if ($proxied['status'] === 'conflict') {
                    return back()->withErrors(['scheduled_at' => $proxied['message'] ?? 'Slot ini sudah dibooking.']);
                }

                if (! empty($proxied['appointment'])) {
                    try {
                        $broadcast = broadcast(new AppointmentCreated($proxied['appointment']));
                        unset($broadcast);
                    } catch (\Throwable $e) {
                        Log::warning('AppointmentCreated broadcast failed after Go proxy store', [
                            'message' => $e->getMessage(),
                        ]);
                    }
                }

                if ($request->expectsJson()) {
                    return response()->json([
                        'success' => true,
                        'message' => $proxied['message'] ?? 'Appointment berhasil dijadwalkan.',
                        'appointment' => $proxied['appointment'] ?? null,
                    ]);
                }

                return redirect()->route('appointments.calendar')->with('success', $proxied['message'] ?? 'Appointment berhasil dijadwalkan.');
            }
        }

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

    private function appointmentStoreViaGo(Request $request): ?array
    {
        $validated = $request->validate([
            'customer_id' => 'nullable|exists:customers,id',
            'vehicle_id' => 'nullable|exists:vehicles,id',
            'mechanic_id' => 'required|exists:mechanics,id',
            'scheduled_at' => 'required|date',
            'notes' => 'nullable|string',
        ]);

        $baseUrl = rtrim((string) config('go_backend.base_url', 'http://127.0.0.1:8081'), '/');
        $timeout = (int) config('go_backend.timeout_seconds', 5);
        $requestId = (string) ($request->header('X-Request-Id') ?: Str::uuid());

        try {
            $response = Http::timeout($timeout)
                ->acceptJson()
                ->withHeaders([
                    'X-Request-Id' => $requestId,
                ])
                ->post($baseUrl . '/api/v1/appointments', $validated);

            $json = $response->json();
            if (! is_array($json)) {
                Log::warning('Appointment store Go bridge returned a non-array response', [
                    'status' => $response->status(),
                ]);

                return null;
            }

            if ($response->status() === 409) {
                return [
                    'status' => 'conflict',
                    'message' => $json['message'] ?? 'Slot ini sudah dibooking.',
                ];
            }

            if ($response->status() === 422) {
                return [
                    'status' => 'validation_error',
                    'message' => $json['message'] ?? 'Data appointment tidak valid.',
                    'errors' => $json['errors'] ?? [],
                ];
            }

            if (! $response->successful() || ! isset($json['appointment'])) {
                Log::warning('Appointment store Go bridge returned an invalid response', [
                    'status' => $response->status(),
                    'keys' => array_keys($json),
                ]);

                return null;
            }

            return [
                'status' => 'ok',
                'message' => $json['message'] ?? 'Appointment berhasil dijadwalkan.',
                'appointment' => $json['appointment'],
            ];
        } catch (\Throwable $e) {
            Log::warning('Appointment store Go bridge failed and fallback will be used', [
                'message' => $e->getMessage(),
            ]);

            return null;
        }
    }

    /**
     * Update appointment status
     */
    public function updateStatus(Request $request, $id)
    {
        if ((bool) config('go_backend.features.appointment_update_status', false)) {
            $proxied = $this->appointmentUpdateStatusViaGo($request, (string) $id);
            if ($proxied !== null) {
                if ($proxied['status'] === 'validation_error') {
                    return back()->withErrors($proxied['errors'] ?? ['status' => 'Status tidak valid.']);
                }

                if ($proxied['status'] === 'not_found') {
                    abort(404);
                }

                if ($request->expectsJson()) {
                    return response()->json([
                        'success' => true,
                        'message' => $proxied['message'] ?? 'Appointment updated.',
                    ]);
                }

                return back()->with('success', $proxied['message'] ?? 'Appointment updated.');
            }
        }

        $request->validate(['status' => 'required|in:scheduled,confirmed,cancelled,completed']);

        $appointment = Appointment::findOrFail($id);
        $appointment->status = $request->status;
        $appointment->save();

        return back()->with('success', 'Appointment updated.');
    }

    private function appointmentUpdateStatusViaGo(Request $request, string $appointmentId): ?array
    {
        $validated = $request->validate(['status' => 'required|in:scheduled,confirmed,cancelled,completed']);

        $baseUrl = rtrim((string) config('go_backend.base_url', 'http://127.0.0.1:8081'), '/');
        $timeout = (int) config('go_backend.timeout_seconds', 5);
        $requestId = (string) ($request->header('X-Request-Id') ?: Str::uuid());

        try {
            $response = Http::timeout($timeout)
                ->acceptJson()
                ->withHeaders([
                    'X-Request-Id' => $requestId,
                ])
                ->patch($baseUrl . '/api/v1/appointments/' . urlencode($appointmentId) . '/status', $validated);

            $json = $response->json();
            if (! is_array($json)) {
                Log::warning('Appointment status Go bridge returned a non-array response', [
                    'status' => $response->status(),
                ]);

                return null;
            }

            if ($response->status() === 404) {
                return [
                    'status' => 'not_found',
                    'message' => $json['message'] ?? 'Appointment not found.',
                ];
            }

            if ($response->status() === 422) {
                return [
                    'status' => 'validation_error',
                    'message' => $json['message'] ?? 'Status tidak valid.',
                    'errors' => $json['errors'] ?? [],
                ];
            }

            if (! $response->successful()) {
                Log::warning('Appointment status Go bridge returned an invalid response', [
                    'status' => $response->status(),
                ]);

                return null;
            }

            return [
                'status' => 'ok',
                'message' => $json['message'] ?? 'Appointment updated.',
            ];
        } catch (\Throwable $e) {
            Log::warning('Appointment status Go bridge failed and fallback will be used', [
                'message' => $e->getMessage(),
            ]);

            return null;
        }
    }

    /**
     * Show edit form for appointment
     */
    public function edit($id)
    {
        if ((bool) config('go_backend.features.appointment_edit', false)) {
            $proxied = $this->appointmentEditViaGo((string) $id, request());
            if ($proxied !== null) {
                if ($proxied['status'] === 'not_found') {
                    abort(404);
                }

                if (request()->expectsJson() || request()->wantsJson()) {
                    return response()->json($proxied);
                }

                return inertia('Dashboard/Appointments/Edit', [
                    'appointment' => $proxied['appointment'],
                    'mechanics' => $proxied['mechanics'],
                ]);
            }
        }

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

    private function appointmentEditViaGo(string $appointmentId, Request $request): ?array
    {
        $baseUrl = rtrim((string) config('go_backend.base_url', 'http://127.0.0.1:8081'), '/');
        $timeout = (int) config('go_backend.timeout_seconds', 5);
        $requestId = (string) ($request->header('X-Request-Id') ?: Str::uuid());

        try {
            $response = Http::timeout($timeout)
                ->acceptJson()
                ->withHeaders([
                    'X-Request-Id' => $requestId,
                ])
                ->get($baseUrl . '/api/v1/appointments/' . urlencode($appointmentId));

            $json = $response->json();
            if (! is_array($json)) {
                Log::warning('Appointment edit Go bridge returned a non-array response', [
                    'status' => $response->status(),
                ]);

                return null;
            }

            if ($response->status() === 404) {
                return [
                    'status' => 'not_found',
                    'message' => $json['message'] ?? 'Appointment not found.',
                ];
            }

            if (! $response->successful() || ! isset($json['appointment'], $json['mechanics'])) {
                Log::warning('Appointment edit Go bridge returned an invalid response', [
                    'status' => $response->status(),
                    'keys' => array_keys($json),
                ]);

                return null;
            }

            return [
                'status' => 'ok',
                'appointment' => $json['appointment'],
                'mechanics' => $json['mechanics'],
            ];
        } catch (\Throwable $e) {
            Log::warning('Appointment edit Go bridge failed and fallback will be used', [
                'message' => $e->getMessage(),
            ]);

            return null;
        }
    }

    /**
     * Update appointment
     */
    public function update(Request $request, $id)
    {
        if ((bool) config('go_backend.features.appointment_update', false)) {
            $proxied = $this->appointmentUpdateViaGo($request, (string) $id);
            if ($proxied !== null) {
                if ($proxied['status'] === 'validation_error') {
                    return back()->withErrors($proxied['errors'] ?? ['scheduled_at' => 'Gagal memperbarui appointment.']);
                }

                if ($proxied['status'] === 'conflict') {
                    return back()->withErrors(['scheduled_at' => $proxied['message'] ?? 'Slot ini sudah dibooking mekanik lain.']);
                }

                if ($proxied['status'] === 'not_found') {
                    abort(404);
                }

                if (! empty($proxied['appointment'])) {
                    try {
                        $broadcast = broadcast(new AppointmentUpdated($proxied['appointment']));
                        unset($broadcast);
                    } catch (\Throwable $e) {
                        Log::warning('AppointmentUpdated broadcast failed after Go proxy update', [
                            'message' => $e->getMessage(),
                        ]);
                    }
                }

                if ($request->expectsJson()) {
                    return response()->json([
                        'success' => true,
                        'message' => $proxied['message'] ?? 'Appointment berhasil diperbarui.',
                        'appointment' => $proxied['appointment'] ?? null,
                    ]);
                }

                return redirect()->route('appointments.calendar')->with('success', $proxied['message'] ?? 'Appointment berhasil diperbarui.');
            }
        }

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

    private function appointmentUpdateViaGo(Request $request, string $appointmentId): ?array
    {
        $validated = $request->validate([
            'customer_id' => 'nullable|exists:customers,id',
            'vehicle_id' => 'nullable|exists:vehicles,id',
            'mechanic_id' => 'required|exists:mechanics,id',
            'scheduled_at' => 'required|date',
            'notes' => 'nullable|string',
        ]);

        $baseUrl = rtrim((string) config('go_backend.base_url', 'http://127.0.0.1:8081'), '/');
        $timeout = (int) config('go_backend.timeout_seconds', 5);
        $requestId = (string) ($request->header('X-Request-Id') ?: Str::uuid());

        try {
            $response = Http::timeout($timeout)
                ->acceptJson()
                ->withHeaders([
                    'X-Request-Id' => $requestId,
                ])
                ->put($baseUrl . '/api/v1/appointments/' . urlencode($appointmentId), $validated);

            $json = $response->json();
            if (! is_array($json)) {
                Log::warning('Appointment update Go bridge returned a non-array response', [
                    'status' => $response->status(),
                ]);

                return null;
            }

            if ($response->status() === 404) {
                return [
                    'status' => 'not_found',
                    'message' => $json['message'] ?? 'Appointment not found.',
                ];
            }

            if ($response->status() === 409) {
                return [
                    'status' => 'conflict',
                    'message' => $json['message'] ?? 'Slot ini sudah dibooking mekanik lain.',
                    'errors' => $json['errors'] ?? [],
                ];
            }

            if ($response->status() === 422) {
                return [
                    'status' => 'validation_error',
                    'message' => $json['message'] ?? 'Data appointment tidak valid.',
                    'errors' => $json['errors'] ?? [],
                ];
            }

            if (! $response->successful() || ! isset($json['appointment'])) {
                Log::warning('Appointment update Go bridge returned an invalid response', [
                    'status' => $response->status(),
                    'keys' => array_keys($json),
                ]);

                return null;
            }

            return [
                'status' => 'ok',
                'message' => $json['message'] ?? 'Appointment berhasil diperbarui.',
                'appointment' => $json['appointment'],
            ];
        } catch (\Throwable $e) {
            Log::warning('Appointment update Go bridge failed and fallback will be used', [
                'message' => $e->getMessage(),
            ]);

            return null;
        }
    }

    /**
     * Delete appointment
     */
    public function destroy($id)
    {
        if ((bool) config('go_backend.features.appointment_destroy', false)) {
            $proxied = $this->appointmentDestroyViaGo(request(), (string) $id);
            if ($proxied !== null) {
                if ($proxied['status'] === 'not_found') {
                    abort(404);
                }

                if (request()->expectsJson()) {
                    return response()->json([
                        'success' => true,
                        'message' => $proxied['message'] ?? 'Appointment cancelled.',
                    ]);
                }

                return back()->with('success', $proxied['message'] ?? 'Appointment cancelled.');
            }
        }

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

    private function appointmentDestroyViaGo(Request $request, string $appointmentId): ?array
    {
        $baseUrl = rtrim((string) config('go_backend.base_url', 'http://127.0.0.1:8081'), '/');
        $timeout = (int) config('go_backend.timeout_seconds', 5);
        $requestId = (string) ($request->header('X-Request-Id') ?: Str::uuid());

        try {
            $response = Http::timeout($timeout)
                ->acceptJson()
                ->withHeaders([
                    'X-Request-Id' => $requestId,
                ])
                ->delete($baseUrl . '/api/v1/appointments/' . urlencode($appointmentId));

            $json = $response->json();
            if (! is_array($json)) {
                Log::warning('Appointment destroy Go bridge returned a non-array response', [
                    'status' => $response->status(),
                ]);

                return null;
            }

            if ($response->status() === 404) {
                return [
                    'status' => 'not_found',
                    'message' => $json['message'] ?? 'Appointment not found.',
                ];
            }

            if (! $response->successful()) {
                Log::warning('Appointment destroy Go bridge returned an invalid response', [
                    'status' => $response->status(),
                ]);

                return null;
            }

            return [
                'status' => 'ok',
                'message' => $json['message'] ?? 'Appointment cancelled.',
            ];
        } catch (\Throwable $e) {
            Log::warning('Appointment destroy Go bridge failed and fallback will be used', [
                'message' => $e->getMessage(),
            ]);

            return null;
        }
    }

    /**
     * Export appointments to ICS format
     */
    public function exportIcs($id)
    {
        if ((bool) config('go_backend.features.appointment_export', false)) {
            $proxied = $this->appointmentExportViaGo((string) $id, request());
            if ($proxied !== null) {
                if ($proxied['status'] === 'not_found') {
                    abort(404);
                }

                return response($proxied['body'], $proxied['status'])
                    ->header('Content-Type', $proxied['content_type'])
                    ->header('Content-Disposition', $proxied['content_disposition']);
            }
        }

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

    private function appointmentExportViaGo(string $appointmentId, Request $request): ?array
    {
        $baseUrl = rtrim((string) config('go_backend.base_url', 'http://127.0.0.1:8081'), '/');
        $timeout = (int) config('go_backend.timeout_seconds', 5);
        $requestId = (string) ($request->header('X-Request-Id') ?: Str::uuid());

        try {
            $response = Http::timeout($timeout)
                ->accept('text/calendar')
                ->withHeaders([
                    'X-Request-Id' => $requestId,
                ])
                ->get($baseUrl . '/api/v1/appointments/' . urlencode($appointmentId) . '/export');

            if ($response->status() === 404) {
                return [
                    'status' => 'not_found',
                ];
            }

            if (! $response->successful()) {
                Log::warning('Appointment export Go bridge returned an invalid response', [
                    'status' => $response->status(),
                ]);

                return null;
            }

            return [
                'status' => $response->status(),
                'body' => $response->body(),
                'content_type' => $response->header('Content-Type', 'text/calendar'),
                'content_disposition' => $response->header('Content-Disposition', 'attachment; filename="appointment.ics"'),
            ];
        } catch (\Throwable $e) {
            Log::warning('Appointment export Go bridge failed and fallback will be used', [
                'message' => $e->getMessage(),
            ]);

            return null;
        }
    }
}
