<?php

namespace Tests\Feature\Customers;

use App\Models\Customer;
use App\Models\Mechanic;
use App\Models\ServiceOrder;
use App\Models\Vehicle;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use PHPUnit\Framework\Attributes\Test;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\Models\Role;
use Tests\TestCase;

class CustomerShowTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        Role::create(['name' => 'super-admin']);
        Role::create(['name' => 'user']);

        Permission::create(['name' => 'customers-access']);
    }

    #[Test]
    public function it_renders_customer_show_with_related_data(): void
    {
        $user = User::create([
            'name' => 'Customer Viewer',
            'email' => 'customer-viewer@example.com',
            'password' => bcrypt('password'),
        ]);
        $user->assignRole('super-admin');
        $user->givePermissionTo('customers-access');

        $customer = Customer::create([
            'name' => 'John Customer',
            'phone' => '081234000111',
            'email' => 'john@example.com',
            'address' => 'Bandung',
        ]);

        $vehicle = Vehicle::create([
            'customer_id' => $customer->id,
            'brand' => 'Toyota',
            'model' => 'Avanza',
            'plate_number' => 'D-1111-AAA',
        ]);

        $mechanic = Mechanic::create([
            'name' => 'Budi Mekanik',
            'phone' => '0822000111',
        ]);

        ServiceOrder::create([
            'order_number' => 'SO-CUST-001',
            'customer_id' => $customer->id,
            'vehicle_id' => $vehicle->id,
            'mechanic_id' => $mechanic->id,
            'status' => 'pending',
            'odometer_km' => 45000,
            'labor_cost' => 120000,
            'material_cost' => 0,
            'total' => 120000,
            'discount_type' => 'none',
            'discount_value' => 0,
            'discount_amount' => 0,
            'tax_type' => 'none',
            'tax_value' => 0,
            'tax_amount' => 0,
            'grand_total' => 120000,
        ]);

        $response = $this->actingAs($user)->get(route('customers.show', $customer->id));

        $response->assertOk();
        $response->assertInertia(fn ($page) => $page
            ->component('Dashboard/Customers/Show')
            ->where('customer.name', 'John Customer')
            ->where('customer.vehicles.0.plate_number', 'D-1111-AAA')
            ->where('customer.service_orders.0.order_number', 'SO-CUST-001')
        );
    }

    #[Test]
    public function it_redirects_back_when_user_has_no_customers_access_permission(): void
    {
        $user = User::create([
            'name' => 'No Customer Access',
            'email' => 'no-customer-access@example.com',
            'password' => bcrypt('password'),
        ]);
        $user->assignRole('user');

        $customer = Customer::create([
            'name' => 'Restricted Customer',
            'phone' => '081200000999',
        ]);

        $response = $this->actingAs($user)->get(route('customers.show', $customer->id));

        $response->assertStatus(302);
    }
}
