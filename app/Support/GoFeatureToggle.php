<?php

namespace App\Support;

use Illuminate\Http\Request;
use Illuminate\Support\Str;

class GoFeatureToggle
{
    public static function shouldUseGo(string $featureKey, ?Request $request = null): bool
    {
        if (! (bool) config('go_backend.features.' . $featureKey, false)) {
            return false;
        }

        if (! (bool) config('go_backend.canary.enabled', false)) {
            return true;
        }

        $defaultPercentage = (int) config('go_backend.canary.default_percentage', 100);
        $featurePercentages = (array) config('go_backend.canary.feature_percentages', []);
        $percentage = (int) ($featurePercentages[$featureKey] ?? $defaultPercentage);
        $percentage = max(0, min(100, $percentage));

        if ($percentage >= 100) {
            return true;
        }

        if ($percentage <= 0) {
            return false;
        }

        $seed = self::resolveSeed($request, $featureKey);
        $bucket = abs(crc32($seed)) % 100;

        return $bucket < $percentage;
    }

    private static function resolveSeed(?Request $request, string $featureKey): string
    {
        $requestId = $request?->header('X-Request-Id');
        if (is_string($requestId) && $requestId !== '') {
            return $featureKey . '|' . $requestId;
        }

        $fingerprint = $request?->header('X-Forwarded-For')
            ?: $request?->ip()
            ?: $request?->userAgent()
            ?: (string) Str::uuid();

        return $featureKey . '|' . $fingerprint;
    }
}
