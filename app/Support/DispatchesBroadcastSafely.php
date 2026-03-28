<?php

namespace App\Support;

use Illuminate\Broadcasting\BroadcastException;
use Illuminate\Support\Facades\Log;
use Throwable;

trait DispatchesBroadcastSafely
{
    protected function dispatchBroadcastSafely(callable $dispatcher, string $eventName): void
    {
        try {
            $dispatcher();
        } catch (BroadcastException $e) {
            // Broadcast failures should not fail the main transaction flow.
            Log::warning('Broadcast skipped because broadcaster is unreachable.', [
                'event' => $eventName,
                'message' => $e->getMessage(),
            ]);
        } catch (Throwable $e) {
            // Some broadcaster failures bubble up as transport exceptions (e.g. Guzzle RequestException).
            // Treat them as non-fatal to keep business flow successful.
            Log::warning('Broadcast skipped because transport failed.', [
                'event' => $eventName,
                'exception' => get_class($e),
                'message' => $e->getMessage(),
            ]);
        }
    }
}
