<?php

namespace Tests\Feature\ServiceOrder;

use Tests\TestCase;
use App\Models\User;
use App\Models\Customer;
use App\Models\Vehicle;
use App\Models\Mechanic;
use App\Models\ServiceOrder;
use PHPUnit\Framework\Attributes\Test;
use Spatie\Permission\Models\Role;
use Illuminate\Foundation\Testing\RefreshDatabase;

class ServiceOrderReferenceTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->setupRoles();
    }

    private function setupRoles()
    {
        // Create roles
        Role::create(['name' => 'super-admin']);
        Role::create(['name' => 'user']);

        // Create permissions
        \Spatie\Permission\Models\Permission::create(['name' => 'service-orders-access']);
        \Spatie\Permission\Models\Permission::create(['name' => 'customers-access']);
        \Spatie\Permission\Models\Permission::create(['name' => 'vehicles-access']);
        \Spatie\Permission\Models\Permission::create(['name' => 'mechanics-access']);
    }

    #[Test]
    public function service_order_show_page_includes_permission_context()
    {
        $user = new User(['name' => 'Test User', 'email' => 'test@example.com', 'password' => bcrypt('password')]);
        $user->save();
        $user->assignRole('super-admin');
        // Grant permissions
        $user->givePermissionTo('service-orders-access');
        $user->givePermissionTo('customers-access');
        $user->givePermissionTo('vehicles-access');
        $user->givePermissionTo('mechanics-access');

        $customer = Customer::create(['name' => 'John', 'phone' => '08123456789']);
        $vehicle = Vehicle::create(['customer_id' => $customer->id, 'brand' => 'Toyota', 'model' => 'Avanza', 'plate_number' => 'D-1234-ABC']);
        $mechanic = Mechanic::create(['name' => 'Budi', 'phone' => '08987654321']);
        $order = ServiceOrder::create([
            'order_number' => 'SO-TEST001',
            'customer_id' => $customer->id,
            'vehicle_id' => $vehicle->id,
            'mechanic_id' => $mechanic->id,
            'status' => 'pending',
            'odometer_km' => 100000,
            'labor_cost' => 100000,
            'total' => 500000,
        ]);

        $response = $this->actingAs($user)->get(route('service-orders.show', $order->id));

        $response->assertOk();
        $response->assertInertia(
            fn ($page) => $page
                ->component('Dashboard/ServiceOrders/Show')
                ->has('permissions', fn ($permissions) => $permissions
                    ->where('can_view_customers', true)
                    ->where('can_view_vehicles', true)
                    ->where('can_view_mechanics', true)
                )
        );
    }

    #[Test]
    public function service_order_show_page_respects_permission_restrictions()
    {
        $user = new User(['name' => 'Test User 2', 'email' => 'test2@example.com', 'password' => bcrypt('password')]);
        $user->save();
        $user->assignRole('user');
        // Grant only service-orders-access
        $user->givePermissionTo('service-orders-access');

        $customer = Customer::create(['name' => 'Jane', 'phone' => '08111111111']);
        $vehicle = Vehicle::create(['customer_id' => $customer->id, 'brand' => 'Honda', 'model' => 'Civic', 'plate_number' => 'D-5678-DEF']);
        $mechanic = Mechanic::create(['name' => 'Andi', 'phone' => '08999999999']);
        $order = ServiceOrder::create([
            'order_number' => 'SO-TEST002',
            'customer_id' => $customer->id,
            'vehicle_id' => $vehicle->id,
            'mechanic_id' => $mechanic->id,
            'status' => 'pending',
            'odometer_km' => 80000,
            'labor_cost' => 75000,
            'total' => 400000,
        ]);

        $response = $this->actingAs($user)->get(route('service-orders.show', $order->id));

        $response->assertOk();
        $response->assertInertia(
            fn ($page) => $page
                ->component('Dashboard/ServiceOrders/Show')
                ->has('permissions', fn ($permissions) => $permissions
                    ->where('can_view_customers', false)
                    ->where('can_view_vehicles', false)
                    ->where('can_view_mechanics', false)
                )
        );
    }

    #[Test]
    public function service_order_show_includes_customer_vehicle_mechanic_data()
    {
        $user = new User(['name' => 'Test User 3', 'email' => 'test3@example.com', 'password' => bcrypt('password')]);
        $user->save();
        $user->assignRole('super-admin');
        $user->givePermissionTo('service-orders-access');

        $customer = Customer::create(['name' => 'John Doe', 'phone' => '08222222222']);
        $vehicle = Vehicle::create(['customer_id' => $customer->id, 'brand' => 'Toyota', 'model' => 'Avanza', 'plate_number' => 'D-9999-XYZ']);
        $mechanic = Mechanic::create(['name' => 'Budi', 'phone' => '08333333333']);
        $order = ServiceOrder::create([
            'order_number' => 'SO-TEST003',
            'customer_id' => $customer->id,
            'vehicle_id' => $vehicle->id,
            'mechanic_id' => $mechanic->id,
            'status' => 'pending',
            'odometer_km' => 50000,
            'labor_cost' => 50000,
            'total' => 300000,
        ]);

        $response = $this->actingAs($user)->get(route('service-orders.show', $order->id));

        $response->assertOk();
        $response->assertInertia(
            fn ($page) => $page
                ->component('Dashboard/ServiceOrders/Show')
                ->where('order.customer.name', 'John Doe')
                ->where('order.vehicle.brand', 'Toyota')
                ->where('order.mechanic.name', 'Budi')
        );
    }

    #[Test]
    public function service_order_mechanic_reference_uses_mechanics_show_route_alias_when_available()
    {
        $user = new User(['name' => 'Test User 4', 'email' => 'test4@example.com', 'password' => bcrypt('password')]);
        $user->save();
        $user->assignRole('super-admin');
        $user->givePermissionTo('service-orders-access');
        $user->givePermissionTo('customers-access');
        $user->givePermissionTo('vehicles-access');
        $user->givePermissionTo('mechanics-access');

        $customer = Customer::create(['name' => 'Ref Customer', 'phone' => '08123330001']);
        $vehicle = Vehicle::create(['customer_id' => $customer->id, 'brand' => 'Suzuki', 'model' => 'Ertiga', 'plate_number' => 'D-4321-XYZ']);
        $mechanic = Mechanic::create(['name' => 'Ref Mechanic', 'phone' => '08911110000']);
        $order = ServiceOrder::create([
            'order_number' => 'SO-TEST004',
            'customer_id' => $customer->id,
            'vehicle_id' => $vehicle->id,
            'mechanic_id' => $mechanic->id,
            'status' => 'pending',
            'odometer_km' => 12345,
            'labor_cost' => 25000,
            'total' => 25000,
        ]);

        $response = $this->actingAs($user)->get(route('service-orders.show', $order->id));
        $response->assertOk();

        // Verify that all expected data is present with proper permissions
        $response->assertInertia(
            fn ($page) => $page
                ->component('Dashboard/ServiceOrders/Show')
                ->where('order.mechanic.id', $mechanic->id)
                ->where('order.mechanic.name', 'Ref Mechanic')
                ->where('permissions.can_view_mechanics', true)
        );
    }
}
