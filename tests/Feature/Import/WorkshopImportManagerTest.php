<?php

namespace Tests\Feature\Import;

use App\Services\Import\WorkshopImportManager;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class WorkshopImportManagerTest extends TestCase
{
    use RefreshDatabase;

    public function test_vehicle_dataset_marks_customer_phone_as_optional(): void
    {
        $datasets = (new WorkshopImportManager())->datasetOptions();
        $vehicles = collect($datasets)->firstWhere('type', 'vehicles');

        $this->assertNotNull($vehicles);
        $this->assertSame(['plate_number'], $vehicles['required_headers']);
        $this->assertContains('customer_phone', $vehicles['recommended_headers']);
        $this->assertContains('customer_identity_number', $vehicles['recommended_headers']);
        $this->assertContains('customer_name', $vehicles['recommended_headers']);
    }

    public function test_vehicle_import_uses_customer_identity_number_when_name_is_duplicate(): void
    {
        // Create a real customer in the test DB so Eloquent queries resolve normally
        $matchedCustomer = \App\Models\Customer::create([
            'name' => 'Budi Santoso',
            'identity_number' => '3273010000000001',
            'phone' => '081234567890',
        ]);

        $manager = new WorkshopImportManager();
        $method = new \ReflectionMethod($manager, 'importVehicle');
        $method->setAccessible(true);

        $result = $method->invoke($manager, [
            'customer_phone' => null,
            'customer_identity_number' => '3273010000000001',
            'customer_name' => 'Budi Santoso',
            'plate_number' => 'D1234AB',
            'brand' => 'Honda',
            'model' => 'Beat',
            'year' => '2022',
        ], false);

        $this->assertSame('created', $result);
    }

    public function test_vehicle_import_rejects_ambiguous_customer_name(): void
    {
        // Create two customers with the same name to simulate ambiguity
        \App\Models\Customer::create(["name" => 'Budi Santoso', 'phone' => '081111111111']);
        \App\Models\Customer::create(["name" => 'Budi Santoso', 'phone' => '082222222222']);

        $manager = new WorkshopImportManager();
        $method = new \ReflectionMethod($manager, 'importVehicle');
        $method->setAccessible(true);

        $this->expectException(\InvalidArgumentException::class);
        $this->expectExceptionMessage('Gunakan customer_phone atau customer_identity_number');

        $method->invoke($manager, [
            'customer_phone' => null,
            'customer_identity_number' => null,
            'customer_name' => 'Budi Santoso',
            'plate_number' => 'D1234AB',
            'brand' => 'Honda',
            'model' => 'Beat',
            'year' => '2022',
        ], false);
    }
}
