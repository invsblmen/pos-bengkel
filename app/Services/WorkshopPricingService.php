<?php

namespace App\Services;

use App\Models\Mechanic;
use App\Models\Service;

class WorkshopPricingService
{
    public static function calculateAutoDiscount(Service $service, int $basePrice, array $selectedServiceIds): array
    {
        $adjustments = $service->priceAdjustments
            ->whereIn('trigger_service_id', $selectedServiceIds)
            ->values();

        $totalAutoDiscount = 0;
        $notes = [];

        foreach ($adjustments as $adjustment) {
            $rawValue = (float) $adjustment->discount_value;
            $discount = $adjustment->discount_type === 'percent'
                ? (int) round($basePrice * ($rawValue / 100))
                : (int) round($rawValue);

            if ($discount <= 0) {
                continue;
            }

            $totalAutoDiscount += $discount;

            if ($adjustment->triggerService) {
                $notes[] = $adjustment->triggerService->title;
            }
        }

        $totalAutoDiscount = min($basePrice, $totalAutoDiscount);

        return [
            'discount_amount' => $totalAutoDiscount,
            'adjusted_price' => max(0, $basePrice - $totalAutoDiscount),
            'notes' => empty($notes) ? null : 'Auto diskon karena: ' . implode(', ', array_unique($notes)),
        ];
    }

    public static function resolveIncentivePercentage(Service $service, ?Mechanic $mechanic): float
    {
        if ($service->incentive_mode === 'by_mechanic' && $mechanic) {
            $override = $service->mechanicIncentives
                ->firstWhere('mechanic_id', $mechanic->id);

            if ($override) {
                return (float) $override->incentive_percentage;
            }
        }

        if (!is_null($service->default_incentive_percentage)) {
            return (float) $service->default_incentive_percentage;
        }

        return $mechanic ? (float) ($mechanic->commission_percentage ?? 0) : 0;
    }

    public static function calculateIncentiveAmount(int $amount, float $percentage): int
    {
        if ($amount <= 0 || $percentage <= 0) {
            return 0;
        }

        return (int) round($amount * ($percentage / 100));
    }
}
