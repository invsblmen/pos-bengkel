<?php

namespace Tests\Feature\Import;

use App\Services\Import\WorkshopImportManager;
use Mockery;
use Mockery\Adapter\Phpunit\MockeryPHPUnitIntegration;
use Tests\TestCase;

class WorkshopImportManagerTest extends TestCase
{
    use MockeryPHPUnitIntegration;

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
        $matchedCustomer = (object) ['id' => 99];

        $customerQuery = Mockery::mock();
        $customerQuery->shouldReceive('first')->once()->andReturn($matchedCustomer);

        $customerModel = Mockery::mock('alias:App\Models\Customer');
        $customerModel->shouldReceive('where')
            ->once()
            ->with('identity_number', '3273010000000001')
            ->andReturn($customerQuery);

        $vehicleQuery = Mockery::mock();
        $vehicleQuery->shouldReceive('first')->once()->andReturnNull();

        $vehicleModel = Mockery::mock('alias:App\Models\Vehicle');
        $vehicleModel->shouldReceive('where')
            ->once()
            ->with('plate_number', 'D1234AB')
            ->andReturn($vehicleQuery);
        $vehicleModel->shouldReceive('create')
            ->once()
            ->with(Mockery::on(function (array $payload) use ($matchedCustomer): bool {
                return $payload['customer_id'] === $matchedCustomer->id
                    && $payload['plate_number'] === 'D1234AB'
                    && $payload['brand'] === 'Honda'
                    && $payload['model'] === 'Beat';
            }))
            ->andReturnTrue();

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
        $nameQuery = Mockery::mock();
        $nameQuery->shouldReceive('count')->once()->andReturn(2);

        $customerModel = Mockery::mock('alias:App\Models\Customer');
        $customerModel->shouldReceive('where')
            ->once()
            ->with('name', 'Budi Santoso')
            ->andReturn($nameQuery);

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
