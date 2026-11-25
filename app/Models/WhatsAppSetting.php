<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Schema;

class WhatsAppSetting extends Model
{
    use HasFactory;

    public const CACHE_KEY = 'whatsapp_settings.current';

    // Nama tabel eksplisit: pluralisasi bawaan Eloquent menghasilkan
    // "whats_app_settings", bukan nama tabel pada migration.
    protected $table = 'whatsapp_settings';

    protected $fillable = [
        'enabled',
        'api_base_url',
        'api_timeout_seconds',
        'api_device_id',
        'api_username',
        'api_password',
        'notify_service_order_created',
        'notify_service_order_updated',
        'notify_part_sale_order_ready',
        'part_sale_auto_waiting_pickup',
    ];

    protected $casts = [
        'enabled' => 'boolean',
        'api_timeout_seconds' => 'integer',
        'notify_service_order_created' => 'boolean',
        'notify_service_order_updated' => 'boolean',
        'notify_part_sale_order_ready' => 'boolean',
        'part_sale_auto_waiting_pickup' => 'boolean',
    ];

    /**
     * Baris pengaturan tunggal (di-cache). Mengembalikan null bila tabel
     * belum dimigrasi atau belum ada baris — pemanggil jatuh ke config/.env.
     */
    public static function current(): ?static
    {
        try {
            if (!Schema::hasTable('whatsapp_settings')) {
                return null;
            }

            return Cache::remember(self::CACHE_KEY, now()->addMinutes(5), function () {
                return static::query()->first();
            });
        } catch (\Throwable $e) {
            return null;
        }
    }

    public static function forgetCurrent(): void
    {
        Cache::forget(self::CACHE_KEY);
    }

    protected static function booted(): void
    {
        static::saved(fn () => static::forgetCurrent());
        static::deleted(fn () => static::forgetCurrent());
    }
}
