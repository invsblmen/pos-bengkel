<?php

namespace App\Providers;

use App\Models\PartSale;
use App\Observers\PartSaleObserver;
use App\Listeners\FlushReportCaches;
use App\Listeners\SendServiceOrderWhatsAppNotification;
use App\Listeners\SendAppointmentWhatsAppNotification;
use App\Events\AppointmentCreated;
use App\Events\AppointmentUpdated;
use App\Events\ServiceOrderCreated;
use App\Events\ServiceOrderUpdated;
use App\Events\ServiceOrderDeleted;
use App\Events\PartSaleCreated;
use App\Events\PartSaleUpdated;
use App\Events\PartSaleDeleted;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Queue;
use Illuminate\Support\ServiceProvider;
use Illuminate\Support\Carbon;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        //
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        PartSale::observe(PartSaleObserver::class);

        // Register event listeners for report cache invalidation
        $this->registerCacheInvalidationListeners();

        // Keep a lightweight heartbeat for queue-worker monitoring.
        $this->registerQueueHeartbeat();

        // Ensure all Carbon dates serialize to a stable local string without timezone shifts
        Carbon::serializeUsing(function ($carbon) {
            return $carbon->format('Y-m-d H:i:s');
        });
    }

    /**
     * Register listeners for cache invalidation on transaction events.
     * When service orders or part sales are created/updated/deleted,
     * flush report caches to ensure fresh data is displayed immediately.
     */
    private function registerCacheInvalidationListeners(): void
    {
        $listener = new FlushReportCaches();
        $whatsAppListener = new SendServiceOrderWhatsAppNotification();
        $appointmentWhatsAppListener = new SendAppointmentWhatsAppNotification();

        // Service order events
        $this->app['events']->listen(
            [ServiceOrderCreated::class, ServiceOrderUpdated::class, ServiceOrderDeleted::class],
            [$listener, 'handleServiceOrderEvent']
        );

        // Service order WhatsApp notifications (queued)
        $this->app['events']->listen(
            [ServiceOrderCreated::class, ServiceOrderUpdated::class],
            [$whatsAppListener, 'handle']
        );

        // Appointment WhatsApp notifications (queued)
        $this->app['events']->listen(
            [AppointmentCreated::class, AppointmentUpdated::class],
            [$appointmentWhatsAppListener, 'handle']
        );

        // Part sale events
        $this->app['events']->listen(
            [PartSaleCreated::class, PartSaleUpdated::class, PartSaleDeleted::class],
            [$listener, 'handlePartSaleEvent']
        );
    }

    private function registerQueueHeartbeat(): void
    {
        Queue::looping(function (): void {
            if (!config('whatsapp.enabled')) {
                return;
            }

            $heartbeatKey = (string) config('whatsapp.monitoring.heartbeat_key', 'whatsapp:queue:heartbeat');
            $heartbeatTtl = max(30, (int) config('whatsapp.monitoring.heartbeat_ttl_seconds', 90));

            Cache::put($heartbeatKey, [
                'checked_at' => now()->toIso8601String(),
                'timestamp' => now()->timestamp,
                'pid' => function_exists('getmypid') ? getmypid() : null,
                'host' => gethostname() ?: php_uname('n'),
                'queue_connection' => (string) config('queue.default', 'database'),
                'queue_name' => (string) config('whatsapp.notifications.queue', 'default'),
            ], now()->addSeconds($heartbeatTtl));
        });
    }
}
