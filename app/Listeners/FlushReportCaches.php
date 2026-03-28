<?php

namespace App\Listeners;

use Illuminate\Support\Facades\Cache;
use Illuminate\Contracts\Cache\Repository;
use App\Events\ServiceOrderCreated;
use App\Events\ServiceOrderUpdated;
use App\Events\ServiceOrderDeleted;
use App\Events\PartSaleCreated;
use App\Events\PartSaleUpdated;
use App\Events\PartSaleDeleted;

class FlushReportCaches
{
    /**
     * Store for tracking report cache key prefixes.
     * This allows us to flush cache keys even when using simple drivers.
     */
    private const REPORT_CACHE_PREFIXES = [
        'reports:overall:',
        'reports:part-sales-profit:',
        'reports:mechanic-productivity:',
        'reports:mechanic-payroll:',
    ];

    /**
     * Handle ServiceOrder events (created, updated, deleted).
     * These events affect overall, mechanic productivity, and profit reports.
     */
    public function handleServiceOrderEvent(ServiceOrderCreated|ServiceOrderUpdated|ServiceOrderDeleted $event): void
    {
        $this->flushReportCaches([
            'reports:overall:',
            'reports:mechanic-productivity:',
            'reports:mechanic-payroll:',
            'reports:part-sales-profit:',
        ]);
    }

    /**
     * Handle PartSale events (created, updated, deleted).
     * These events affect overall and part-sales-profit reports.
     */
    public function handlePartSaleEvent(PartSaleCreated|PartSaleUpdated|PartSaleDeleted $event): void
    {
        $this->flushReportCaches([
            'reports:overall:',
            'reports:part-sales-profit:',
        ]);
    }

    /**
     * Flush cache entries matching the given key prefixes.
     * Uses the appropriate strategy based on the cache driver.
     *
     * @param array<string> $prefixes Cache key prefixes to flush
     */
    private function flushReportCaches(array $prefixes): void
    {
        $cache = Cache::store();
        $driver = config('cache.default');

        // Try using tags first (Redis, Memcached support this efficiently)
        if ($this->usesCacheTagging($driver)) {
            $this->flushByTags($prefixes);
            return;
        }

        // For file cache (default), we need to manually iterate through files
        if ($driver === 'file') {
            $this->flushFileCache($prefixes);
            return;
        }

        // Fallback: flush entire cache (conservative but safe)
        Cache::flush();
    }

    /**
     * Check if the cache driver supports tagging.
     */
    private function usesCacheTagging(string $driver): bool
    {
        return in_array($driver, ['redis', 'memcached', 'dynamodb'], true);
    }

    /**
     * Flush cache by tags (for Redis, Memcached, etc).
     *
     * @param array<string> $prefixes Cache key prefixes
     */
    private function flushByTags(array $prefixes): void
    {
        foreach ($prefixes as $prefix) {
            $tag = str_replace([':', '*'], ['.', ''], $prefix);
            try {
                Cache::tags($tag)->flush();
            } catch (\Exception $e) {
                // Silently fail and continue - tags may not be supported on this driver
            }
        }
    }

    /**
     * Flush file cache by iterating through cached files.
     * File cache stores serialized data with predictable filenames.
     *
     * @param array<string> $prefixes Cache key prefixes
     */
    private function flushFileCache(array $prefixes): void
    {
        $cacheDir = storage_path('framework/cache/data');

        if (!is_dir($cacheDir)) {
            return;
        }

        $files = glob($cacheDir . '/*');

        if ($files === false) {
            return;
        }

        foreach ($files as $file) {
            if (!is_file($file)) {
                continue;
            }

            // Read the cache file content to check its key
            try {
                $content = file_get_contents($file);
                if ($content === false) {
                    continue;
                }

                // Check if file contains any of our report cache prefixes
                foreach ($prefixes as $prefix) {
                    if (str_contains($content, $prefix)) {
                        unlink($file);
                        break;
                    }
                }
            } catch (\Exception $e) {
                // Silently continue if we can't read/delete a file
                continue;
            }
        }
    }
}
