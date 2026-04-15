<?php

namespace App\Http\Controllers\Apps;

use App\Http\Controllers\Controller;
use App\Models\Vehicle;
use App\Models\ServiceOrder;
use App\Models\Service;
use App\Models\Part;
use Illuminate\Http\Request;

class RecommendationController extends Controller
{
    /**
     * Get recommended parts and services for a vehicle
     * Analyzes past service history and suggests commonly needed maintenance
     */
    public function getVehicleRecommendations(Vehicle $vehicle)
    {
        $request = request();

        try {
            // Get recent service orders to analyze patterns
            $recentOrders = $vehicle->serviceOrders()
                ->with('details.service', 'details.part')
                ->orderByDesc('created_at')
                ->limit(10)
                ->get();

            // Extract used parts and services from history
            $usedParts = [];
            $usedServices = [];

            foreach ($recentOrders as $order) {
                foreach ($order->details as $detail) {
                    if ($detail->service_id) {
                        $usedServices[$detail->service_id] = ($usedServices[$detail->service_id] ?? 0) + 1;
                    }
                    if ($detail->part_id) {
                        $usedParts[$detail->part_id] = ($usedParts[$detail->part_id] ?? 0) + 1;
                    }
                }
            }

            // Get common maintenance items for this vehicle brand/model
            // For now, recommend based on frequency in history + common parts
            $commonParts = Part::with('category')
                ->where('stock', '>', 0)
                ->orderBy('name')
                ->limit(5)
                ->get()
                ->map(fn($part) => [
                    'id' => $part->id,
                    'name' => $part->name,
                    'category' => $part->category ? $part->category->name : 'Other',
                    'price' => $part->sell_price ?? 0,
                    'frequency' => $usedParts[$part->id] ?? 0,
                ])
                ->toArray();

            // Get common services for this vehicle type
            $commonServices = Service::with('category')
                ->orderBy('name')
                ->limit(5)
                ->get()
                ->map(fn($service) => [
                    'id' => $service->id,
                    'name' => $service->name,
                    'category' => $service->category ? $service->category->name : 'Other',
                    'price' => $service->price ?? 0,
                    'frequency' => $usedServices[$service->id] ?? 0,
                ])
                ->toArray();

            $payload = [
                'vehicle_id' => $vehicle->id,
                'brand' => $vehicle->brand,
                'model' => $vehicle->model,
                'recommended_parts' => $commonParts ?? [],
                'recommended_services' => $commonServices ?? [],
                'recent_history_count' => $recentOrders->count(),
            ];
            return response()->json($payload);
        } catch (\Exception $e) {
            $payload = [
                'vehicle_id' => $vehicle->id,
                'brand' => $vehicle->brand,
                'model' => $vehicle->model,
                'recommended_parts' => [],
                'recommended_services' => [],
                'recent_history_count' => 0,
                'error' => $e->getMessage(),
            ];
            return response()->json($payload);
        }
    }

    /**
     * Get maintenance schedule based on vehicle type and history
     */
    public function getMaintenanceSchedule(Vehicle $vehicle)
    {
        $request = request();

        $schedule = [
            [
                'interval' => '5,000 km / 3 months',
                'services' => ['Oil Change', 'Oil Filter'],
                'parts' => ['Engine Oil', 'Oil Filter'],
                'priority' => 'high',
            ],
            [
                'interval' => '10,000 km / 6 months',
                'services' => ['Fluid Check', 'Belt Inspection'],
                'parts' => [],
                'priority' => 'medium',
            ],
            [
                'interval' => '20,000 km / 12 months',
                'services' => ['Full Service', 'Brake Check'],
                'parts' => ['Brake Pads', 'Transmission Fluid'],
                'priority' => 'high',
            ],
            [
                'interval' => '40,000 km / 24 months',
                'services' => ['Transmission Service', 'Coolant Flush'],
                'parts' => [],
                'priority' => 'medium',
            ],
        ];

        $payload = [
            'vehicle_id' => $vehicle->id,
            'schedule' => $schedule,
        ];
        return response()->json($payload);
    }

}
