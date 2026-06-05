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

    public function test_vehicle_import_warns_and_reuses_default_customer_when_customer_data_is_missing(): void
    {
        $manager = new WorkshopImportManager();

        $path = tempnam(sys_get_temp_dir(), 'vehicle_import_');
        if ($path === false) {
            $this->fail('Unable to create temporary file for import test.');
        }

        file_put_contents($path, "plate_number,brand,model\nD1234AB,Honda,Beat\nD1235AC,Yamaha,Mio\n");

        $file = new \Illuminate\Http\UploadedFile(
            $path,
            'vehicles.csv',
            'text/csv',
            null,
            true
        );

        try {
            $result = $manager->import('vehicles', $file, false);
        } finally {
            @unlink($path);
        }

        $this->assertSame(2, $result['successful_rows']);
        $this->assertSame(2, count($result['warnings']));
        $this->assertSame(2, $result['warnings'][0]['line']);
        $this->assertSame(3, $result['warnings'][1]['line']);
        $this->assertSame(1, \App\Models\Customer::query()->where('name', 'Pemilik Tidak Diketahui')->count());
        $this->assertSame(2, \Illuminate\Support\Facades\DB::table('vehicles')->count());
    }
}
