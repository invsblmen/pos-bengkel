<?php

namespace App\Http\Controllers\Apps;

use App\Http\Controllers\Concerns\RespondsWithJsonOrRedirect;
use App\Http\Controllers\Controller;
use App\Models\WhatsAppSetting;
use Illuminate\Http\Request;
use Inertia\Inertia;

class WhatsAppSettingController extends Controller
{
    use RespondsWithJsonOrRedirect;

    public function edit()
    {
        $setting = WhatsAppSetting::current();

        // Nilai efektif yang ditampilkan: nilai database bila terisi,
        // selain itu nilai config/.env saat ini. Password tersimpan
        // tidak pernah dikirim ke frontend — hanya flag keberadaannya.
        return Inertia::render('Dashboard/WhatsApp/Settings', [
            'setting' => [
                'enabled' => $setting?->enabled ?? (bool) config('whatsapp.enabled', false),
                'api_base_url' => $setting?->api_base_url ?? (string) config('whatsapp.api.base_url', ''),
                'api_timeout_seconds' => $setting?->api_timeout_seconds ?? (int) config('whatsapp.api.timeout_seconds', 15),
                'api_device_id' => $setting?->api_device_id ?? (string) config('whatsapp.api.device_id', ''),
                'api_username' => $setting?->api_username ?? (string) config('whatsapp.api.username', ''),
                'has_password' => filled($setting?->api_password ?? config('whatsapp.api.password')),
                'notify_service_order_created' => $setting?->notify_service_order_created ?? (bool) config('whatsapp.notifications.service_order_created', true),
                'notify_service_order_updated' => $setting?->notify_service_order_updated ?? (bool) config('whatsapp.notifications.service_order_updated', false),
                'notify_part_sale_order_ready' => $setting?->notify_part_sale_order_ready ?? (bool) config('whatsapp.notifications.part_sale_order_ready', true),
                'part_sale_auto_waiting_pickup' => $setting?->part_sale_auto_waiting_pickup ?? (bool) config('whatsapp.notifications.part_sale_auto_waiting_pickup', true),
            ],
        ]);
    }

    public function update(Request $request)
    {
        $data = $request->validate([
            'enabled' => ['boolean'],
            'api_base_url' => ['nullable', 'string', 'max:255'],
            'api_timeout_seconds' => ['nullable', 'integer', 'min:1', 'max:120'],
            'api_device_id' => ['nullable', 'string', 'max:255'],
            'api_username' => ['nullable', 'string', 'max:255'],
            'api_password' => ['nullable', 'string', 'max:255'],
            'notify_service_order_created' => ['boolean'],
            'notify_service_order_updated' => ['boolean'],
            'notify_part_sale_order_ready' => ['boolean'],
            'part_sale_auto_waiting_pickup' => ['boolean'],
        ]);

        $setting = WhatsAppSetting::firstOrCreate([]);

        // Kolom teks yang dikosongkan disimpan sebagai null agar sistem
        // kembali memakai nilai config/.env (bukan string kosong).
        $payload = [
            'enabled' => (bool) ($data['enabled'] ?? false),
            'api_base_url' => $this->blankToNull($data['api_base_url'] ?? null),
            'api_timeout_seconds' => $data['api_timeout_seconds'] ?? null,
            'api_device_id' => $this->blankToNull($data['api_device_id'] ?? null),
            'api_username' => $this->blankToNull($data['api_username'] ?? null),
            'notify_service_order_created' => (bool) ($data['notify_service_order_created'] ?? false),
            'notify_service_order_updated' => (bool) ($data['notify_service_order_updated'] ?? false),
            'notify_part_sale_order_ready' => (bool) ($data['notify_part_sale_order_ready'] ?? false),
            'part_sale_auto_waiting_pickup' => (bool) ($data['part_sale_auto_waiting_pickup'] ?? false),
        ];

        // Password hanya ditimpa bila diisi; kosong = pertahankan yang lama.
        if (filled($data['api_password'] ?? null)) {
            $payload['api_password'] = $data['api_password'];
        }

        $setting->update($payload);

        WhatsAppSetting::forgetCurrent();

        return $this->jsonOrRedirect('whatsapp.settings.edit', [], 'Konfigurasi WhatsApp berhasil disimpan.');
    }

    private function blankToNull(?string $value): ?string
    {
        $value = is_string($value) ? trim($value) : $value;

        return $value === '' || $value === null ? null : $value;
    }
}
