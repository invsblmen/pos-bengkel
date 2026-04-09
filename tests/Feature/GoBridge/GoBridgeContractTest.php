<?php

namespace Tests\Feature\GoBridge;

use App\Models\User;
use App\Models\Customer;
use App\Models\Mechanic;
use App\Models\Part;
use App\Models\PartPurchase;
use App\Models\PartSalesOrder;
use App\Models\PartSale;
use App\Models\PartSaleDetail;
use App\Models\Supplier;
use App\Models\Vehicle;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;
use Spatie\Permission\Models\Permission;
use Tests\TestCase;

class GoBridgeContractTest extends TestCase
{
    use RefreshDatabase;

    public function test_webhook_proxy_returns_go_payload_shape(): void
    {
        config()->set('whatsapp.go_backend.use_webhook', true);
        config()->set('whatsapp.go_backend.base_url', 'http://127.0.0.1:8081');

        Http::fake([
            'http://127.0.0.1:8081/api/v1/webhooks/whatsapp' => Http::response([
                'status' => 'ok',
            ], 200),
        ]);

        $response = $this->postJson('/webhooks/whatsapp', [
            'event' => 'incoming_message',
            'device_id' => 'device-1',
        ], [
            'X-Hub-Signature-256' => 'sha256=deadbeef',
        ]);

        $response->assertStatus(200)
            ->assertJson([
                'status' => 'ok',
            ]);
    }

    public function test_vehicle_index_proxy_returns_go_payload_shape(): void
    {
        config()->set('go_backend.features.vehicle_index', true);
        config()->set('go_backend.base_url', 'http://127.0.0.1:8081');

        Permission::firstOrCreate(['name' => 'vehicles-access', 'guard_name' => 'web']);

        /** @var \App\Models\User $user */
        $user = User::factory()->create();
        $user->givePermissionTo('vehicles-access');

        Http::fake([
            'http://127.0.0.1:8081/api/v1/vehicles*' => Http::response([
                'vehicles' => [
                    'current_page' => 1,
                    'data' => [
                        [
                            'id' => 10,
                            'plate_number' => 'B1234CD',
                            'brand' => 'Honda',
                            'model' => 'Vario',
                            'year' => 2024,
                            'km' => 42000,
                            'engine_type' => '4-stroke',
                            'transmission_type' => 'automatic',
                            'color' => 'Red',
                            'cylinder_volume' => '150',
                            'last_service_date' => '2026-04-01',
                            'next_service_date' => '2026-05-01',
                            'customer' => [
                                'id' => 1,
                                'name' => 'Customer A',
                                'phone' => '081234567890',
                            ],
                        ],
                    ],
                    'from' => 1,
                    'last_page' => 1,
                    'links' => [
                        ['url' => null, 'label' => '&laquo; Previous', 'active' => false],
                        ['url' => '/vehicles', 'label' => '1', 'active' => true],
                        ['url' => null, 'label' => 'Next &raquo;', 'active' => false],
                    ],
                    'per_page' => 8,
                    'to' => 1,
                    'total' => 1,
                ],
                'stats' => [
                    'total' => 1,
                    'serviced' => 1,
                    'never_serviced' => 0,
                    'this_month' => 1,
                ],
                'filters' => [
                    'search' => 'Vario',
                    'brand' => 'Honda',
                    'year' => 2024,
                    'transmission' => 'automatic',
                    'service_status' => 'serviced',
                    'sort_by' => 'created_at',
                    'sort_direction' => 'desc',
                    'per_page' => 8,
                ],
            ], 200),
        ]);

        $response = $this->actingAs($user)
            ->get(route('vehicles.index', [
                'search' => 'Vario',
                'brand' => 'Honda',
                'year' => 2024,
                'transmission' => 'automatic',
                'service_status' => 'serviced',
            ]));

        $response->assertOk();
        $response->assertInertia(fn ($page) => $page
            ->component('Dashboard/Vehicles/Index')
            ->where('vehicles.total', 1)
            ->where('vehicles.data.0.plate_number', 'B1234CD')
            ->where('stats.serviced', 1)
            ->where('filters.search', 'Vario')
        );
    }

    public function test_vehicle_store_proxy_returns_go_payload_shape(): void
    {
        config()->set('go_backend.features.vehicle_store', true);
        config()->set('go_backend.base_url', 'http://127.0.0.1:8081');

        Permission::firstOrCreate(['name' => 'vehicles-create', 'guard_name' => 'web']);

        $customer = Customer::create([
            'name' => 'Customer Vehicle',
            'phone' => '081211110001',
        ]);

        /** @var \App\Models\User $user */
        $user = User::factory()->create();
        $user->givePermissionTo('vehicles-create');

        Http::fake([
            'http://127.0.0.1:8081/api/v1/vehicles' => Http::response([
                'message' => 'Kendaraan berhasil ditambahkan!',
                'vehicle' => [
                    'id' => 909,
                    'customer_id' => $customer->id,
                    'plate_number' => 'B1234CD',
                    'brand' => 'Honda',
                    'model' => 'Vario',
                    'year' => 2024,
                    'color' => 'Merah',
                ],
            ], 200),
        ]);

        $response = $this->actingAs($user)
            ->post(route('vehicles.store'), [
                'customer_id' => $customer->id,
                'plate_number' => 'B1234CD',
                'brand' => 'Honda',
                'model' => 'Vario',
                'year' => 2024,
                'color' => 'Merah',
            ]);

        $response->assertRedirect(route('vehicles.index'));
        $response->assertSessionHas('success', 'Kendaraan berhasil ditambahkan!');
        $response->assertSessionHas('vehicle.id', 909);
    }

    public function test_vehicle_update_proxy_returns_go_payload_shape(): void
    {
        config()->set('go_backend.features.vehicle_update', true);
        config()->set('go_backend.base_url', 'http://127.0.0.1:8081');

        Permission::firstOrCreate(['name' => 'vehicles-edit', 'guard_name' => 'web']);

        $customer = Customer::create([
            'name' => 'Customer Vehicle Update',
            'phone' => '081211110002',
        ]);

        $vehicle = Vehicle::create([
            'customer_id' => $customer->id,
            'plate_number' => 'B9999ZZ',
            'brand' => 'Yamaha',
            'model' => 'Nmax',
            'year' => 2022,
        ]);

        /** @var \App\Models\User $user */
        $user = User::factory()->create();
        $user->givePermissionTo('vehicles-edit');

        Http::fake([
            'http://127.0.0.1:8081/api/v1/vehicles/' . $vehicle->id => Http::response([
                'message' => 'Kendaraan berhasil diperbarui!',
                'vehicle' => [
                    'id' => $vehicle->id,
                    'customer_id' => $customer->id,
                    'plate_number' => 'B1234CD',
                    'brand' => 'Honda',
                    'model' => 'Vario',
                    'year' => 2024,
                    'color' => 'Merah',
                ],
            ], 200),
        ]);

        $response = $this->actingAs($user)
            ->put(route('vehicles.update', ['vehicle' => $vehicle->id]), [
                'customer_id' => $customer->id,
                'plate_number' => 'B1234CD',
                'brand' => 'Honda',
                'model' => 'Vario',
                'year' => 2024,
                'color' => 'Merah',
            ]);

        $response->assertRedirect(route('vehicles.index'));
        $response->assertSessionHas('success', 'Kendaraan berhasil diperbarui!');
    }

    public function test_vehicle_destroy_proxy_returns_go_payload_shape(): void
    {
        config()->set('go_backend.features.vehicle_destroy', true);
        config()->set('go_backend.base_url', 'http://127.0.0.1:8081');

        Permission::firstOrCreate(['name' => 'vehicles-delete', 'guard_name' => 'web']);

        $customer = Customer::create([
            'name' => 'Customer Vehicle Delete',
            'phone' => '081211110003',
        ]);

        $vehicle = Vehicle::create([
            'customer_id' => $customer->id,
            'plate_number' => 'B7777YY',
            'brand' => 'Suzuki',
            'model' => 'Satria',
            'year' => 2021,
        ]);

        /** @var \App\Models\User $user */
        $user = User::factory()->create();
        $user->givePermissionTo('vehicles-delete');

        Http::fake([
            'http://127.0.0.1:8081/api/v1/vehicles/' . $vehicle->id => Http::response([
                'message' => 'Kendaraan berhasil dihapus!',
                'vehicle_id' => $vehicle->id,
            ], 200),
        ]);

        $response = $this->actingAs($user)
            ->delete(route('vehicles.destroy', ['vehicle' => $vehicle->id]));

        $response->assertRedirect(route('vehicles.index'));
        $response->assertSessionHas('success', 'Kendaraan berhasil dihapus!');
    }

    public function test_customer_index_proxy_returns_go_payload_shape(): void
    {
        config()->set('go_backend.features.customer_index', true);
        config()->set('go_backend.base_url', 'http://127.0.0.1:8081');

        Permission::firstOrCreate(['name' => 'customers-access', 'guard_name' => 'web']);

        /** @var \App\Models\User $user */
        $user = User::factory()->create();
        $user->givePermissionTo('customers-access');

        $customer = Customer::create([
            'name' => 'Bridge Customer',
            'phone' => '081200000001',
            'email' => 'bridge-customer@example.com',
            'address' => 'Bridge Address',
        ]);

        Http::fake([
            'http://127.0.0.1:8081/api/v1/customers*' => Http::response([
                'customers' => [
                    'current_page' => 1,
                    'data' => [
                        [
                            'id' => 1,
                            'name' => 'Customer A',
                            'phone' => '081234567890',
                            'email' => 'customer@example.com',
                            'address' => 'Jl. Contoh No. 1',
                            'vehicles' => [
                                [
                                    'id' => 10,
                                    'customer_id' => 1,
                                    'plate_number' => 'B1234CD',
                                    'brand' => 'Honda',
                                    'model' => 'Vario',
                                    'year' => 2024,
                                    'km' => 42000,
                                ],
                            ],
                        ],
                    ],
                    'from' => 1,
                    'last_page' => 1,
                    'links' => [
                        ['url' => null, 'label' => '&laquo; Previous', 'active' => false],
                        ['url' => '/customers', 'label' => '1', 'active' => true],
                        ['url' => null, 'label' => 'Next &raquo;', 'active' => false],
                    ],
                    'per_page' => 8,
                    'to' => 1,
                    'total' => 1,
                ],
            ], 200),
        ]);

        $response = $this->actingAs($user)
            ->get(route('customers.index', [
                'search' => 'Customer A',
                'per_page' => 8,
            ]));

        $response->assertOk();
        $response->assertInertia(fn ($page) => $page
            ->component('Dashboard/Customers/Index')
            ->where('customers.total', 1)
            ->where('customers.data.0.name', 'Customer A')
            ->where('customers.data.0.vehicles.0.plate_number', 'B1234CD')
            ->where('customers.per_page', 8)
        );
    }

    public function test_customer_show_proxy_returns_go_payload_shape(): void
    {
        config()->set('go_backend.features.customer_show', true);
        config()->set('go_backend.base_url', 'http://127.0.0.1:8081');

        Permission::firstOrCreate(['name' => 'customers-access', 'guard_name' => 'web']);

        /** @var \App\Models\User $user */
        $user = User::factory()->create();
        $user->givePermissionTo('customers-access');

        $customer = Customer::create([
            'name' => 'Bridge Customer',
            'phone' => '081200000001',
            'email' => 'bridge-customer@example.com',
            'address' => 'Bridge Address',
        ]);

        Http::fake([
            'http://127.0.0.1:8081/api/v1/customers/' . $customer->id => Http::response([
                'customer' => [
                    'id' => 1,
                    'name' => 'Customer A',
                    'phone' => '081234567890',
                    'email' => 'customer@example.com',
                    'address' => 'Jl. Contoh No. 1',
                    'vehicles' => [
                        [
                            'id' => 10,
                            'customer_id' => 1,
                            'plate_number' => 'B1234CD',
                            'brand' => 'Honda',
                            'model' => 'Vario',
                        ],
                    ],
                    'service_orders' => [
                        [
                            'id' => 100,
                            'order_number' => 'SO-CUST-001',
                            'status' => 'pending',
                            'created_at' => '2026-04-08T10:00:00+07:00',
                            'vehicle' => [
                                'id' => 10,
                                'plate_number' => 'B1234CD',
                                'brand' => 'Honda',
                                'model' => 'Vario',
                            ],
                            'mechanic' => [
                                'id' => 1,
                                'name' => 'Iwan',
                            ],
                        ],
                    ],
                ],
            ], 200),
        ]);

        $response = $this->actingAs($user)
            ->get(route('customers.show', ['customer' => $customer->id]));

        $response->assertOk();
        $response->assertInertia(fn ($page) => $page
            ->component('Dashboard/Customers/Show')
            ->where('customer.name', 'Customer A')
            ->where('customer.vehicles.0.plate_number', 'B1234CD')
            ->where('customer.service_orders.0.order_number', 'SO-CUST-001')
            ->where('customer.service_orders.0.mechanic.name', 'Iwan')
        );
    }

    public function test_customer_search_proxy_returns_go_payload_shape(): void
    {
        config()->set('go_backend.features.customer_search', true);
        config()->set('go_backend.base_url', 'http://127.0.0.1:8081');

        Permission::firstOrCreate(['name' => 'customers-access', 'guard_name' => 'web']);

        /** @var \App\Models\User $user */
        $user = User::factory()->create();
        $user->givePermissionTo('customers-access');

        Http::fake([
            'http://127.0.0.1:8081/api/v1/customers/search*' => Http::response([
                'data' => [
                    [
                        'id' => 1,
                        'name' => 'John Customer',
                        'phone' => '081234567890',
                    ],
                    [
                        'id' => 2,
                        'name' => 'Johnny Doe',
                        'phone' => '081298765432',
                    ],
                ],
            ], 200),
        ]);

        $response = $this->actingAs($user)
            ->getJson(route('customers.search', ['q' => 'john', 'limit' => 20]));

        $response->assertOk()
            ->assertJson([
                'data' => [
                    [
                        'id' => 1,
                        'name' => 'John Customer',
                        'phone' => '081234567890',
                    ],
                ],
            ])
            ->assertJsonCount(2, 'data');
    }

    public function test_customer_store_proxy_returns_go_payload_shape(): void
    {
        config()->set('go_backend.features.customer_store', true);
        config()->set('go_backend.base_url', 'http://127.0.0.1:8081');

        Permission::firstOrCreate(['name' => 'customers-create', 'guard_name' => 'web']);

        /** @var \App\Models\User $user */
        $user = User::factory()->create();
        $user->givePermissionTo('customers-create');

        Http::fake([
            'http://127.0.0.1:8081/api/v1/customers' => Http::response([
                'message' => 'Pelanggan berhasil ditambahkan',
                'customer' => [
                    'id' => 199,
                    'name' => 'Customer Store',
                    'phone' => '081200000099',
                    'email' => 'store@example.com',
                    'address' => 'Alamat Store',
                ],
            ], 200),
        ]);

        $response = $this->actingAs($user)
            ->post(route('customers.store'), [
                'name' => 'Customer Store',
                'phone' => '081200000099',
                'email' => 'store@example.com',
                'address' => 'Alamat Store',
            ]);

        $response->assertRedirect(route('customers.index'));
        $response->assertSessionHas('flash.customer.id', 199);
    }

    public function test_customer_store_ajax_proxy_returns_go_payload_shape(): void
    {
        config()->set('go_backend.features.customer_store_ajax', true);
        config()->set('go_backend.base_url', 'http://127.0.0.1:8081');

        Permission::firstOrCreate(['name' => 'customers-create', 'guard_name' => 'web']);

        /** @var \App\Models\User $user */
        $user = User::factory()->create();
        $user->givePermissionTo('customers-create');

        Http::fake([
            'http://127.0.0.1:8081/api/v1/customers/store-ajax' => Http::response([
                'success' => true,
                'message' => 'Pelanggan berhasil ditambahkan',
                'customer' => [
                    'id' => 99,
                    'name' => 'Customer Baru',
                    'phone' => '081234567890',
                    'email' => 'customer@example.com',
                    'address' => 'Jl. Merdeka 1',
                ],
            ], 200),
        ]);

        $response = $this->actingAs($user)
            ->postJson(route('customers.storeAjax'), [
                'name' => 'Customer Baru',
                'phone' => '081234567890',
                'email' => 'customer@example.com',
                'address' => 'Jl. Merdeka 1',
            ]);

        $response->assertOk()
            ->assertJson([
                'success' => true,
                'message' => 'Pelanggan berhasil ditambahkan',
                'customer' => [
                    'id' => 99,
                    'name' => 'Customer Baru',
                    'phone' => '081234567890',
                    'email' => 'customer@example.com',
                    'address' => 'Jl. Merdeka 1',
                ],
            ]);
    }

    public function test_customer_update_proxy_returns_go_payload_shape(): void
    {
        config()->set('go_backend.features.customer_update', true);
        config()->set('go_backend.base_url', 'http://127.0.0.1:8081');

        Permission::firstOrCreate(['name' => 'customers-edit', 'guard_name' => 'web']);

        /** @var \App\Models\User $user */
        $user = User::factory()->create();
        $user->givePermissionTo('customers-edit');

        $customer = Customer::create([
            'name' => 'Customer Lama',
            'phone' => '081200000001',
            'email' => 'lama@example.com',
            'address' => 'Alamat Lama',
        ]);

        Http::fake([
            'http://127.0.0.1:8081/api/v1/customers/' . $customer->id => Http::response([
                'message' => 'Pelanggan berhasil diperbarui',
                'customer' => [
                    'id' => $customer->id,
                    'name' => 'Customer Baru',
                    'phone' => '081200000002',
                    'email' => 'baru@example.com',
                    'address' => 'Alamat Baru',
                ],
            ], 200),
        ]);

        $response = $this->actingAs($user)
            ->put(route('customers.update', ['customer' => $customer->id]), [
                'name' => 'Customer Baru',
                'phone' => '081200000002',
                'email' => 'baru@example.com',
                'address' => 'Alamat Baru',
            ]);

        $response->assertRedirect(route('customers.index'));
    }

    public function test_customer_destroy_proxy_returns_go_payload_shape(): void
    {
        config()->set('go_backend.features.customer_destroy', true);
        config()->set('go_backend.base_url', 'http://127.0.0.1:8081');

        Permission::firstOrCreate(['name' => 'customers-delete', 'guard_name' => 'web']);

        /** @var \App\Models\User $user */
        $user = User::factory()->create();
        $user->givePermissionTo('customers-delete');

        $customer = Customer::create([
            'name' => 'Customer Hapus',
            'phone' => '081200000003',
            'email' => 'hapus@example.com',
            'address' => 'Alamat Hapus',
        ]);

        Http::fake([
            'http://127.0.0.1:8081/api/v1/customers/' . $customer->id => Http::response([
                'message' => 'Pelanggan berhasil dihapus',
                'customer_id' => $customer->id,
            ], 200),
        ]);

        $response = $this->actingAs($user)
            ->delete(route('customers.destroy', ['customer' => $customer->id]));

        $response->assertRedirect();
    }

    public function test_supplier_store_proxy_returns_go_payload_shape(): void
    {
        config()->set('go_backend.features.supplier_store', true);
        config()->set('go_backend.base_url', 'http://127.0.0.1:8081');

        Permission::firstOrCreate(['name' => 'suppliers-create', 'guard_name' => 'web']);

        /** @var \App\Models\User $user */
        $user = User::factory()->create();
        $user->givePermissionTo('suppliers-create');

        Http::fake([
            'http://127.0.0.1:8081/api/v1/suppliers' => Http::response([
                'message' => 'Supplier created successfully.',
                'supplier' => [
                    'id' => 707,
                    'name' => 'Supplier Proxy',
                    'phone' => '081200011100',
                    'email' => 'supplier-proxy@example.com',
                    'address' => 'Jl. Supplier 1',
                    'contact_person' => 'Budi',
                ],
            ], 200),
        ]);

        $response = $this->actingAs($user)
            ->post(route('suppliers.store'), [
                'name' => 'Supplier Proxy',
                'phone' => '081200011100',
                'email' => 'supplier-proxy@example.com',
                'address' => 'Jl. Supplier 1',
                'contact_person' => 'Budi',
            ]);

        $response->assertRedirect(route('suppliers.index'));
        $response->assertSessionHas('success', 'Supplier created successfully.');
        $response->assertSessionHas('flash.supplier.id', 707);
    }

    public function test_supplier_update_proxy_returns_go_payload_shape(): void
    {
        config()->set('go_backend.features.supplier_update', true);
        config()->set('go_backend.base_url', 'http://127.0.0.1:8081');

        Permission::firstOrCreate(['name' => 'suppliers-update', 'guard_name' => 'web']);

        $supplier = \App\Models\Supplier::create([
            'name' => 'Supplier Lama',
            'phone' => '081200011101',
            'email' => 'supplier-lama@example.com',
            'address' => 'Alamat Lama',
            'contact_person' => 'Andi',
        ]);

        /** @var \App\Models\User $user */
        $user = User::factory()->create();
        $user->givePermissionTo('suppliers-update');

        Http::fake([
            'http://127.0.0.1:8081/api/v1/suppliers/' . $supplier->id => Http::response([
                'message' => 'Supplier updated successfully.',
                'supplier' => [
                    'id' => $supplier->id,
                    'name' => 'Supplier Baru',
                    'phone' => '081200011199',
                    'email' => 'supplier-baru@example.com',
                    'address' => 'Alamat Baru',
                    'contact_person' => 'Budi',
                ],
            ], 200),
        ]);

        $response = $this->actingAs($user)
            ->patch(route('suppliers.update', ['id' => $supplier->id]), [
                'name' => 'Supplier Baru',
                'phone' => '081200011199',
                'email' => 'supplier-baru@example.com',
                'address' => 'Alamat Baru',
                'contact_person' => 'Budi',
            ]);

        $response->assertRedirect(route('suppliers.index'));
        $response->assertSessionHas('success', 'Supplier updated successfully.');
        $response->assertSessionHas('flash.supplier.id', $supplier->id);
    }

    public function test_supplier_destroy_proxy_returns_go_payload_shape(): void
    {
        config()->set('go_backend.features.supplier_destroy', true);
        config()->set('go_backend.base_url', 'http://127.0.0.1:8081');

        Permission::firstOrCreate(['name' => 'suppliers-delete', 'guard_name' => 'web']);

        $supplier = \App\Models\Supplier::create([
            'name' => 'Supplier Hapus',
            'phone' => '081200011102',
            'email' => 'supplier-hapus@example.com',
            'address' => 'Alamat Hapus',
            'contact_person' => 'Dedi',
        ]);

        /** @var \App\Models\User $user */
        $user = User::factory()->create();
        $user->givePermissionTo('suppliers-delete');

        Http::fake([
            'http://127.0.0.1:8081/api/v1/suppliers/' . $supplier->id => Http::response([
                'message' => 'Supplier deleted successfully.',
                'supplier_id' => $supplier->id,
            ], 200),
        ]);

        $response = $this->actingAs($user)
            ->delete(route('suppliers.destroy', ['id' => $supplier->id]));

        $response->assertRedirect();
        $response->assertSessionHas('success', 'Supplier deleted successfully.');
    }

    public function test_supplier_store_ajax_proxy_returns_go_payload_shape(): void
    {
        config()->set('go_backend.features.supplier_store_ajax', true);
        config()->set('go_backend.base_url', 'http://127.0.0.1:8081');

        Permission::firstOrCreate(['name' => 'suppliers-create', 'guard_name' => 'web']);

        /** @var \App\Models\User $user */
        $user = User::factory()->create();
        $user->givePermissionTo('suppliers-create');

        Http::fake([
            'http://127.0.0.1:8081/api/v1/suppliers/store-ajax' => Http::response([
                'success' => true,
                'message' => 'Supplier berhasil ditambahkan',
                'supplier' => [
                    'id' => 808,
                    'name' => 'Supplier Ajax',
                    'contact_person' => 'Rudi',
                    'phone' => '081200011103',
                    'email' => 'supplier-ajax@example.com',
                    'address' => 'Jl. Supplier Ajax',
                ],
            ], 200),
        ]);

        $response = $this->actingAs($user)
            ->postJson(route('suppliers.storeAjax'), [
                'name' => 'Supplier Ajax',
                'contact_person' => 'Rudi',
                'phone' => '081200011103',
                'email' => 'supplier-ajax@example.com',
                'address' => 'Jl. Supplier Ajax',
            ]);

        $response->assertOk()
            ->assertJson([
                'success' => true,
                'message' => 'Supplier berhasil ditambahkan',
                'supplier' => [
                    'id' => 808,
                    'name' => 'Supplier Ajax',
                    'contact_person' => 'Rudi',
                    'phone' => '081200011103',
                    'email' => 'supplier-ajax@example.com',
                    'address' => 'Jl. Supplier Ajax',
                ],
            ]);
    }

    public function test_supplier_index_proxy_returns_go_payload_shape(): void
    {
        config()->set('go_backend.features.supplier_index', true);
        config()->set('go_backend.base_url', 'http://127.0.0.1:8081');

        Permission::firstOrCreate(['name' => 'suppliers-access', 'guard_name' => 'web']);

        /** @var \App\Models\User $user */
        $user = User::factory()->create();
        $user->givePermissionTo('suppliers-access');

        Http::fake([
            'http://127.0.0.1:8081/api/v1/suppliers*' => Http::response([
                'suppliers' => [
                    'current_page' => 1,
                    'data' => [
                        [
                            'id' => 1,
                            'name' => 'Supplier A',
                            'phone' => '081200011104',
                            'email' => 'supplier-a@example.com',
                            'contact_person' => 'Agus',
                        ],
                    ],
                    'from' => 1,
                    'last_page' => 1,
                    'links' => [
                        ['url' => null, 'label' => '&laquo; Previous', 'active' => false],
                        ['url' => '/suppliers', 'label' => '1', 'active' => true],
                        ['url' => null, 'label' => 'Next &raquo;', 'active' => false],
                    ],
                    'per_page' => 15,
                    'to' => 1,
                    'total' => 1,
                ],
                'filters' => [
                    'q' => 'supplier',
                ],
            ], 200),
        ]);

        $response = $this->actingAs($user)
            ->get(route('suppliers.index', ['q' => 'supplier']));

        $response->assertOk();
        $response->assertInertia(fn ($page) => $page
            ->component('Dashboard/Suppliers/Index')
            ->where('suppliers.total', 1)
            ->where('suppliers.data.0.name', 'Supplier A')
            ->where('filters.q', 'supplier')
        );
    }

    public function test_mechanic_store_proxy_returns_go_payload_shape(): void
    {
        config()->set('go_backend.features.mechanic_store', true);
        config()->set('go_backend.base_url', 'http://127.0.0.1:8081');

        Permission::firstOrCreate(['name' => 'mechanics-create', 'guard_name' => 'web']);

        /** @var \App\Models\User $user */
        $user = User::factory()->create();
        $user->givePermissionTo('mechanics-create');

        Http::fake([
            'http://127.0.0.1:8081/api/v1/mechanics' => Http::response([
                'message' => 'Mechanic created successfully.',
                'mechanic' => [
                    'id' => 901,
                    'name' => 'Budi',
                    'phone' => '081299900001',
                    'employee_number' => 'MEC-001',
                    'notes' => 'Senior',
                    'hourly_rate' => 50000,
                    'commission_percentage' => 10,
                ],
            ], 200),
        ]);

        $response = $this->actingAs($user)
            ->post(route('mechanics.store'), [
                'name' => 'Budi',
                'phone' => '081299900001',
                'employee_number' => 'MEC-001',
                'notes' => 'Senior',
                'hourly_rate' => 50000,
                'commission_percentage' => 10,
            ]);

        $response->assertRedirect();
        $response->assertSessionHas('success', 'Mechanic created successfully.');
        $response->assertSessionHas('flash.mechanic.id', 901);
    }

    public function test_mechanic_index_proxy_returns_go_payload_shape(): void
    {
        config()->set('go_backend.features.mechanic_index', true);
        config()->set('go_backend.base_url', 'http://127.0.0.1:8081');

        Permission::firstOrCreate(['name' => 'mechanics-access', 'guard_name' => 'web']);

        /** @var \App\Models\User $user */
        $user = User::factory()->create();
        $user->givePermissionTo('mechanics-access');

        Http::fake([
            'http://127.0.0.1:8081/api/v1/mechanics*' => Http::response([
                'mechanics' => [
                    'current_page' => 1,
                    'data' => [
                        [
                            'id' => 11,
                            'name' => 'Mekanik A',
                            'phone' => '081299900013',
                            'employee_number' => 'MEC-013',
                        ],
                    ],
                    'from' => 1,
                    'last_page' => 1,
                    'links' => [
                        ['url' => null, 'label' => '&laquo; Previous', 'active' => false],
                        ['url' => '/mechanics', 'label' => '1', 'active' => true],
                        ['url' => null, 'label' => 'Next &raquo;', 'active' => false],
                    ],
                    'per_page' => 15,
                    'to' => 1,
                    'total' => 1,
                ],
                'filters' => [
                    'q' => 'mekanik',
                ],
            ], 200),
        ]);

        $response = $this->actingAs($user)
            ->get(route('mechanics.index', ['q' => 'mekanik']));

        $response->assertOk();
        $response->assertInertia(fn ($page) => $page
            ->component('Dashboard/Mechanics/Index')
            ->where('mechanics.total', 1)
            ->where('mechanics.data.0.name', 'Mekanik A')
            ->where('filters.q', 'mekanik')
        );
    }

    public function test_mechanic_update_proxy_returns_go_payload_shape(): void
    {
        config()->set('go_backend.features.mechanic_update', true);
        config()->set('go_backend.base_url', 'http://127.0.0.1:8081');

        Permission::firstOrCreate(['name' => 'mechanics-update', 'guard_name' => 'web']);

        $mechanic = Mechanic::create([
            'name' => 'Mekanik Lama',
            'phone' => '081299900010',
            'employee_number' => 'MEC-010',
            'notes' => 'Lama',
            'hourly_rate' => 45000,
            'commission_percentage' => 7.5,
        ]);

        /** @var \App\Models\User $user */
        $user = User::factory()->create();
        $user->givePermissionTo('mechanics-update');

        Http::fake([
            'http://127.0.0.1:8081/api/v1/mechanics/' . $mechanic->id => Http::response([
                'message' => 'Mechanic updated successfully.',
                'mechanic' => [
                    'id' => $mechanic->id,
                    'name' => 'Mekanik Baru',
                    'phone' => '081299900011',
                    'employee_number' => 'MEC-011',
                    'notes' => 'Baru',
                    'hourly_rate' => 55000,
                    'commission_percentage' => 12,
                ],
            ], 200),
        ]);

        $response = $this->actingAs($user)
            ->patch(route('mechanics.update', ['id' => $mechanic->id]), [
                'name' => 'Mekanik Baru',
                'phone' => '081299900011',
                'employee_number' => 'MEC-011',
                'notes' => 'Baru',
                'hourly_rate' => 55000,
                'commission_percentage' => 12,
            ]);

        $response->assertRedirect();
        $response->assertSessionHas('success', 'Mechanic updated successfully.');
        $response->assertSessionHas('flash.mechanic.id', $mechanic->id);
    }

    public function test_mechanic_destroy_proxy_returns_go_payload_shape(): void
    {
        config()->set('go_backend.features.mechanic_destroy', true);
        config()->set('go_backend.base_url', 'http://127.0.0.1:8081');

        Permission::firstOrCreate(['name' => 'mechanics-delete', 'guard_name' => 'web']);

        $mechanic = Mechanic::create([
            'name' => 'Mekanik Hapus',
            'phone' => '081299900012',
            'employee_number' => 'MEC-012',
            'notes' => 'Delete',
            'hourly_rate' => 50000,
            'commission_percentage' => 10,
        ]);

        /** @var \App\Models\User $user */
        $user = User::factory()->create();
        $user->givePermissionTo('mechanics-delete');

        Http::fake([
            'http://127.0.0.1:8081/api/v1/mechanics/' . $mechanic->id => Http::response([
                'message' => 'Mechanic deleted successfully.',
                'mechanic_id' => $mechanic->id,
            ], 200),
        ]);

        $response = $this->actingAs($user)
            ->delete(route('mechanics.destroy', ['id' => $mechanic->id]));

        $response->assertRedirect();
        $response->assertSessionHas('success', 'Mechanic deleted successfully.');
    }

    public function test_low_stock_proxy_returns_go_payload_shape(): void
    {
        config()->set('go_backend.features.parts_low_stock', true);
        config()->set('go_backend.base_url', 'http://127.0.0.1:8081');

        Permission::firstOrCreate(['name' => 'parts-access', 'guard_name' => 'web']);

        /** @var \App\Models\User $user */
        $user = User::factory()->create();
        $user->givePermissionTo('parts-access');

        Http::fake([
            'http://127.0.0.1:8081/api/v1/parts/low-stock*' => Http::response([
                'alerts' => [
                    'current_page' => 1,
                    'data' => [
                        [
                            'id' => 7,
                            'current_stock' => 1,
                            'minimal_stock' => 5,
                            'is_read' => true,
                            'created_at' => '2026-04-08 12:00:00',
                            'part' => [
                                'id' => 21,
                                'name' => 'Oli Mesin',
                                'part_number' => 'OLI-001',
                                'rack_location' => 'A-01',
                                'supplier' => [
                                    'id' => 3,
                                    'name' => 'Supplier A',
                                ],
                            ],
                        ],
                    ],
                    'from' => 1,
                    'last_page' => 1,
                    'links' => [
                        ['url' => null, 'label' => '&laquo; Previous', 'active' => false],
                        ['url' => '/parts/low-stock', 'label' => '1', 'active' => true],
                        ['url' => null, 'label' => 'Next &raquo;', 'active' => false],
                    ],
                    'per_page' => 10,
                    'to' => 1,
                    'total' => 1,
                ],
                'filters' => [
                    'sort_by' => 'created_at',
                    'sort_direction' => 'desc',
                ],
            ], 200),
        ]);

        $response = $this->actingAs($user)
            ->get(route('parts.low-stock', [
                'sort_by' => 'created_at',
                'sort_direction' => 'desc',
            ]));

        $response->assertOk();
        $response->assertInertia(fn ($page) => $page
            ->component('Dashboard/Parts/LowStock')
            ->where('alerts.total', 1)
            ->where('alerts.data.0.part.name', 'Oli Mesin')
            ->where('filters.sort_by', 'created_at')
        );
    }

    public function test_part_stock_history_proxy_returns_go_payload_shape(): void
    {
        config()->set('go_backend.features.part_stock_history_index', true);
        config()->set('go_backend.base_url', 'http://127.0.0.1:8081');

        Permission::firstOrCreate(['name' => 'part-stock-history-access', 'guard_name' => 'web']);

        /** @var \App\Models\User $user */
        $user = User::factory()->create();
        $user->givePermissionTo('part-stock-history-access');

        Http::fake([
            'http://127.0.0.1:8081/api/v1/part-stock-history*' => Http::response([
                'movements' => [
                    'current_page' => 1,
                    'data' => [
                        [
                            'id' => 11,
                            'type' => 'purchase',
                            'qty' => 5,
                            'before_stock' => 10,
                            'after_stock' => 15,
                            'reference_type' => 'App\\Models\\PartPurchase',
                            'reference_id' => 2,
                            'notes' => 'Restock rutin',
                            'created_at' => '2026-04-08 09:30:00',
                            'part' => [
                                'id' => 8,
                                'name' => 'Kampas Rem',
                                'part_number' => 'KR-008',
                            ],
                            'supplier' => [
                                'id' => 3,
                                'name' => 'Supplier A',
                            ],
                            'user' => [
                                'id' => 5,
                                'name' => 'Admin',
                            ],
                            'reference' => [
                                'purchase_number' => 'PUR-20260408-0001',
                            ],
                        ],
                    ],
                    'from' => 1,
                    'last_page' => 1,
                    'links' => [
                        ['url' => null, 'label' => '&laquo; Previous', 'active' => false],
                        ['url' => '/part-stock-history', 'label' => '1', 'active' => true],
                        ['url' => null, 'label' => 'Next &raquo;', 'active' => false],
                    ],
                    'per_page' => 20,
                    'to' => 1,
                    'total' => 1,
                ],
                'parts' => [
                    ['id' => 8, 'name' => 'Kampas Rem'],
                ],
                'types' => ['purchase', 'sale'],
                'filters' => [
                    'q' => 'restock',
                    'part_id' => '8',
                    'type' => 'purchase',
                    'date_from' => '2026-04-01',
                    'date_to' => '2026-04-08',
                ],
            ], 200),
        ]);

        $response = $this->actingAs($user)
            ->get(route('part-stock-history.index', [
                'q' => 'restock',
                'part_id' => 8,
                'type' => 'purchase',
                'date_from' => '2026-04-01',
                'date_to' => '2026-04-08',
            ]));

        $response->assertOk();
        $response->assertInertia(fn ($page) => $page
            ->component('Dashboard/PartStockHistory/Index')
            ->where('movements.total', 1)
            ->where('movements.data.0.part.name', 'Kampas Rem')
            ->where('parts.0.name', 'Kampas Rem')
            ->where('filters.type', 'purchase')
        );
    }

    public function test_part_stock_history_export_proxy_returns_go_csv_payload_shape(): void
    {
        config()->set('go_backend.features.part_stock_history_export', true);
        config()->set('go_backend.base_url', 'http://127.0.0.1:8081');

        Permission::firstOrCreate(['name' => 'part-stock-history-access', 'guard_name' => 'web']);

        /** @var \App\Models\User $user */
        $user = User::factory()->create();
        $user->givePermissionTo('part-stock-history-access');

        Http::fake([
            'http://127.0.0.1:8081/api/v1/part-stock-history/export*' => Http::response(
                "Date,Part,Type,Qty,Before Stock,After Stock,Reference,Supplier,User,Notes\n" .
                "2026-04-08 09:30:00,Kampas Rem,purchase,5,10,15,PUR-20260408-0001,Supplier A,Admin,Restock rutin\n",
                200,
                [
                    'Content-Type' => 'text/csv',
                    'Content-Disposition' => 'attachment; filename=part-stock-history-export.csv',
                ]
            ),
        ]);

        $response = $this->actingAs($user)
            ->get(route('part-stock-history.export', [
                'q' => 'restock',
                'type' => 'purchase',
            ]));

        $response->assertStatus(200);
        $this->assertStringStartsWith('text/csv', (string) $response->headers->get('Content-Type'));
        $response->assertHeader('Content-Disposition', 'attachment; filename=part-stock-history-export.csv');
        $this->assertStringContainsString('Date,Part,Type,Qty', $response->getContent());
    }

    public function test_part_sales_index_proxy_returns_go_payload_shape(): void
    {
        config()->set('go_backend.features.part_sale_index', true);
        config()->set('go_backend.base_url', 'http://127.0.0.1:8081');

        Permission::firstOrCreate(['name' => 'part-sales-access', 'guard_name' => 'web']);

        /** @var \App\Models\User $user */
        $user = User::factory()->create();
        $user->givePermissionTo('part-sales-access');

        Http::fake([
            'http://127.0.0.1:8081/api/v1/part-sales*' => Http::response([
                'sales' => [
                    'current_page' => 1,
                    'data' => [
                        [
                            'id' => 31,
                            'sale_number' => 'SAL202604080001',
                            'sale_date' => '2026-04-08',
                            'grand_total' => 320000,
                            'payment_status' => 'partial',
                            'status' => 'confirmed',
                            'customer' => [
                                'id' => 7,
                                'name' => 'Customer A',
                            ],
                        ],
                    ],
                    'from' => 1,
                    'last_page' => 1,
                    'links' => [
                        ['url' => null, 'label' => '&laquo; Previous', 'active' => false],
                        ['url' => '/part-sales', 'label' => '1', 'active' => true],
                        ['url' => null, 'label' => 'Next &raquo;', 'active' => false],
                    ],
                    'per_page' => 15,
                    'to' => 1,
                    'total' => 1,
                ],
                'filters' => [
                    'search' => 'SAL2026',
                    'status' => 'confirmed',
                    'payment_status' => 'partial',
                    'customer_id' => '7',
                ],
            ], 200),
        ]);

        $response = $this->actingAs($user)
            ->get(route('part-sales.index', [
                'search' => 'SAL2026',
                'status' => 'confirmed',
                'payment_status' => 'partial',
                'customer_id' => 7,
            ]));

        $response->assertOk();
        $response->assertInertia(fn ($page) => $page
            ->component('Dashboard/Parts/Sales/Index')
            ->where('sales.total', 1)
            ->where('sales.data.0.sale_number', 'SAL202604080001')
            ->where('sales.data.0.customer.name', 'Customer A')
            ->where('filters.payment_status', 'partial')
        );
    }

    public function test_part_purchase_index_proxy_returns_go_payload_shape(): void
    {
        config()->set('go_backend.features.part_purchase_index', true);
        config()->set('go_backend.base_url', 'http://127.0.0.1:8081');

        Permission::firstOrCreate(['name' => 'part-purchases-access', 'guard_name' => 'web']);

        /** @var \App\Models\User $user */
        $user = User::factory()->create();
        $user->givePermissionTo('part-purchases-access');

        Http::fake([
            'http://127.0.0.1:8081/api/v1/part-purchases*' => Http::response([
                'purchases' => [
                    'current_page' => 1,
                    'data' => [
                        [
                            'id' => 12,
                            'purchase_number' => 'PUR-0012',
                            'status' => 'pending',
                            'purchase_date' => '2026-04-08',
                            'total_amount' => 450000,
                            'supplier' => [
                                'id' => 5,
                                'name' => 'Supplier A',
                            ],
                            'details' => [
                                [
                                    'id' => 1,
                                    'part_id' => 3,
                                    'quantity' => 2,
                                    'unit_price' => 100000,
                                    'subtotal' => 200000,
                                ],
                            ],
                        ],
                    ],
                    'from' => 1,
                    'last_page' => 1,
                    'links' => [
                        ['url' => null, 'label' => '&laquo; Previous', 'active' => false],
                        ['url' => '/part-purchases', 'label' => '1', 'active' => true],
                        ['url' => null, 'label' => 'Next &raquo;', 'active' => false],
                    ],
                    'per_page' => 15,
                    'to' => 1,
                    'total' => 1,
                ],
                'suppliers' => [
                    ['id' => 5, 'name' => 'Supplier A'],
                ],
                'filters' => [
                    'q' => 'PUR-0012',
                    'supplier_id' => '5',
                    'status' => 'pending',
                    'date_from' => '2026-04-01',
                    'date_to' => '2026-04-08',
                ],
            ], 200),
        ]);

        $response = $this->actingAs($user)
            ->get(route('part-purchases.index', [
                'q' => 'PUR-0012',
                'supplier_id' => 5,
                'status' => 'pending',
                'date_from' => '2026-04-01',
                'date_to' => '2026-04-08',
            ]));

        $response->assertOk();
        $response->assertInertia(fn ($page) => $page
            ->component('Dashboard/PartPurchases/Index')
            ->where('purchases.total', 1)
            ->where('purchases.data.0.purchase_number', 'PUR-0012')
            ->where('purchases.data.0.supplier.name', 'Supplier A')
            ->where('suppliers.0.name', 'Supplier A')
            ->where('filters.status', 'pending')
        );
    }

    public function test_part_purchase_create_proxy_returns_go_payload_shape(): void
    {
        config()->set('go_backend.features.part_purchase_create', true);
        config()->set('go_backend.base_url', 'http://127.0.0.1:8081');

        Permission::firstOrCreate(['name' => 'part-purchases-create', 'guard_name' => 'web']);

        /** @var \App\Models\User $user */
        $user = User::factory()->create();
        $user->givePermissionTo('part-purchases-create');

        Http::fake([
            'http://127.0.0.1:8081/api/v1/part-purchases/create' => Http::response([
                'suppliers' => [
                    [
                        'id' => 5,
                        'name' => 'Supplier A',
                        'phone' => '081200011104',
                        'address' => 'Jl. Supplier A',
                    ],
                ],
                'parts' => [
                    [
                        'id' => 3,
                        'name' => 'Kampas Rem',
                        'part_number' => 'KR-003',
                        'buy_price' => 100000,
                        'stock' => 12,
                        'status' => 'active',
                        'category' => [
                            'id' => 9,
                            'name' => 'Sparepart',
                        ],
                    ],
                ],
                'categories' => [
                    [
                        'id' => 9,
                        'name' => 'Sparepart',
                    ],
                ],
            ], 200),
        ]);

        $response = $this->actingAs($user)
            ->get(route('part-purchases.create'));

        $response->assertOk();
        $response->assertInertia(fn ($page) => $page
            ->component('Dashboard/PartPurchases/Create')
            ->where('suppliers.0.name', 'Supplier A')
            ->where('parts.0.part_number', 'KR-003')
            ->where('categories.0.name', 'Sparepart')
        );
    }

    public function test_part_purchase_store_proxy_returns_go_payload_shape(): void
    {
        config()->set('go_backend.features.part_purchase_store', true);
        config()->set('go_backend.base_url', 'http://127.0.0.1:8081');

        Permission::firstOrCreate(['name' => 'part-purchases-create', 'guard_name' => 'web']);

        /** @var \App\Models\User $user */
        $user = User::factory()->create();
        $user->givePermissionTo('part-purchases-create');

        $supplier = Supplier::create([
            'name' => 'Supplier Bridge Store',
            'phone' => '081200011106',
            'address' => 'Jl. Supplier Store Bridge',
        ]);

        $part = Part::create([
            'part_number' => 'KR-ST-001',
            'name' => 'Kampas Rem Store',
            'part_category_id' => null,
            'buy_price' => 100000,
            'sell_price' => 120000,
            'stock' => 10,
            'status' => 'active',
        ]);

        Http::fake([
            'http://127.0.0.1:8081/api/v1/part-purchases' => Http::response([
                'ok' => true,
                'message' => 'Purchase created successfully',
                'purchase_id' => 999,
                'purchase_number' => 'PUR-20260409-0001',
            ], 200),
        ]);

        $response = $this->actingAs($user)
            ->post(route('part-purchases.store'), [
                'supplier_id' => $supplier->id,
                'purchase_date' => '2026-04-09',
                'expected_delivery_date' => '2026-04-11',
                'notes' => 'Pembelian untuk uji store bridge',
                'items' => [
                    [
                        'part_id' => $part->id,
                        'quantity' => 2,
                        'unit_price' => 100000,
                        'discount_type' => 'none',
                        'discount_value' => 0,
                        'margin_type' => 'percent',
                        'margin_value' => 20,
                        'promo_discount_type' => 'none',
                        'promo_discount_value' => 0,
                    ],
                ],
                'discount_type' => 'percent',
                'discount_value' => 5,
                'tax_type' => 'percent',
                'tax_value' => 11,
            ]);

        $response->assertRedirect(route('part-purchases.show', ['id' => 999]));
        $response->assertSessionHas('success', 'Purchase created successfully');
    }

    public function test_part_purchase_store_proxy_maps_go_validation_errors(): void
    {
        config()->set('go_backend.features.part_purchase_store', true);
        config()->set('go_backend.base_url', 'http://127.0.0.1:8081');

        Permission::firstOrCreate(['name' => 'part-purchases-create', 'guard_name' => 'web']);

        /** @var \App\Models\User $user */
        $user = User::factory()->create();
        $user->givePermissionTo('part-purchases-create');

        Http::fake([
            'http://127.0.0.1:8081/api/v1/part-purchases' => Http::response([
                'message' => 'The given data was invalid.',
                'errors' => [
                    'supplier_id' => ['The supplier id field is required.'],
                ],
            ], 422),
        ]);

        $response = $this->from(route('part-purchases.create'))
            ->actingAs($user)
            ->post(route('part-purchases.store'), [
                'purchase_date' => '2026-04-09',
                'items' => [
                    [
                        'part_id' => 1,
                        'quantity' => 1,
                        'unit_price' => 100000,
                        'margin_type' => 'percent',
                        'margin_value' => 20,
                    ],
                ],
            ]);

        $response->assertRedirect(route('part-purchases.create'));
        $response->assertSessionHasErrors('supplier_id');
    }

    public function test_part_purchase_edit_proxy_returns_go_payload_shape(): void
    {
        config()->set('go_backend.features.part_purchase_edit', true);
        config()->set('go_backend.base_url', 'http://127.0.0.1:8081');

        Permission::firstOrCreate(['name' => 'part-purchases-update', 'guard_name' => 'web']);

        /** @var \App\Models\User $user */
        $user = User::factory()->create();
        $user->givePermissionTo('part-purchases-update');

        $purchase = PartPurchase::create([
            'purchase_number' => 'PUR-20260408-0110',
            'supplier_id' => null,
            'purchase_date' => '2026-04-08',
            'status' => 'pending',
            'total_amount' => 250000,
            'notes' => 'Pembelian untuk uji edit bridge',
        ]);

        Http::fake([
            'http://127.0.0.1:8081/api/v1/part-purchases/' . $purchase->id . '/edit' => Http::response([
                'purchase' => [
                    'id' => $purchase->id,
                    'purchase_number' => 'PUR-20260408-0110',
                    'purchase_date' => '2026-04-08',
                    'status' => 'pending',
                    'total_amount' => 250000,
                    'notes' => 'Pembelian untuk uji edit bridge',
                    'supplier' => [
                        'id' => 5,
                        'name' => 'Supplier A',
                    ],
                    'details' => [
                        [
                            'id' => 1,
                            'part_id' => 3,
                            'quantity' => 2,
                            'unit_price' => 100000,
                            'subtotal' => 200000,
                            'discount_type' => 'none',
                            'discount_value' => 0,
                            'margin_type' => 'percent',
                            'margin_value' => 20,
                            'promo_discount_type' => 'none',
                            'promo_discount_value' => 0,
                            'part' => [
                                'id' => 3,
                                'name' => 'Kampas Rem',
                                'part_number' => 'KR-003',
                                'category' => [
                                    'id' => 9,
                                    'name' => 'Sparepart',
                                ],
                            ],
                        ],
                    ],
                ],
                'suppliers' => [
                    [
                        'id' => 5,
                        'name' => 'Supplier A',
                    ],
                ],
                'parts' => [
                    [
                        'id' => 3,
                        'name' => 'Kampas Rem',
                        'part_number' => 'KR-003',
                        'buy_price' => 100000,
                        'stock' => 12,
                        'status' => 'active',
                        'category' => [
                            'id' => 9,
                            'name' => 'Sparepart',
                        ],
                    ],
                ],
                'categories' => [
                    [
                        'id' => 9,
                        'name' => 'Sparepart',
                    ],
                ],
            ], 200),
        ]);

        $response = $this->actingAs($user)
            ->get(route('part-purchases.edit', ['id' => $purchase->id]));

        $response->assertOk();
        $response->assertInertia(fn ($page) => $page
            ->component('Dashboard/PartPurchases/Edit')
            ->where('purchase.purchase_number', 'PUR-20260408-0110')
            ->where('suppliers.0.name', 'Supplier A')
            ->where('parts.0.part_number', 'KR-003')
            ->where('categories.0.name', 'Sparepart')
        );
    }

    public function test_part_purchase_show_proxy_returns_go_payload_shape(): void
    {
        config()->set('go_backend.features.part_purchase_show', true);
        config()->set('go_backend.base_url', 'http://127.0.0.1:8081');

        Permission::firstOrCreate(['name' => 'part-purchases-access', 'guard_name' => 'web']);

        /** @var \App\Models\User $user */
        $user = User::factory()->create();
        $user->givePermissionTo('part-purchases-access');

        $purchase = PartPurchase::create([
            'purchase_number' => 'PUR-20260408-0099',
            'supplier_id' => null,
            'purchase_date' => '2026-04-08',
            'status' => 'pending',
            'total_amount' => 250000,
            'notes' => 'Pembelian untuk uji bridge',
        ]);

        Http::fake([
            'http://127.0.0.1:8081/api/v1/part-purchases/' . $purchase->id => Http::response([
                'purchase' => [
                    'id' => $purchase->id,
                    'purchase_number' => 'PUR-20260408-0099',
                    'purchase_date' => '2026-04-08',
                    'expected_delivery_date' => '2026-04-10',
                    'actual_delivery_date' => null,
                    'status' => 'pending',
                    'total_amount' => 250000,
                    'notes' => 'Pembelian untuk uji bridge',
                    'discount_type' => 'percent',
                    'discount_value' => 5,
                    'discount_amount' => 12500,
                    'tax_type' => 'percent',
                    'tax_value' => 11,
                    'tax_amount' => 26125,
                    'grand_total' => 263625,
                    'unit_cost' => 100000,
                    'margin_type' => 'percent',
                    'margin_value' => 20,
                    'promo_discount_type' => 'none',
                    'promo_discount_value' => 0,
                    'created_at' => '2026-04-08 08:30:00',
                    'updated_at' => '2026-04-08 08:30:00',
                    'supplier' => [
                        'id' => 5,
                        'name' => 'Supplier A',
                        'phone' => '081200011104',
                        'address' => 'Jl. Supplier A',
                    ],
                    'details' => [
                        [
                            'id' => 1,
                            'part_id' => 3,
                            'quantity' => 2,
                            'unit_price' => 100000,
                            'subtotal' => 200000,
                            'discount_type' => 'none',
                            'discount_value' => 0,
                            'discount_amount' => 0,
                            'final_amount' => 200000,
                            'margin_type' => 'percent',
                            'margin_value' => 20,
                            'margin_amount' => 40000,
                            'normal_unit_price' => 120000,
                            'promo_discount_type' => 'none',
                            'promo_discount_value' => 0,
                            'promo_discount_amount' => 0,
                            'selling_price' => 120000,
                            'part' => [
                                'id' => 3,
                                'name' => 'Kampas Rem',
                                'part_number' => 'KR-003',
                                'category' => [
                                    'id' => 9,
                                    'name' => 'Sparepart',
                                ],
                            ],
                        ],
                    ],
                ],
            ], 200),
        ]);

        $response = $this->actingAs($user)
            ->get(route('part-purchases.show', ['id' => $purchase->id]));

        $response->assertOk();
        $response->assertInertia(fn ($page) => $page
            ->component('Dashboard/PartPurchases/Show')
            ->where('purchase.purchase_number', 'PUR-20260408-0099')
            ->where('purchase.supplier.name', 'Supplier A')
            ->where('purchase.details.0.part.name', 'Kampas Rem')
            ->where('purchase.details.0.part.category.name', 'Sparepart')
        );
    }

    public function test_part_purchase_print_proxy_returns_go_payload_shape(): void
    {
        config()->set('go_backend.features.part_purchase_print', true);
        config()->set('go_backend.base_url', 'http://127.0.0.1:8081');

        Permission::firstOrCreate(['name' => 'part-purchases-access', 'guard_name' => 'web']);

        /** @var \App\Models\User $user */
        $user = User::factory()->create();
        $user->givePermissionTo('part-purchases-access');

        $purchase = PartPurchase::create([
            'purchase_number' => 'PUR-20260408-0100',
            'supplier_id' => null,
            'purchase_date' => '2026-04-08',
            'status' => 'pending',
            'total_amount' => 250000,
            'notes' => 'Pembelian untuk uji print bridge',
        ]);

        Http::fake([
            'http://127.0.0.1:8081/api/v1/part-purchases/' . $purchase->id . '/print' => Http::response([
                'purchase' => [
                    'id' => $purchase->id,
                    'purchase_number' => 'PUR-20260408-0100',
                    'purchase_date' => '2026-04-08',
                    'expected_delivery_date' => '2026-04-10',
                    'actual_delivery_date' => null,
                    'status' => 'pending',
                    'total_amount' => 250000,
                    'notes' => 'Pembelian untuk uji print bridge',
                    'discount_type' => 'percent',
                    'discount_value' => 5,
                    'discount_amount' => 12500,
                    'tax_type' => 'percent',
                    'tax_value' => 11,
                    'tax_amount' => 26125,
                    'grand_total' => 263625,
                    'unit_cost' => 100000,
                    'margin_type' => 'percent',
                    'margin_value' => 20,
                    'promo_discount_type' => 'none',
                    'promo_discount_value' => 0,
                    'created_at' => '2026-04-08 08:30:00',
                    'updated_at' => '2026-04-08 08:30:00',
                    'supplier' => [
                        'id' => 5,
                        'name' => 'Supplier A',
                        'phone' => '081200011104',
                        'address' => 'Jl. Supplier A',
                    ],
                    'details' => [
                        [
                            'id' => 1,
                            'part_id' => 3,
                            'quantity' => 2,
                            'unit_price' => 100000,
                            'subtotal' => 200000,
                            'discount_type' => 'none',
                            'discount_value' => 0,
                            'discount_amount' => 0,
                            'final_amount' => 200000,
                            'margin_type' => 'percent',
                            'margin_value' => 20,
                            'margin_amount' => 40000,
                            'normal_unit_price' => 120000,
                            'promo_discount_type' => 'none',
                            'promo_discount_value' => 0,
                            'promo_discount_amount' => 0,
                            'selling_price' => 120000,
                            'part' => [
                                'id' => 3,
                                'name' => 'Kampas Rem',
                                'part_number' => 'KR-003',
                                'category' => [
                                    'id' => 9,
                                    'name' => 'Sparepart',
                                ],
                            ],
                        ],
                    ],
                ],
                'businessProfile' => [
                    'business_name' => 'POS Bengkel',
                    'business_phone' => '081234567890',
                    'business_address' => 'Jl. Bengkel No. 1',
                ],
            ], 200),
        ]);

        $response = $this->actingAs($user)
            ->get(route('part-purchases.print', ['id' => $purchase->id]));

        $response->assertOk();
        $response->assertInertia(fn ($page) => $page
            ->component('Dashboard/PartPurchases/Print')
            ->where('purchase.purchase_number', 'PUR-20260408-0100')
            ->where('purchase.details.0.part.category.name', 'Sparepart')
            ->where('businessProfile.business_name', 'POS Bengkel')
        );
    }

    public function test_part_purchase_update_proxy_returns_go_payload_shape(): void
    {
        config()->set('go_backend.features.part_purchase_update', true);
        config()->set('go_backend.base_url', 'http://127.0.0.1:8081');

        Permission::firstOrCreate(['name' => 'part-purchases-update', 'guard_name' => 'web']);

        /** @var \App\Models\User $user */
        $user = User::factory()->create();
        $user->givePermissionTo('part-purchases-update');

        $supplier = Supplier::create([
            'name' => 'Supplier Bridge Update',
            'phone' => '081200011105',
            'address' => 'Jl. Supplier Bridge',
        ]);

        $purchase = PartPurchase::create([
            'purchase_number' => 'PUR-20260408-0115',
            'supplier_id' => $supplier->id,
            'purchase_date' => '2026-04-08',
            'status' => 'pending',
            'total_amount' => 100000,
            'notes' => 'Pembelian untuk uji update bridge',
        ]);

        $part = Part::create([
            'part_number' => 'KR-UP-001',
            'name' => 'Kampas Rem Update',
            'part_category_id' => null,
            'buy_price' => 100000,
            'sell_price' => 120000,
            'stock' => 10,
            'status' => 'active',
        ]);

        Http::fake([
            'http://127.0.0.1:8081/api/v1/part-purchases/' . $purchase->id => Http::response([
                'ok' => true,
                'message' => 'Purchase updated successfully',
                'purchase_id' => $purchase->id,
            ], 200),
        ]);

        $response = $this->actingAs($user)
            ->put(route('part-purchases.update', ['id' => $purchase->id]), [
                'supplier_id' => $supplier->id,
                'purchase_date' => '2026-04-08',
                'expected_delivery_date' => '2026-04-10',
                'notes' => 'Pembelian yang sudah diupdate',
                'items' => [
                    [
                        'part_id' => $part->id,
                        'quantity' => 2,
                        'unit_price' => 100000,
                        'discount_type' => 'none',
                        'discount_value' => 0,
                        'margin_type' => 'percent',
                        'margin_value' => 20,
                        'promo_discount_type' => 'none',
                        'promo_discount_value' => 0,
                    ],
                ],
                'discount_type' => 'percent',
                'discount_value' => 5,
                'tax_type' => 'percent',
                'tax_value' => 11,
            ]);

        $response->assertRedirect(route('part-purchases.show', ['id' => $purchase->id]));
        $response->assertSessionHas('success', 'Purchase updated successfully');
    }

    public function test_part_purchase_update_status_proxy_returns_go_payload_shape(): void
    {
        config()->set('go_backend.features.part_purchase_update_status', true);
        config()->set('go_backend.base_url', 'http://127.0.0.1:8081');

        Permission::firstOrCreate(['name' => 'part-purchases-update', 'guard_name' => 'web']);

        /** @var \App\Models\User $user */
        $user = User::factory()->create();
        $user->givePermissionTo('part-purchases-update');

        $purchase = PartPurchase::create([
            'purchase_number' => 'PUR-20260408-0001',
            'supplier_id' => null,
            'purchase_date' => '2026-04-08',
            'status' => 'pending',
            'total_amount' => 100000,
            'notes' => 'Pembelian sparepart',
        ]);

        Http::fake([
            'http://127.0.0.1:8081/api/v1/part-purchases/' . $purchase->id . '/update-status' => Http::response([
                'ok' => true,
                'message' => 'Purchase status updated to: received',
            ], 200),
        ]);

        $response = $this->actingAs($user)
            ->post(route('part-purchases.update-status', ['id' => $purchase->id]), [
                'status' => 'received',
                'actual_delivery_date' => '2026-04-08',
            ]);

        $response->assertRedirect();
        $response->assertSessionHas('success', 'Purchase status updated to: received');
    }

    public function test_appointment_index_proxy_returns_go_payload_shape(): void
    {
        config()->set('go_backend.features.appointment_index', true);
        config()->set('go_backend.base_url', 'http://127.0.0.1:8081');

        Permission::firstOrCreate(['name' => 'appointments-access', 'guard_name' => 'web']);

        /** @var \App\Models\User $user */
        $user = User::factory()->create();
        $user->givePermissionTo('appointments-access');

        Http::fake([
            'http://127.0.0.1:8081/api/v1/appointments*' => Http::response([
                'appointments' => [
                    'current_page' => 1,
                    'data' => [
                        [
                            'id' => 99,
                            'status' => 'scheduled',
                            'customer' => [
                                'id' => 1,
                                'name' => 'Customer A',
                                'phone' => '081234567890',
                            ],
                            'vehicle' => [
                                'id' => 2,
                                'plate_number' => 'B1234CD',
                                'brand' => 'Honda',
                                'model' => 'Vario',
                            ],
                            'mechanic' => [
                                'id' => 3,
                                'name' => 'Budi',
                                'specialty' => 'Engine',
                            ],
                            'mechanic_id' => 3,
                            'scheduled_at' => '2026-04-08 09:00:00',
                            'notes' => 'Cek berkala',
                        ],
                    ],
                    'from' => 1,
                    'last_page' => 1,
                    'links' => [
                        ['url' => null, 'label' => '&laquo; Previous', 'active' => false],
                        ['url' => '/appointments', 'label' => '1', 'active' => true],
                        ['url' => null, 'label' => 'Next &raquo;', 'active' => false],
                    ],
                    'per_page' => 20,
                    'to' => 1,
                    'total' => 1,
                ],
                'stats' => [
                    'scheduled' => 1,
                    'confirmed' => 0,
                    'completed' => 0,
                    'cancelled' => 0,
                    'today' => 1,
                ],
                'mechanics' => [
                    ['id' => 3, 'name' => 'Budi'],
                ],
                'filters' => [
                    'search' => 'B1234CD',
                    'status' => 'scheduled',
                    'date_from' => '2026-04-08',
                    'date_to' => '2026-04-08',
                    'mechanic_id' => '3',
                ],
            ], 200),
        ]);

        $response = $this->actingAs($user)
            ->getJson(route('appointments.index', [
                'search' => 'B1234CD',
                'status' => 'scheduled',
                'date_from' => '2026-04-08',
                'date_to' => '2026-04-08',
                'mechanic_id' => 3,
            ]));

        $response->assertStatus(200)
            ->assertJsonStructure([
                'appointments' => [
                    'current_page',
                    'data',
                    'links',
                    'total',
                ],
                'stats' => [
                    'scheduled',
                    'confirmed',
                    'completed',
                    'cancelled',
                    'today',
                ],
                'mechanics',
                'filters',
            ])
            ->assertJson([
                'appointments' => [
                    'total' => 1,
                ],
                'stats' => [
                    'scheduled' => 1,
                ],
            ]);
    }

    public function test_appointment_calendar_proxy_returns_go_payload_shape(): void
    {
        config()->set('go_backend.features.appointment_calendar', true);
        config()->set('go_backend.base_url', 'http://127.0.0.1:8081');

        Permission::firstOrCreate(['name' => 'appointments-access', 'guard_name' => 'web']);

        /** @var \App\Models\User $user */
        $user = User::factory()->create();
        $user->givePermissionTo('appointments-access');

        Http::fake([
            'http://127.0.0.1:8081/api/v1/appointments/calendar*' => Http::response([
                'calendar_days' => [
                    null,
                    [
                        'date' => '2026-04-01',
                        'day_num' => 1,
                        'appointments' => [
                            [
                                'id' => 101,
                                'status' => 'scheduled',
                                'customer' => ['name' => 'Customer A'],
                                'mechanic' => ['id' => 5, 'name' => 'Budi'],
                                'mechanic_id' => 5,
                                'scheduled_at' => '2026-04-01 09:00:00',
                            ],
                        ],
                    ],
                ],
                'current_date' => '2026-04-08T10:00:00+07:00',
                'year' => 2026,
                'month' => 4,
                'mechanics' => [
                    ['id' => 5, 'name' => 'Budi'],
                ],
            ], 200),
        ]);

        $response = $this->actingAs($user)
            ->getJson(route('appointments.calendar', [
                'year' => 2026,
                'month' => 4,
            ]));

        $response->assertStatus(200)
            ->assertJsonStructure([
                'calendar_days',
                'current_date',
                'year',
                'month',
                'mechanics',
            ])
            ->assertJson([
                'year' => 2026,
                'month' => 4,
            ]);
    }

    public function test_appointment_slots_proxy_returns_go_payload_shape(): void
    {
        config()->set('go_backend.features.appointment_slots', true);
        config()->set('go_backend.base_url', 'http://127.0.0.1:8081');

        Permission::firstOrCreate(['name' => 'appointments-access', 'guard_name' => 'web']);

        /** @var \App\Models\User $user */
        $user = User::factory()->create();
        $user->givePermissionTo('appointments-access');

        $mechanic = Mechanic::create([
            'name' => 'Budi',
            'status' => 'active',
        ]);

        Http::fake([
            'http://127.0.0.1:8081/api/v1/appointments/slots*' => Http::response([
                'available_slots' => [
                    [
                        'time' => '09:00',
                        'display' => '09:00 - 11:00',
                        'timestamp' => '2026-04-08 09:00:00',
                    ],
                ],
                'mechanic_name' => 'Budi',
            ], 200),
        ]);

        $response = $this->actingAs($user)
            ->getJson(route('appointments.available-slots', [
                'mechanic_id' => $mechanic->id,
                'date' => '2026-04-08',
            ]));

        $response->assertStatus(200)
            ->assertJsonStructure([
                'available_slots',
                'mechanic_name',
            ])
            ->assertJson([
                'mechanic_name' => 'Budi',
            ]);
    }

    public function test_appointment_store_proxy_returns_go_payload_shape(): void
    {
        config()->set('go_backend.features.appointment_store', true);
        config()->set('go_backend.base_url', 'http://127.0.0.1:8081');

        Permission::firstOrCreate(['name' => 'appointments-create', 'guard_name' => 'web']);

        $customer = Customer::create([
            'name' => 'Customer A',
            'phone' => '081234567890',
        ]);

        $vehicle = Vehicle::create([
            'customer_id' => $customer->id,
            'plate_number' => 'B1234CD',
            'brand' => 'Honda',
            'model' => 'Vario',
        ]);

        $mechanic = Mechanic::create([
            'name' => 'Budi',
            'status' => 'active',
        ]);

        /** @var \App\Models\User $user */
        $user = User::factory()->create();
        $user->givePermissionTo('appointments-create');

        Http::fake([
            'http://127.0.0.1:8081/api/v1/appointments' => Http::response([
                'message' => 'Appointment berhasil dijadwalkan.',
                'appointment' => [
                    'id' => 501,
                    'customer_id' => $customer->id,
                    'vehicle_id' => $vehicle->id,
                    'mechanic_id' => $mechanic->id,
                    'scheduled_at' => '2026-04-08 09:00:00',
                    'status' => 'scheduled',
                    'notes' => 'Cek berkala',
                    'mechanic' => [
                        'id' => $mechanic->id,
                        'name' => 'Budi',
                    ],
                ],
            ], 201),
        ]);

        $response = $this->actingAs($user)
            ->post(route('appointments.store'), [
                'customer_id' => $customer->id,
                'vehicle_id' => $vehicle->id,
                'mechanic_id' => $mechanic->id,
                'scheduled_at' => '2026-04-08 09:00:00',
                'notes' => 'Cek berkala',
            ]);

        $response->assertRedirect(route('appointments.calendar'));
        $response->assertSessionHas('success', 'Appointment berhasil dijadwalkan.');
    }

    public function test_appointment_update_status_proxy_returns_go_payload_shape(): void
    {
        config()->set('go_backend.features.appointment_update_status', true);
        config()->set('go_backend.base_url', 'http://127.0.0.1:8081');

        Permission::firstOrCreate(['name' => 'appointments-update', 'guard_name' => 'web']);

        $customer = Customer::create([
            'name' => 'Customer A',
            'phone' => '081234567890',
        ]);

        $vehicle = Vehicle::create([
            'customer_id' => $customer->id,
            'plate_number' => 'B1234CD',
            'brand' => 'Honda',
            'model' => 'Vario',
        ]);

        $mechanic = Mechanic::create([
            'name' => 'Budi',
            'status' => 'active',
        ]);

        $appointment = \App\Models\Appointment::create([
            'customer_id' => $customer->id,
            'vehicle_id' => $vehicle->id,
            'mechanic_id' => $mechanic->id,
            'scheduled_at' => '2026-04-08 09:00:00',
            'status' => 'scheduled',
            'notes' => 'Cek berkala',
        ]);

        /** @var \App\Models\User $user */
        $user = User::factory()->create();
        $user->givePermissionTo('appointments-update');

        Http::fake([
            'http://127.0.0.1:8081/api/v1/appointments/' . $appointment->id . '/status' => Http::response([
                'message' => 'Appointment updated.',
                'appointment' => [
                    'id' => $appointment->id,
                    'status' => 'confirmed',
                ],
            ], 200),
        ]);

        $response = $this->actingAs($user)
            ->patch(route('appointments.updateStatus', ['id' => $appointment->id]), [
                'status' => 'confirmed',
            ]);

        $response->assertRedirect();
        $response->assertSessionHas('success', 'Appointment updated.');
    }

    public function test_appointment_update_proxy_returns_go_payload_shape(): void
    {
        config()->set('go_backend.features.appointment_update', true);
        config()->set('go_backend.base_url', 'http://127.0.0.1:8081');

        Permission::firstOrCreate(['name' => 'appointments-update', 'guard_name' => 'web']);

        $customer = Customer::create([
            'name' => 'Customer A',
            'phone' => '081234567890',
        ]);

        $vehicle = Vehicle::create([
            'customer_id' => $customer->id,
            'plate_number' => 'B1234CD',
            'brand' => 'Honda',
            'model' => 'Vario',
        ]);

        $mechanic = Mechanic::create([
            'name' => 'Budi',
            'status' => 'active',
        ]);

        $appointment = \App\Models\Appointment::create([
            'customer_id' => $customer->id,
            'vehicle_id' => $vehicle->id,
            'mechanic_id' => $mechanic->id,
            'scheduled_at' => '2026-04-08 09:00:00',
            'status' => 'scheduled',
            'notes' => 'Cek berkala',
        ]);

        /** @var \App\Models\User $user */
        $user = User::factory()->create();
        $user->givePermissionTo('appointments-update');

        Http::fake([
            'http://127.0.0.1:8081/api/v1/appointments/' . $appointment->id => Http::response([
                'message' => 'Appointment berhasil diperbarui.',
                'appointment' => [
                    'id' => $appointment->id,
                    'status' => 'scheduled',
                    'mechanic_id' => $mechanic->id,
                ],
            ], 200),
        ]);

        $response = $this->actingAs($user)
            ->put(route('appointments.update', ['id' => $appointment->id]), [
                'customer_id' => $customer->id,
                'vehicle_id' => $vehicle->id,
                'mechanic_id' => $mechanic->id,
                'scheduled_at' => '2026-04-08 09:00:00',
                'notes' => 'Cek berkala',
            ]);

        $response->assertRedirect(route('appointments.calendar'));
        $response->assertSessionHas('success', 'Appointment berhasil diperbarui.');
    }

    public function test_appointment_edit_proxy_returns_go_payload_shape(): void
    {
        config()->set('go_backend.features.appointment_edit', true);
        config()->set('go_backend.base_url', 'http://127.0.0.1:8081');

        Permission::firstOrCreate(['name' => 'appointments-update', 'guard_name' => 'web']);

        $customer = Customer::create([
            'name' => 'Customer A',
            'phone' => '081234567890',
        ]);

        $vehicle = Vehicle::create([
            'customer_id' => $customer->id,
            'plate_number' => 'B1234CD',
            'brand' => 'Honda',
            'model' => 'Vario',
        ]);

        $mechanic = Mechanic::create([
            'name' => 'Budi',
            'status' => 'active',
            'specialty' => 'Engine',
        ]);

        $appointment = \App\Models\Appointment::create([
            'customer_id' => $customer->id,
            'vehicle_id' => $vehicle->id,
            'mechanic_id' => $mechanic->id,
            'scheduled_at' => '2026-04-08 09:00:00',
            'status' => 'scheduled',
            'notes' => 'Cek berkala',
        ]);

        /** @var \App\Models\User $user */
        $user = User::factory()->create();
        $user->givePermissionTo('appointments-update');

        Http::fake([
            'http://127.0.0.1:8081/api/v1/appointments/' . $appointment->id => Http::response([
                'appointment' => [
                    'id' => $appointment->id,
                    'status' => 'scheduled',
                    'customer' => [
                        'id' => $customer->id,
                        'name' => $customer->name,
                        'phone' => $customer->phone,
                    ],
                    'vehicle' => [
                        'id' => $vehicle->id,
                        'plate_number' => $vehicle->plate_number,
                        'brand' => $vehicle->brand,
                        'model' => $vehicle->model,
                    ],
                    'mechanic' => [
                        'id' => $mechanic->id,
                        'name' => $mechanic->name,
                        'specialty' => $mechanic->specialty,
                    ],
                    'mechanic_id' => $mechanic->id,
                    'scheduled_at' => '2026-04-08 09:00:00',
                    'notes' => 'Cek berkala',
                ],
                'mechanics' => [
                    [
                        'id' => $mechanic->id,
                        'name' => $mechanic->name,
                        'specialty' => $mechanic->specialty,
                    ],
                ],
            ], 200),
        ]);

        $response = $this->actingAs($user)
            ->get(route('appointments.edit', ['id' => $appointment->id]));

        $response->assertOk();
        $response->assertInertia(fn ($page) => $page
            ->component('Dashboard/Appointments/Edit')
            ->where('appointment.id', $appointment->id)
            ->where('appointment.mechanic_id', $mechanic->id)
            ->where('mechanics.0.id', $mechanic->id)
        );
    }

    public function test_appointment_destroy_proxy_returns_go_payload_shape(): void
    {
        config()->set('go_backend.features.appointment_destroy', true);
        config()->set('go_backend.base_url', 'http://127.0.0.1:8081');

        Permission::firstOrCreate(['name' => 'appointments-delete', 'guard_name' => 'web']);

        $customer = Customer::create([
            'name' => 'Customer A',
            'phone' => '081234567890',
        ]);

        $vehicle = Vehicle::create([
            'customer_id' => $customer->id,
            'plate_number' => 'B1234CD',
            'brand' => 'Honda',
            'model' => 'Vario',
        ]);

        $mechanic = Mechanic::create([
            'name' => 'Budi',
            'status' => 'active',
        ]);

        $appointment = \App\Models\Appointment::create([
            'customer_id' => $customer->id,
            'vehicle_id' => $vehicle->id,
            'mechanic_id' => $mechanic->id,
            'scheduled_at' => '2026-04-08 09:00:00',
            'status' => 'scheduled',
            'notes' => 'Cek berkala',
        ]);

        /** @var \App\Models\User $user */
        $user = User::factory()->create();
        $user->givePermissionTo('appointments-delete');

        Http::fake([
            'http://127.0.0.1:8081/api/v1/appointments/' . $appointment->id => Http::response([
                'message' => 'Appointment cancelled.',
                'appointment_id' => $appointment->id,
            ], 200),
        ]);

        $response = $this->actingAs($user)
            ->delete(route('appointments.destroy', ['id' => $appointment->id]));

        $response->assertRedirect();
        $response->assertSessionHas('success', 'Appointment cancelled.');
    }

    public function test_appointment_export_proxy_returns_go_payload_shape(): void
    {
        config()->set('go_backend.features.appointment_export', true);
        config()->set('go_backend.base_url', 'http://127.0.0.1:8081');

        Permission::firstOrCreate(['name' => 'appointments-access', 'guard_name' => 'web']);

        $customer = Customer::create([
            'name' => 'Customer A',
            'phone' => '081234567890',
        ]);

        $vehicle = Vehicle::create([
            'customer_id' => $customer->id,
            'plate_number' => 'B1234CD',
            'brand' => 'Honda',
            'model' => 'Vario',
        ]);

        $mechanic = Mechanic::create([
            'name' => 'Budi',
            'status' => 'active',
            'specialty' => 'Engine',
        ]);

        $appointment = \App\Models\Appointment::create([
            'customer_id' => $customer->id,
            'vehicle_id' => $vehicle->id,
            'mechanic_id' => $mechanic->id,
            'scheduled_at' => '2026-04-08 09:00:00',
            'status' => 'scheduled',
            'notes' => 'Cek berkala',
        ]);

        /** @var \App\Models\User $user */
        $user = User::factory()->create();
        $user->givePermissionTo('appointments-access');

        Http::fake([
            'http://127.0.0.1:8081/api/v1/appointments/' . $appointment->id . '/export' => Http::response("BEGIN:VCALENDAR\r\nEND:VCALENDAR\r\n", 200, [
                'Content-Type' => 'text/calendar',
                'Content-Disposition' => 'attachment; filename="appointment_' . $appointment->id . '.ics"',
            ]),
        ]);

        $response = $this->actingAs($user)
            ->get(route('appointments.export', ['id' => $appointment->id]));

        $response->assertStatus(200);
        $this->assertStringStartsWith('text/calendar', (string) $response->headers->get('Content-Type'));
        $response->assertHeader('Content-Disposition', 'attachment; filename="appointment_' . $appointment->id . '.ics"');
        $this->assertStringContainsString('BEGIN:VCALENDAR', $response->getContent());
    }

    public function test_part_sales_profit_proxy_returns_go_payload_shape(): void
    {
        config()->set('go_backend.features.report_part_sales_profit', true);
        config()->set('go_backend.base_url', 'http://127.0.0.1:8081');

        Permission::firstOrCreate(['name' => 'reports-access', 'guard_name' => 'web']);

        /** @var \App\Models\User $user */
        $user = User::factory()->create();
        $user->givePermissionTo('reports-access');

        Http::fake([
            'http://127.0.0.1:8081/api/v1/reports/part-sales-profit*' => Http::response([
                'sales' => [
                    'current_page' => 1,
                    'data' => [
                        [
                            'id' => 1,
                            'invoice' => 'INV-001',
                            'created_at' => '2026-04-08 10:00:00',
                            'user' => ['id' => 5, 'name' => 'Kasir A'],
                            'total_cost' => 100000,
                            'total_revenue' => 150000,
                            'total_profit' => 50000,
                            'profit_margin' => 33.33,
                        ],
                    ],
                    'from' => 1,
                    'last_page' => 1,
                    'links' => [
                        ['url' => null, 'label' => '&laquo; Previous', 'active' => false],
                        ['url' => '/dashboard/reports/part-sales-profit', 'label' => '1', 'active' => true],
                        ['url' => null, 'label' => 'Next &raquo;', 'active' => false],
                    ],
                    'per_page' => 15,
                    'to' => 1,
                    'total' => 1,
                ],
                'summary' => [
                    'total_cost' => 100000,
                    'total_revenue' => 150000,
                    'total_profit' => 50000,
                    'profit_margin' => 33.33,
                    'average_profit_per_order' => 50000,
                    'orders_count' => 1,
                    'items_sold' => 3,
                ],
                'topParts' => [
                    [
                        'part_name' => 'Oli Mesin',
                        'part_sku' => 'OLI-001',
                        'total_quantity' => 3,
                        'total_profit' => 50000,
                        'avg_margin' => 33.33,
                    ],
                ],
                'filters' => [
                    'start_date' => '2026-04-01',
                    'end_date' => '2026-04-08',
                    'invoice' => 'INV-001',
                ],
            ], 200),
        ]);

        $response = $this->actingAs($user)
            ->get(route('reports.part-sales-profit.index', [
                'start_date' => '2026-04-01',
                'end_date' => '2026-04-08',
                'invoice' => 'INV-001',
            ]));

        $response->assertOk();
        $response->assertInertia(fn ($page) => $page
            ->component('Dashboard/Reports/PartSalesProfit')
            ->where('summary.total_profit', 50000)
            ->where('sales.total', 1)
            ->where('topParts.0.part_name', 'Oli Mesin')
        );
    }

    public function test_part_sales_profit_by_supplier_proxy_returns_go_payload_shape(): void
    {
        config()->set('go_backend.features.report_part_sales_profit', true);
        config()->set('go_backend.base_url', 'http://127.0.0.1:8081');

        Permission::firstOrCreate(['name' => 'reports-access', 'guard_name' => 'web']);

        /** @var \App\Models\User $user */
        $user = User::factory()->create();
        $user->givePermissionTo('reports-access');

        Http::fake([
            'http://127.0.0.1:8081/api/v1/reports/part-sales-profit/by-supplier*' => Http::response([
                'supplier_performance' => [
                    [
                        'supplier_id' => 1,
                        'supplier_name' => 'Supplier A',
                        'total_profit' => 50000,
                        'total_cost' => 100000,
                        'total_revenue' => 150000,
                        'sales_count' => 1,
                        'items_sold' => 3,
                        'profit_margin' => 33.33,
                    ],
                ],
                'filters' => [
                    'start_date' => '2026-04-01',
                    'end_date' => '2026-04-08',
                ],
            ], 200),
        ]);

        $response = $this->actingAs($user)
            ->getJson(route('reports.part-sales-profit.by-supplier', [
                'start_date' => '2026-04-01',
                'end_date' => '2026-04-08',
            ]));

        $response->assertStatus(200)
            ->assertJsonStructure([
                'supplier_performance',
                'filters',
            ])
            ->assertJson([
                'filters' => [
                    'start_date' => '2026-04-01',
                ],
            ]);
    }

    public function test_reports_overall_proxy_returns_go_payload_shape(): void
    {
        config()->set('go_backend.features.report_overall', true);
        config()->set('go_backend.base_url', 'http://127.0.0.1:8081');

        Permission::firstOrCreate(['name' => 'reports-access', 'guard_name' => 'web']);

        /** @var \App\Models\User $user */
        $user = User::factory()->create();
        $user->givePermissionTo('reports-access');

        Http::fake([
            'http://127.0.0.1:8081/api/v1/reports/overall*' => Http::response([
                'filters' => [
                    'start_date' => '2026-04-01',
                    'end_date' => '2026-04-08',
                    'source' => 'all',
                    'status' => 'all',
                    'per_page' => 20,
                ],
                'statusOptions' => [
                    ['value' => 'paid', 'label' => 'Lunas'],
                ],
                'statusSummary' => [
                    ['value' => 'paid', 'label' => 'Lunas', 'count' => 1, 'net_amount' => 150000],
                ],
                'summary' => [
                    'service_revenue' => 100000,
                    'part_revenue' => 50000,
                    'total_revenue' => 150000,
                    'cash_in' => 150000,
                    'cash_out' => 20000,
                    'net_cash_flow' => 130000,
                    'transaction_count' => 1,
                ],
                'transactions' => [
                    'current_page' => 1,
                    'data' => [
                        [
                            'id' => 'service_order-SO-001',
                            'date' => '2026-04-08 10:00:00',
                            'date_unix' => 1775636400,
                            'source' => 'service_order',
                            'reference' => 'SO-001',
                            'description' => 'Customer A | B1234CD',
                            'flow' => 'in',
                            'amount' => 150000,
                            'status' => 'paid',
                            'status_label' => 'Lunas',
                            'running_balance' => 150000,
                        ],
                    ],
                    'from' => 1,
                    'last_page' => 1,
                    'per_page' => 20,
                    'to' => 1,
                    'total' => 1,
                ],
            ], 200),
        ]);

        $response = $this->actingAs($user)
            ->get(route('reports.overall.index', [
                'start_date' => '2026-04-01',
                'end_date' => '2026-04-08',
                'source' => 'all',
                'status' => 'all',
            ]));

        $response->assertOk();
        $response->assertInertia(fn ($page) => $page
            ->component('Dashboard/Reports/Overall')
            ->where('summary.total_revenue', 150000)
            ->where('statusOptions.0.value', 'paid')
            ->where('transactions.total', 1)
            ->where('transactions.data.0.reference', 'SO-001')
        );
    }

    public function test_reports_service_revenue_proxy_returns_go_payload_shape(): void
    {
        config()->set('go_backend.features.report_service_revenue', true);
        config()->set('go_backend.base_url', 'http://127.0.0.1:8081');

        Permission::firstOrCreate(['name' => 'reports-access', 'guard_name' => 'web']);

        /** @var \App\Models\User $user */
        $user = User::factory()->create();
        $user->givePermissionTo('reports-access');

        Http::fake([
            'http://127.0.0.1:8081/api/v1/reports/service-revenue*' => Http::response([
                'report_data' => [
                    [
                        'date' => '2026-04-08',
                        'count' => 2,
                        'revenue' => 300000,
                        'labor_cost' => 100000,
                        'material_cost' => 50000,
                    ],
                ],
                'filters' => [
                    'start_date' => '2026-04-01',
                    'end_date' => '2026-04-08',
                    'period' => 'daily',
                ],
                'summary' => [
                    'total_revenue' => 300000,
                    'total_orders' => 2,
                    'total_labor_cost' => 100000,
                    'total_material_cost' => 50000,
                    'average_order_value' => 150000,
                ],
            ], 200),
        ]);

        $response = $this->actingAs($user)
            ->get(route('reports.service-revenue.index', [
                'start_date' => '2026-04-01',
                'end_date' => '2026-04-08',
                'period' => 'daily',
            ]));

        $response->assertOk();
        $response->assertInertia(fn ($page) => $page
            ->component('Dashboard/Reports/ServiceRevenue')
            ->where('summary.total_revenue', 300000)
            ->where('summary.total_orders', 2)
            ->where('report_data.0.count', 2)
            ->where('filters.period', 'daily')
        );
    }

    public function test_reports_mechanic_productivity_proxy_returns_go_payload_shape(): void
    {
        config()->set('go_backend.features.report_mechanic_productivity', true);
        config()->set('go_backend.base_url', 'http://127.0.0.1:8081');

        Permission::firstOrCreate(['name' => 'reports-access', 'guard_name' => 'web']);

        /** @var \App\Models\User $user */
        $user = User::factory()->create();
        $user->givePermissionTo('reports-access');

        Http::fake([
            'http://127.0.0.1:8081/api/v1/reports/mechanic-productivity*' => Http::response([
                'mechanics' => [
                    [
                        'id' => 5,
                        'name' => 'Budi',
                        'specialty' => 'Mesin, Listrik',
                        'total_orders' => 3,
                        'total_revenue' => 450000,
                        'service_revenue' => 430000,
                        'total_auto_discount' => 20000,
                        'total_incentive' => 50000,
                        'estimated_work_minutes' => 240,
                        'hourly_rate' => 30000,
                        'base_salary' => 120000,
                        'total_salary' => 170000,
                        'total_labor_cost' => 180000,
                        'total_material_cost' => 90000,
                        'average_order_value' => 150000,
                    ],
                ],
                'filters' => [
                    'start_date' => '2026-04-01',
                    'end_date' => '2026-04-08',
                ],
                'summary' => [
                    'total_mechanics' => 1,
                    'total_revenue' => 450000,
                    'total_orders' => 3,
                    'total_incentive' => 50000,
                    'total_salary' => 170000,
                ],
            ], 200),
        ]);

        $response = $this->actingAs($user)
            ->get(route('reports.mechanic-productivity.index', [
                'start_date' => '2026-04-01',
                'end_date' => '2026-04-08',
            ]));

        $response->assertOk();
        $response->assertInertia(fn ($page) => $page
            ->component('Dashboard/Reports/MechanicProductivity')
            ->where('summary.total_revenue', 450000)
            ->where('summary.total_mechanics', 1)
            ->where('mechanics.0.name', 'Budi')
            ->where('mechanics.0.total_salary', 170000)
        );
    }

    public function test_reports_mechanic_payroll_proxy_returns_go_payload_shape(): void
    {
        config()->set('go_backend.features.report_mechanic_payroll', true);
        config()->set('go_backend.base_url', 'http://127.0.0.1:8081');

        Permission::firstOrCreate(['name' => 'reports-access', 'guard_name' => 'web']);

        /** @var \App\Models\User $user */
        $user = User::factory()->create();
        $user->givePermissionTo('reports-access');

        Http::fake([
            'http://127.0.0.1:8081/api/v1/reports/mechanic-payroll*' => Http::response([
                'mechanics' => [
                    [
                        'id' => 6,
                        'name' => 'Andi',
                        'employee_number' => 'M-006',
                        'total_orders' => 4,
                        'service_count' => 7,
                        'estimated_work_minutes' => 300,
                        'hourly_rate' => 30000,
                        'base_salary' => 150000,
                        'incentive_amount' => 40000,
                        'take_home_pay' => 190000,
                    ],
                ],
                'filters' => [
                    'start_date' => '2026-04-01',
                    'end_date' => '2026-04-08',
                ],
                'summary' => [
                    'total_mechanics' => 1,
                    'total_base_salary' => 150000,
                    'total_incentive' => 40000,
                    'total_take_home_pay' => 190000,
                ],
            ], 200),
        ]);

        $response = $this->actingAs($user)
            ->get(route('reports.mechanic-payroll.index', [
                'start_date' => '2026-04-01',
                'end_date' => '2026-04-08',
            ]));

        $response->assertOk();
        $response->assertInertia(fn ($page) => $page
            ->component('Dashboard/Reports/MechanicPayroll')
            ->where('summary.total_take_home_pay', 190000)
            ->where('summary.total_base_salary', 150000)
            ->where('mechanics.0.name', 'Andi')
            ->where('mechanics.0.take_home_pay', 190000)
        );
    }

    public function test_reports_parts_inventory_proxy_returns_go_payload_shape(): void
    {
        config()->set('go_backend.features.report_parts_inventory', true);
        config()->set('go_backend.base_url', 'http://127.0.0.1:8081');

        Permission::firstOrCreate(['name' => 'reports-access', 'guard_name' => 'web']);

        /** @var \App\Models\User $user */
        $user = User::factory()->create();
        $user->givePermissionTo('reports-access');

        Http::fake([
            'http://127.0.0.1:8081/api/v1/reports/parts-inventory*' => Http::response([
                'parts' => [
                    [
                        'id' => 9,
                        'name' => 'Filter Oli',
                        'category' => 'Mesin',
                        'stock' => 2,
                        'reorder_level' => 5,
                        'price' => 25000,
                        'stock_value' => 50000,
                        'status' => 'low',
                    ],
                ],
                'filters' => [
                    'status' => 'low',
                ],
                'summary' => [
                    'total_parts' => 1,
                    'total_stock_value' => 50000,
                    'low_stock_items' => 1,
                ],
            ], 200),
        ]);

        $response = $this->actingAs($user)
            ->get(route('reports.parts-inventory.index', [
                'status' => 'low',
            ]));

        $response->assertOk();
        $response->assertInertia(fn ($page) => $page
            ->component('Dashboard/Reports/PartsInventory')
            ->where('summary.low_stock_items', 1)
            ->where('summary.total_stock_value', 50000)
            ->where('parts.0.name', 'Filter Oli')
            ->where('filters.status', 'low')
        );
    }

    public function test_reports_outstanding_payments_proxy_returns_go_payload_shape(): void
    {
        config()->set('go_backend.features.report_outstanding_payments', true);
        config()->set('go_backend.base_url', 'http://127.0.0.1:8081');

        Permission::firstOrCreate(['name' => 'reports-access', 'guard_name' => 'web']);

        /** @var \App\Models\User $user */
        $user = User::factory()->create();
        $user->givePermissionTo('reports-access');

        Http::fake([
            'http://127.0.0.1:8081/api/v1/reports/outstanding-payments*' => Http::response([
                'orders' => [
                    'current_page' => 1,
                    'data' => [
                        [
                            'id' => 10,
                            'order_number' => 'SO-0010',
                            'customer_name' => 'Customer A',
                            'vehicle_plate' => 'B1234CD',
                            'total' => 300000,
                            'labor_cost' => 100000,
                            'material_cost' => 120000,
                            'status' => 'completed',
                            'days_outstanding' => 12,
                            'created_at' => '2026-04-01 10:00:00',
                        ],
                    ],
                    'from' => 1,
                    'last_page' => 1,
                    'links' => [
                        ['url' => null, 'label' => '&laquo; Previous', 'active' => false],
                        ['url' => '/reports/outstanding-payments', 'label' => '1', 'active' => true],
                        ['url' => null, 'label' => 'Next &raquo;', 'active' => false],
                    ],
                    'per_page' => 20,
                    'to' => 1,
                    'total' => 1,
                ],
                'summary' => [
                    'total_outstanding' => 300000,
                    'count_outstanding' => 1,
                ],
            ], 200),
        ]);

        $response = $this->actingAs($user)
            ->get(route('reports.outstanding-payments.index'));

        $response->assertOk();
        $response->assertInertia(fn ($page) => $page
            ->component('Dashboard/Reports/OutstandingPayments')
            ->where('summary.total_outstanding', 300000)
            ->where('summary.count_outstanding', 1)
            ->where('orders.total', 1)
            ->where('orders.data.0.order_number', 'SO-0010')
        );
    }

    public function test_reports_export_csv_proxy_returns_go_csv_payload_shape(): void
    {
        config()->set('go_backend.features.report_export_csv', true);
        config()->set('go_backend.base_url', 'http://127.0.0.1:8081');

        Permission::firstOrCreate(['name' => 'reports-access', 'guard_name' => 'web']);

        /** @var \App\Models\User $user */
        $user = User::factory()->create();
        $user->givePermissionTo('reports-access');

        Http::fake([
            'http://127.0.0.1:8081/api/v1/reports/export*' => Http::response(
                "Tanggal,Jumlah Pesanan,Pendapatan,Biaya Tenaga Kerja,Biaya Material\n" .
                "2026-04-08,2,300000,100000,50000\n",
                200,
                [
                    'Content-Type' => 'text/csv',
                    'Content-Disposition' => 'attachment; filename=report-export.csv',
                ]
            ),
        ]);

        $response = $this->actingAs($user)
            ->get(route('reports.export', [
                'type' => 'revenue',
                'start_date' => '2026-04-01',
                'end_date' => '2026-04-08',
            ]));

        $response->assertStatus(200);
        $this->assertStringStartsWith('text/csv', (string) $response->headers->get('Content-Type'));
        $response->assertHeader('Content-Disposition', 'attachment; filename=report-export.csv');
        $this->assertStringContainsString('Tanggal,Jumlah Pesanan,Pendapatan', $response->getContent());
    }

    public function test_vehicle_insights_proxy_returns_go_payload_shape(): void
    {
        config()->set('go_backend.features.vehicle_insights', true);
        config()->set('go_backend.base_url', 'http://127.0.0.1:8081');

        Permission::firstOrCreate(['name' => 'vehicles-access', 'guard_name' => 'web']);

        /** @var \App\Models\User $user */
        $user = User::factory()->create();
        $user->givePermissionTo('vehicles-access');

        Http::fake([
            'http://127.0.0.1:8081/api/v1/vehicles/123/maintenance-insights' => Http::response([
                'vehicle_km' => 42000,
                'last_service_date' => '2026-04-01',
                'next_service_date' => '2026-05-01',
                'last_km' => [
                    'oil' => 42000,
                    'air' => 40000,
                    'spark' => null,
                    'brakepad' => null,
                    'belt' => 39000,
                ],
            ], 200),
        ]);

        $response = $this->actingAs($user)
            ->getJson(route('vehicles.maintenance.insights', ['vehicle' => 123]));

        $response->assertStatus(200)
            ->assertJson([
                'vehicle_km' => 42000,
                'last_service_date' => '2026-04-01',
                'next_service_date' => '2026-05-01',
            ])
            ->assertJsonStructure([
                'vehicle_km',
                'last_service_date',
                'next_service_date',
                'last_km' => ['oil', 'air', 'spark', 'brakepad', 'belt'],
            ]);
    }

    public function test_vehicle_service_history_proxy_returns_go_payload_shape(): void
    {
        config()->set('go_backend.features.vehicle_service_history', true);
        config()->set('go_backend.base_url', 'http://127.0.0.1:8081');

        Permission::firstOrCreate(['name' => 'vehicles-access', 'guard_name' => 'web']);

        /** @var \App\Models\User $user */
        $user = User::factory()->create();
        $user->givePermissionTo('vehicles-access');

        Http::fake([
            'http://127.0.0.1:8081/api/v1/vehicles/123/service-history' => Http::response([
                'service_orders' => [
                    [
                        'id' => 1,
                        'order_number' => 'SO-001',
                        'status' => 'completed',
                        'created_at' => '2026-04-08T10:00:00+07:00',
                        'odometer_km' => 42000,
                        'total' => 250000,
                        'notes' => null,
                        'mechanic' => ['id' => 9, 'name' => 'Budi'],
                        'details' => [
                            [
                                'id' => 11,
                                'service' => ['id' => 3, 'name' => 'Tune Up'],
                                'part' => null,
                                'quantity' => 1,
                                'price' => 150000,
                            ],
                        ],
                    ],
                ],
            ], 200),
        ]);

        $response = $this->actingAs($user)
            ->getJson(route('vehicles.service-history', ['vehicle' => 123]));

        $response->assertStatus(200)
            ->assertJsonStructure([
                'service_orders' => [
                    [
                        'id',
                        'order_number',
                        'status',
                        'created_at',
                        'odometer_km',
                        'total',
                        'notes',
                        'mechanic',
                        'details',
                    ],
                ],
            ]);
    }

    public function test_vehicle_with_history_proxy_returns_go_payload_shape(): void
    {
        config()->set('go_backend.features.vehicle_with_history', true);
        config()->set('go_backend.base_url', 'http://127.0.0.1:8081');

        Permission::firstOrCreate(['name' => 'vehicles-access', 'guard_name' => 'web']);

        /** @var \App\Models\User $user */
        $user = User::factory()->create();
        $user->givePermissionTo('vehicles-access');

        Http::fake([
            'http://127.0.0.1:8081/api/v1/vehicles/123/with-history' => Http::response([
                'vehicle' => [
                    'id' => 123,
                    'plate_number' => 'B1234CD',
                    'brand' => 'Honda',
                    'model' => 'Vario',
                    'km' => 42000,
                    'last_service_date' => '2026-04-01',
                    'next_service_date' => '2026-05-01',
                ],
                'recent_orders' => [
                    [
                        'id' => 1,
                        'order_number' => 'SO-001',
                        'status' => 'completed',
                        'created_at' => '2026-04-08',
                        'odometer_km' => 42000,
                        'mechanic' => ['name' => 'Budi'],
                        'total_cost' => 250000,
                    ],
                ],
            ], 200),
        ]);

        $response = $this->actingAs($user)
            ->getJson(route('vehicles.with-history', ['vehicle' => 123]));

        $response->assertStatus(200)
            ->assertJsonStructure([
                'vehicle' => [
                    'id',
                    'plate_number',
                    'brand',
                    'model',
                    'km',
                    'last_service_date',
                    'next_service_date',
                ],
                'recent_orders' => [
                    [
                        'id',
                        'order_number',
                        'status',
                        'created_at',
                        'odometer_km',
                        'mechanic',
                        'total_cost',
                    ],
                ],
            ]);
    }

    public function test_vehicle_recommendations_proxy_returns_go_payload_shape(): void
    {
        config()->set('go_backend.features.vehicle_recommendations', true);
        config()->set('go_backend.base_url', 'http://127.0.0.1:8081');

        $customer = Customer::create([
            'name' => 'Customer A',
            'phone' => '081234567890',
        ]);

        $vehicle = Vehicle::create([
            'customer_id' => $customer->id,
            'plate_number' => 'B1234CD',
            'brand' => 'Honda',
            'model' => 'Vario',
        ]);

        Permission::firstOrCreate(['name' => 'vehicles-access', 'guard_name' => 'web']);

        /** @var \App\Models\User $user */
        $user = User::factory()->create();
        $user->givePermissionTo('vehicles-access');

        Http::fake([
            'http://127.0.0.1:8081/api/v1/vehicles/' . $vehicle->id . '/recommendations' => Http::response([
                'vehicle_id' => $vehicle->id,
                'brand' => 'Honda',
                'model' => 'Vario',
                'recommended_parts' => [
                    ['id' => 1, 'name' => 'Oli Mesin', 'category' => 'Oli', 'price' => 85000, 'frequency' => 3],
                ],
                'recommended_services' => [
                    ['id' => 2, 'name' => 'Tune Up', 'category' => 'Service Ringan', 'price' => 120000, 'frequency' => 2],
                ],
                'recent_history_count' => 5,
            ], 200),
        ]);

        $response = $this->actingAs($user)
            ->getJson(route('vehicles.recommendations', ['vehicle' => $vehicle->id]));

        $response->assertStatus(200)
            ->assertJsonStructure([
                'vehicle_id',
                'brand',
                'model',
                'recommended_parts',
                'recommended_services',
                'recent_history_count',
            ]);
    }

    public function test_vehicle_maintenance_schedule_proxy_returns_go_payload_shape(): void
    {
        config()->set('go_backend.features.vehicle_maintenance_schedule', true);
        config()->set('go_backend.base_url', 'http://127.0.0.1:8081');

        $customer = Customer::create([
            'name' => 'Customer B',
            'phone' => '081298765432',
        ]);

        $vehicle = Vehicle::create([
            'customer_id' => $customer->id,
            'plate_number' => 'B5678EF',
            'brand' => 'Yamaha',
            'model' => 'Nmax',
        ]);

        Permission::firstOrCreate(['name' => 'vehicles-access', 'guard_name' => 'web']);

        /** @var \App\Models\User $user */
        $user = User::factory()->create();
        $user->givePermissionTo('vehicles-access');

        Http::fake([
            'http://127.0.0.1:8081/api/v1/vehicles/' . $vehicle->id . '/maintenance-schedule' => Http::response([
                'vehicle_id' => $vehicle->id,
                'schedule' => [
                    [
                        'interval' => '5,000 km / 3 months',
                        'services' => ['Oil Change'],
                        'parts' => ['Engine Oil'],
                        'priority' => 'high',
                    ],
                ],
            ], 200),
        ]);

        $response = $this->actingAs($user)
            ->getJson(route('vehicles.maintenance-schedule', ['vehicle' => $vehicle->id]));

        $response->assertStatus(200)
            ->assertJsonStructure([
                'vehicle_id',
                'schedule',
            ]);
    }

    public function test_vehicle_detail_proxy_returns_go_payload_shape(): void
    {
        config()->set('go_backend.features.vehicle_detail', true);
        config()->set('go_backend.base_url', 'http://127.0.0.1:8081');

        $customer = Customer::create([
            'name' => 'Customer C',
            'phone' => '081211122233',
        ]);

        $vehicle = Vehicle::create([
            'customer_id' => $customer->id,
            'plate_number' => 'B9999ZZ',
            'brand' => 'Suzuki',
            'model' => 'Address',
        ]);

        Permission::firstOrCreate(['name' => 'vehicles-access', 'guard_name' => 'web']);

        /** @var \App\Models\User $user */
        $user = User::factory()->create();
        $user->givePermissionTo('vehicles-access');

        Http::fake([
            'http://127.0.0.1:8081/api/v1/vehicles/' . $vehicle->id => Http::response([
                'vehicle' => [
                    'id' => $vehicle->id,
                    'plate_number' => 'B9999ZZ',
                    'brand' => 'Suzuki',
                    'model' => 'Address',
                    'year' => null,
                    'color' => null,
                    'km' => 42000,
                    'engine_type' => null,
                    'transmission_type' => null,
                    'cylinder_volume' => null,
                    'last_service_date' => '2026-04-01',
                    'next_service_date' => '2026-05-01',
                    'features' => [],
                    'notes' => null,
                    'customer' => [
                        'id' => $customer->id,
                        'name' => 'Customer C',
                        'phone' => '081211122233',
                    ],
                ],
                'service_orders' => [
                    [
                        'id' => 1,
                        'order_number' => 'SO-001',
                        'status' => 'completed',
                        'odometer_km' => 42000,
                        'total' => 250000,
                        'labor_cost' => 100000,
                        'material_cost' => 150000,
                        'created_at' => '2026-04-08T10:00:00+07:00',
                        'actual_finish_at' => '2026-04-08T12:00:00+07:00',
                        'estimated_finish_at' => '2026-04-08T11:30:00+07:00',
                        'mechanic' => ['id' => 9, 'name' => 'Budi'],
                        'details' => [
                            [
                                'id' => 11,
                                'qty' => 1,
                                'price' => 150000,
                                'service' => ['id' => 3, 'title' => 'Tune Up', 'price' => 150000],
                                'part' => null,
                            ],
                        ],
                    ],
                ],
            ], 200),
        ]);

        $response = $this->actingAs($user)
            ->getJson(route('vehicles.show', ['vehicle' => $vehicle->id]));

        $response->assertStatus(200)
            ->assertJsonStructure([
                'vehicle' => [
                    'id',
                    'plate_number',
                    'brand',
                    'model',
                    'year',
                    'color',
                    'km',
                    'engine_type',
                    'transmission_type',
                    'cylinder_volume',
                    'last_service_date',
                    'next_service_date',
                    'features',
                    'notes',
                    'customer',
                ],
                'service_orders',
            ]);
    }

    public function test_cash_change_suggest_proxy_returns_go_payload_shape(): void
    {
        config()->set('go_backend.features.cash_change_suggest', true);
        config()->set('go_backend.base_url', 'http://127.0.0.1:8081');

        Permission::firstOrCreate(['name' => 'cash-management-manage', 'guard_name' => 'web']);

        /** @var \App\Models\User $user */
        $user = User::factory()->create();
        $user->givePermissionTo('cash-management-manage');

        Http::fake([
            'http://127.0.0.1:8081/api/v1/cash-management/change/suggest' => Http::response([
                'ok' => true,
                'total_due' => 13000,
                'received_total' => 20000,
                'change_amount' => 7000,
                'suggestion' => [
                    'exact' => true,
                    'allocated_amount' => 7000,
                    'remaining' => 0,
                    'pieces' => 2,
                    'items' => [
                        [
                            'denomination_id' => 3,
                            'value' => 5000,
                            'quantity' => 1,
                            'line_total' => 5000,
                        ],
                        [
                            'denomination_id' => 2,
                            'value' => 2000,
                            'quantity' => 1,
                            'line_total' => 2000,
                        ],
                    ],
                ],
                'received_breakdown' => [
                    [
                        'denomination_id' => 4,
                        'value' => 10000,
                        'quantity' => 2,
                        'line_total' => 20000,
                    ],
                ],
            ], 200),
        ]);

        $response = $this->actingAs($user)
            ->postJson('/dashboard/cash-management/change/suggest', [
                'total_due' => 13000,
                'received' => [
                    ['denomination_id' => 4, 'quantity' => 2],
                ],
            ]);

        $response->assertStatus(200)
            ->assertJsonStructure([
                'ok',
                'total_due',
                'received_total',
                'change_amount',
                'suggestion' => [
                    'exact',
                    'allocated_amount',
                    'remaining',
                    'pieces',
                    'items',
                ],
                'received_breakdown',
            ])
            ->assertJson([
                'ok' => true,
                'change_amount' => 7000,
                'suggestion' => [
                    'exact' => true,
                    'allocated_amount' => 7000,
                ],
            ]);
    }

    public function test_cash_sale_settle_proxy_returns_go_payload_shape(): void
    {
        config()->set('go_backend.features.cash_sale_settle', true);
        config()->set('go_backend.base_url', 'http://127.0.0.1:8081');

        Permission::firstOrCreate(['name' => 'cash-management-manage', 'guard_name' => 'web']);

        /** @var \App\Models\User $user */
        $user = User::factory()->create();
        $user->givePermissionTo('cash-management-manage');

        Http::fake([
            'http://127.0.0.1:8081/api/v1/cash-management/sale/settle' => Http::response([
                'ok' => true,
                'message' => 'Pembayaran cash dan kembalian berhasil dicatat.',
                'net_cash_in' => 13000,
                'received_total' => 20000,
                'change_amount' => 7000,
            ], 200),
        ]);

        $response = $this->actingAs($user)
            ->postJson('/dashboard/cash-management/sale/settle', [
                'total_due' => 13000,
                'description' => 'Pembayaran cash customer',
                'received' => [
                    ['denomination_id' => 4, 'quantity' => 2],
                ],
            ]);

        $response->assertStatus(200)
            ->assertJsonStructure([
                'ok',
                'message',
                'net_cash_in',
                'received_total',
                'change_amount',
            ])
            ->assertJson([
                'ok' => true,
                'net_cash_in' => 13000,
                'received_total' => 20000,
                'change_amount' => 7000,
            ]);
    }

    public function test_part_sale_update_payment_proxy_returns_go_payload_shape(): void
    {
        config()->set('go_backend.features.part_sale_update_payment', true);
        config()->set('go_backend.base_url', 'http://127.0.0.1:8081');

        Permission::firstOrCreate(['name' => 'part-sales-edit', 'guard_name' => 'web']);

        /** @var \App\Models\User $user */
        $user = User::factory()->create();
        $user->givePermissionTo('part-sales-edit');

        $partSale = PartSale::create([
            'sale_number' => 'SAL202604080099',
            'customer_id' => null,
            'sale_date' => '2026-04-08',
            'subtotal' => 13000,
            'discount_type' => 'none',
            'discount_value' => 0,
            'discount_amount' => 0,
            'tax_type' => 'none',
            'tax_value' => 0,
            'tax_amount' => 0,
            'grand_total' => 13000,
            'paid_amount' => 0,
            'remaining_amount' => 13000,
            'payment_status' => 'unpaid',
            'status' => 'confirmed',
            'created_by' => $user->id,
        ]);

        Http::fake([
            'http://127.0.0.1:8081/api/v1/part-sales/' . $partSale->id . '/update-payment' => Http::response([
                'ok' => true,
                'message' => 'Pembayaran berhasil dicatat',
            ], 200),
        ]);

        $response = $this->actingAs($user)
            ->post(route('part-sales.update-payment', ['partSale' => $partSale->id]), [
                'payment_amount' => 5000,
            ]);

        $response->assertRedirect();
        $response->assertSessionHas('success', 'Pembayaran berhasil dicatat');
    }

    public function test_part_sale_store_proxy_returns_go_payload_shape(): void
    {
        config()->set('go_backend.features.part_sale_store', true);
        config()->set('go_backend.base_url', 'http://127.0.0.1:8081');

        Permission::firstOrCreate(['name' => 'part-sales-create', 'guard_name' => 'web']);

        /** @var \App\Models\User $user */
        $user = User::factory()->create();
        $user->givePermissionTo('part-sales-create');

        $customer = Customer::create([
            'name' => 'Customer Store Proxy',
            'phone' => '081234567001',
            'address' => 'Jl. Raya 123',
        ]);

        $part = Part::create([
            'part_number' => 'PART-STORE-001',
            'name' => 'Kampas Rem Depan',
            'buy_price' => 35000,
            'sell_price' => 50000,
            'stock' => 10,
            'minimal_stock' => 2,
            'status' => 'active',
            'has_warranty' => true,
            'warranty_duration_days' => 30,
            'warranty_terms' => 'Garansi 30 hari',
        ]);

        Http::fake([
            'http://127.0.0.1:8081/api/v1/part-sales' => Http::response([
                'ok' => true,
                'message' => 'Penjualan berhasil dibuat',
                'sale_id' => 12345,
                'sale_number' => 'SAL202604080123',
            ], 200),
        ]);

        $response = $this->actingAs($user)
            ->post(route('part-sales.store'), [
                'customer_id' => $customer->id,
                'sale_date' => '2026-04-08',
                'items' => [
                    [
                        'part_id' => $part->id,
                        'quantity' => 2,
                        'unit_price' => 50000,
                        'discount_type' => 'none',
                        'discount_value' => 0,
                    ],
                ],
                'status' => 'confirmed',
            ]);

        $response->assertRedirect(route('part-sales.show', ['partSale' => 12345]));
        $response->assertSessionHas('success', 'Penjualan berhasil dibuat');
    }

    public function test_part_sale_update_proxy_returns_go_payload_shape(): void
    {
        config()->set('go_backend.features.part_sale_update', true);
        config()->set('go_backend.base_url', 'http://127.0.0.1:8081');

        Permission::firstOrCreate(['name' => 'part-sales-edit', 'guard_name' => 'web']);

        /** @var \App\Models\User $user */
        $user = User::factory()->create();
        $user->givePermissionTo('part-sales-edit');

        $customer = Customer::create([
            'name' => 'Customer Update Proxy',
            'phone' => '081234567002',
            'address' => 'Jl. Melati 99',
        ]);

        $part = Part::create([
            'part_number' => 'PART-UPDATE-001',
            'name' => 'Busi Iridium',
            'buy_price' => 40000,
            'sell_price' => 65000,
            'stock' => 12,
            'minimal_stock' => 2,
            'status' => 'active',
            'has_warranty' => false,
            'warranty_duration_days' => 0,
            'warranty_terms' => null,
        ]);

        $partSale = PartSale::create([
            'sale_number' => 'SAL202604080200',
            'customer_id' => $customer->id,
            'sale_date' => '2026-04-08',
            'subtotal' => 65000,
            'discount_type' => 'none',
            'discount_value' => 0,
            'discount_amount' => 0,
            'tax_type' => 'none',
            'tax_value' => 0,
            'tax_amount' => 0,
            'grand_total' => 65000,
            'paid_amount' => 0,
            'remaining_amount' => 65000,
            'payment_status' => 'unpaid',
            'status' => 'draft',
            'created_by' => $user->id,
        ]);

        Http::fake([
            'http://127.0.0.1:8081/api/v1/part-sales/' . $partSale->id => Http::response([
                'ok' => true,
                'message' => 'Penjualan berhasil diupdate',
                'sale_id' => $partSale->id,
            ], 200),
        ]);

        $response = $this->actingAs($user)
            ->put(route('part-sales.update', ['partSale' => $partSale->id]), [
                'customer_id' => $customer->id,
                'sale_date' => '2026-04-08',
                'items' => [
                    [
                        'part_id' => $part->id,
                        'quantity' => 1,
                        'unit_price' => 65000,
                        'discount_type' => 'none',
                        'discount_value' => 0,
                    ],
                ],
                'status' => 'draft',
            ]);

        $response->assertRedirect(route('part-sales.show', ['partSale' => $partSale->id]));
        $response->assertSessionHas('success', 'Penjualan berhasil diupdate');
    }

    public function test_part_sale_destroy_proxy_returns_go_payload_shape(): void
    {
        config()->set('go_backend.features.part_sale_destroy', true);
        config()->set('go_backend.base_url', 'http://127.0.0.1:8081');

        Permission::firstOrCreate(['name' => 'part-sales-delete', 'guard_name' => 'web']);

        /** @var \App\Models\User $user */
        $user = User::factory()->create();
        $user->givePermissionTo('part-sales-delete');

        $partSale = PartSale::create([
            'sale_number' => 'SAL202604080201',
            'customer_id' => null,
            'sale_date' => '2026-04-08',
            'subtotal' => 50000,
            'discount_type' => 'none',
            'discount_value' => 0,
            'discount_amount' => 0,
            'tax_type' => 'none',
            'tax_value' => 0,
            'tax_amount' => 0,
            'grand_total' => 50000,
            'paid_amount' => 0,
            'remaining_amount' => 50000,
            'payment_status' => 'unpaid',
            'status' => 'draft',
            'created_by' => $user->id,
        ]);

        Http::fake([
            'http://127.0.0.1:8081/api/v1/part-sales/' . $partSale->id => Http::response([
                'ok' => true,
                'message' => 'Penjualan berhasil dihapus',
                'sale_id' => $partSale->id,
            ], 200),
        ]);

        $response = $this->actingAs($user)
            ->delete(route('part-sales.destroy', ['partSale' => $partSale->id]));

        $response->assertRedirect(route('part-sales.index'));
        $response->assertSessionHas('success', 'Penjualan berhasil dihapus');
    }

    public function test_part_sale_show_proxy_returns_go_payload_shape(): void
    {
        config()->set('go_backend.features.part_sale_show', true);
        config()->set('go_backend.base_url', 'http://127.0.0.1:8081');

        Permission::firstOrCreate(['name' => 'part-sales-show', 'guard_name' => 'web']);

        /** @var \App\Models\User $user */
        $user = User::factory()->create();
        $user->givePermissionTo('part-sales-show');

        $partSale = PartSale::create([
            'sale_number' => 'SAL202604080202',
            'customer_id' => null,
            'sale_date' => '2026-04-08',
            'subtotal' => 65000,
            'discount_type' => 'none',
            'discount_value' => 0,
            'discount_amount' => 0,
            'tax_type' => 'none',
            'tax_value' => 0,
            'tax_amount' => 0,
            'grand_total' => 65000,
            'paid_amount' => 0,
            'remaining_amount' => 65000,
            'payment_status' => 'unpaid',
            'status' => 'draft',
            'created_by' => $user->id,
        ]);

        Http::fake([
            'http://127.0.0.1:8081/api/v1/part-sales/' . $partSale->id => Http::response([
                'sale' => [
                    'id' => $partSale->id,
                    'sale_number' => 'SAL202604080202',
                    'sale_date' => '2026-04-08',
                    'status' => 'draft',
                    'payment_status' => 'unpaid',
                    'details' => [],
                    'customer' => null,
                    'creator' => [
                        'id' => $user->id,
                        'name' => $user->name,
                    ],
                ],
                'businessProfile' => [
                    'business_name' => 'POS Bengkel',
                ],
                'cashDenominations' => [],
            ], 200),
        ]);

        $response = $this->actingAs($user)
            ->get(route('part-sales.show', ['partSale' => $partSale->id]));

        $response->assertOk();
        $response->assertInertia(fn ($page) => $page
            ->component('Dashboard/Parts/Sales/Show')
            ->where('sale.id', $partSale->id)
            ->where('sale.sale_number', 'SAL202604080202')
            ->where('businessProfile.business_name', 'POS Bengkel')
            ->where('cashDenominations', [])
        );
    }

    public function test_part_sale_print_proxy_returns_go_payload_shape(): void
    {
        config()->set('go_backend.features.part_sale_print', true);
        config()->set('go_backend.base_url', 'http://127.0.0.1:8081');

        Permission::firstOrCreate(['name' => 'part-sales-show', 'guard_name' => 'web']);

        /** @var \App\Models\User $user */
        $user = User::factory()->create();
        $user->givePermissionTo('part-sales-show');

        $partSale = PartSale::create([
            'sale_number' => 'SAL202604080203',
            'customer_id' => null,
            'sale_date' => '2026-04-08',
            'subtotal' => 70000,
            'discount_type' => 'none',
            'discount_value' => 0,
            'discount_amount' => 0,
            'tax_type' => 'none',
            'tax_value' => 0,
            'tax_amount' => 0,
            'grand_total' => 70000,
            'paid_amount' => 0,
            'remaining_amount' => 70000,
            'payment_status' => 'unpaid',
            'status' => 'draft',
            'created_by' => $user->id,
        ]);

        Http::fake([
            'http://127.0.0.1:8081/api/v1/part-sales/' . $partSale->id . '/print' => Http::response([
                'sale' => [
                    'id' => $partSale->id,
                    'sale_number' => 'SAL202604080203',
                    'sale_date' => '2026-04-08',
                    'status' => 'draft',
                    'payment_status' => 'unpaid',
                    'details' => [],
                    'customer' => null,
                    'creator' => [
                        'id' => $user->id,
                        'name' => $user->name,
                    ],
                ],
                'businessProfile' => [
                    'business_name' => 'POS Bengkel',
                ],
            ], 200),
        ]);

        $response = $this->actingAs($user)
            ->get(route('part-sales.print', ['partSale' => $partSale->id]));

        $response->assertOk();
        $response->assertInertia(fn ($page) => $page
            ->component('Dashboard/Parts/Sales/Print')
            ->where('sale.id', $partSale->id)
            ->where('sale.sale_number', 'SAL202604080203')
            ->where('businessProfile.business_name', 'POS Bengkel')
        );
    }

    public function test_part_sale_edit_proxy_returns_go_payload_shape(): void
    {
        config()->set('go_backend.features.part_sale_edit', true);
        config()->set('go_backend.base_url', 'http://127.0.0.1:8081');

        Permission::firstOrCreate(['name' => 'part-sales-edit', 'guard_name' => 'web']);

        /** @var \App\Models\User $user */
        $user = User::factory()->create();
        $user->givePermissionTo('part-sales-edit');

        $partSale = PartSale::create([
            'sale_number' => 'SAL202604080204',
            'customer_id' => null,
            'sale_date' => '2026-04-08',
            'subtotal' => 80000,
            'discount_type' => 'none',
            'discount_value' => 0,
            'discount_amount' => 0,
            'tax_type' => 'none',
            'tax_value' => 0,
            'tax_amount' => 0,
            'grand_total' => 80000,
            'paid_amount' => 0,
            'remaining_amount' => 80000,
            'payment_status' => 'unpaid',
            'status' => 'draft',
            'created_by' => $user->id,
        ]);

        Http::fake([
            'http://127.0.0.1:8081/api/v1/part-sales/' . $partSale->id . '/edit' => Http::response([
                'sale' => [
                    'id' => $partSale->id,
                    'sale_number' => 'SAL202604080204',
                    'customer_id' => null,
                    'sale_date' => '2026-04-08',
                    'notes' => null,
                    'voucher_code' => null,
                    'discount_type' => 'none',
                    'discount_value' => 0,
                    'tax_type' => 'none',
                    'tax_value' => 0,
                    'paid_amount' => 0,
                    'status' => 'draft',
                    'details' => [
                        [
                            'id' => 1,
                            'part_id' => 10,
                            'quantity' => 1,
                            'unit_price' => 80000,
                            'discount_type' => 'none',
                            'discount_value' => 0,
                            'warranty_period_days' => 0,
                            'part' => [
                                'id' => 10,
                                'name' => 'Busi Iridium',
                                'part_number' => 'BSI-010',
                            ],
                        ],
                    ],
                ],
                'customers' => [
                    ['id' => 1, 'name' => 'Customer A'],
                ],
                'parts' => [
                    ['id' => 10, 'name' => 'Busi Iridium', 'part_number' => 'BSI-010', 'sell_price' => 80000, 'stock' => 15],
                ],
                'availableVouchers' => [
                    ['id' => 2, 'code' => 'PROMO10', 'name' => 'Promo 10%', 'scope' => 'all'],
                ],
            ], 200),
        ]);

        $response = $this->actingAs($user)
            ->get(route('part-sales.edit', ['partSale' => $partSale->id]));

        $response->assertOk();
        $response->assertInertia(fn ($page) => $page
            ->component('Dashboard/Parts/Sales/Edit')
            ->where('sale.id', $partSale->id)
            ->where('sale.details.0.part_id', 10)
            ->where('customers.0.name', 'Customer A')
            ->where('parts.0.name', 'Busi Iridium')
            ->where('availableVouchers.0.code', 'PROMO10')
        );
    }

    public function test_part_sale_warranties_index_proxy_returns_go_payload_shape(): void
    {
        config()->set('go_backend.features.part_sale_warranties_index', true);
        config()->set('go_backend.base_url', 'http://127.0.0.1:8081');

        Permission::firstOrCreate(['name' => 'part-sales-access', 'guard_name' => 'web']);

        /** @var \App\Models\User $user */
        $user = User::factory()->create();
        $user->givePermissionTo('part-sales-access');

        Http::fake([
            'http://127.0.0.1:8081/api/v1/part-sales/warranties*' => Http::response([
                'warranties' => [
                    'current_page' => 1,
                    'data' => [
                        [
                            'id' => 401,
                            'source_type' => 'App\\Models\\PartSale',
                            'source_id' => 31,
                            'source_detail_id' => 55,
                            'reference_number' => 'SAL202604080204',
                            'source_date' => '2026-04-08',
                            'source_label' => 'Part Sale',
                            'customer_name' => 'Customer A',
                            'vehicle_label' => 'B1234CD Honda Vario',
                            'mechanic_name' => '-',
                            'item_name' => 'Kampas Rem',
                            'item_number' => 'KR-008',
                            'item_type' => 'part',
                            'warranty_period_days' => 30,
                            'warranty_start_date' => '2026-04-08',
                            'warranty_end_date' => '2026-05-08',
                            'claimed_at' => null,
                            'claim_notes' => null,
                            'resolved_status' => 'Aktif',
                        ],
                    ],
                    'from' => 1,
                    'last_page' => 1,
                    'links' => [
                        ['url' => null, 'label' => '&laquo; Previous', 'active' => false],
                        ['url' => '/part-sales/warranties', 'label' => '1', 'active' => true],
                        ['url' => null, 'label' => 'Next &raquo;', 'active' => false],
                    ],
                    'per_page' => 15,
                    'to' => 1,
                    'total' => 1,
                ],
                'summary' => [
                    'all' => 1,
                    'active' => 1,
                    'expiring' => 0,
                    'expired' => 0,
                    'claimed' => 0,
                ],
                'filters' => [
                    'search' => 'Kampas',
                    'warranty_status' => 'all',
                    'source_type' => 'all',
                    'item_type' => 'all',
                    'customer_id' => '',
                    'vehicle_id' => '',
                    'mechanic_id' => '',
                    'date_from' => '',
                    'date_to' => '',
                    'expiring_in_days' => 30,
                ],
                'customers' => [
                    ['id' => 7, 'name' => 'Customer A'],
                ],
                'vehicles' => [
                    ['id' => 3, 'plate_number' => 'B1234CD', 'brand' => 'Honda', 'model' => 'Vario'],
                ],
                'mechanics' => [
                    ['id' => 2, 'name' => 'Budi'],
                ],
            ], 200),
        ]);

        $response = $this->actingAs($user)
            ->get(route('part-sales.warranties.index', [
                'search' => 'Kampas',
                'warranty_status' => 'all',
            ]));

        $response->assertOk();
        $response->assertInertia(fn ($page) => $page
            ->component('Dashboard/Parts/Sales/Warranties/Index')
            ->where('warranties.total', 1)
            ->where('warranties.data.0.reference_number', 'SAL202604080204')
            ->where('summary.active', 1)
            ->where('filters.search', 'Kampas')
            ->where('customers.0.name', 'Customer A')
        );
    }

    public function test_part_sale_warranties_export_proxy_returns_go_csv_payload_shape(): void
    {
        config()->set('go_backend.features.part_sale_warranties_export', true);
        config()->set('go_backend.base_url', 'http://127.0.0.1:8081');

        Permission::firstOrCreate(['name' => 'part-sales-access', 'guard_name' => 'web']);

        /** @var \App\Models\User $user */
        $user = User::factory()->create();
        $user->givePermissionTo('part-sales-access');

        Http::fake([
            'http://127.0.0.1:8081/api/v1/part-sales/warranties/export*' => Http::response(
                "Sumber,No Referensi,Tanggal Referensi,Pelanggan,Kendaraan,Mekanik,Item,Tipe Item,Periode Garansi (Hari),Mulai Garansi,Akhir Garansi,Status Garansi,Tanggal Klaim,Catatan Klaim\n" .
                "Part Sale,SAL202604080204,2026-04-08,Customer A,B1234CD Honda Vario,-,Kampas Rem,Sparepart,30,2026-04-08,2026-05-08,Aktif,-,-\n",
                200,
                [
                    'Content-Type' => 'text/csv',
                    'Content-Disposition' => 'attachment; filename=unified-warranties-export.csv',
                ]
            ),
        ]);

        $response = $this->actingAs($user)
            ->get(route('part-sales.warranties.export', [
                'search' => 'Kampas',
                'warranty_status' => 'all',
            ]));

        $response->assertStatus(200);
        $this->assertStringStartsWith('text/csv', (string) $response->headers->get('Content-Type'));
        $response->assertHeader('Content-Disposition', 'attachment; filename=unified-warranties-export.csv');
        $this->assertStringContainsString('Sumber,No Referensi,Tanggal Referensi', $response->getContent());
    }

    public function test_part_sale_create_from_order_proxy_returns_go_payload_shape(): void
    {
        config()->set('go_backend.features.part_sale_create_from_order', true);
        config()->set('go_backend.base_url', 'http://127.0.0.1:8081');

        Permission::firstOrCreate(['name' => 'part-sales-create', 'guard_name' => 'web']);

        /** @var \App\Models\User $user */
        $user = User::factory()->create();
        $user->givePermissionTo('part-sales-create');

        $salesOrder = PartSalesOrder::create([
            'order_number' => 'PSO-20260408-001',
            'customer_id' => null,
            'order_date' => '2026-04-08',
            'status' => 'pending',
            'notes' => 'Order untuk dibuat penjualan',
        ]);

        Http::fake([
            'http://127.0.0.1:8081/api/v1/part-sales/create-from-order' => Http::response([
                'ok' => true,
                'sales_order_id' => $salesOrder->id,
            ], 200),
        ]);

        $response = $this->actingAs($user)
            ->post(route('part-sales.create-from-order'), [
                'sales_order_id' => $salesOrder->id,
            ]);

        $response->assertRedirect(route('part-sales.create', ['sales_order_id' => $salesOrder->id]));
    }

    public function test_part_sale_update_status_proxy_returns_go_payload_shape(): void
    {
        config()->set('go_backend.features.part_sale_update_status', true);
        config()->set('go_backend.base_url', 'http://127.0.0.1:8081');

        Permission::firstOrCreate(['name' => 'part-sales-edit', 'guard_name' => 'web']);

        /** @var \App\Models\User $user */
        $user = User::factory()->create();
        $user->givePermissionTo('part-sales-edit');

        $partSale = PartSale::create([
            'sale_number' => 'SAL202604080100',
            'customer_id' => null,
            'sale_date' => '2026-04-08',
            'subtotal' => 13000,
            'discount_type' => 'none',
            'discount_value' => 0,
            'discount_amount' => 0,
            'tax_type' => 'none',
            'tax_value' => 0,
            'tax_amount' => 0,
            'grand_total' => 13000,
            'paid_amount' => 0,
            'remaining_amount' => 13000,
            'payment_status' => 'unpaid',
            'status' => 'draft',
            'created_by' => $user->id,
        ]);

        Http::fake([
            'http://127.0.0.1:8081/api/v1/part-sales/' . $partSale->id . '/update-status' => Http::response([
                'ok' => true,
                'message' => 'Status transaksi berhasil diperbarui',
            ], 200),
        ]);

        $response = $this->actingAs($user)
            ->post(route('part-sales.update-status', ['partSale' => $partSale->id]), [
                'status' => 'confirmed',
            ]);

        $response->assertRedirect();
        $response->assertSessionHas('success', 'Status transaksi berhasil diperbarui');
    }

    public function test_part_sale_claim_warranty_proxy_returns_go_payload_shape(): void
    {
        config()->set('go_backend.features.part_sale_claim_warranty', true);
        config()->set('go_backend.base_url', 'http://127.0.0.1:8081');

        Permission::firstOrCreate(['name' => 'part-sales-warranty-claim', 'guard_name' => 'web']);

        /** @var \App\Models\User $user */
        $user = User::factory()->create();
        $user->givePermissionTo('part-sales-warranty-claim');

        $part = Part::create([
            'part_number' => 'OLI-001',
            'name' => 'Oli Mesin',
            'buy_price' => 50000,
            'sell_price' => 75000,
            'stock' => 10,
            'minimal_stock' => 0,
            'status' => 'active',
            'has_warranty' => true,
            'warranty_duration_days' => 30,
            'warranty_terms' => 'Garansi 30 hari',
        ]);

        $partSale = PartSale::create([
            'sale_number' => 'SAL202604080101',
            'customer_id' => null,
            'sale_date' => '2026-04-08',
            'subtotal' => 75000,
            'discount_type' => 'none',
            'discount_value' => 0,
            'discount_amount' => 0,
            'tax_type' => 'none',
            'tax_value' => 0,
            'tax_amount' => 0,
            'grand_total' => 75000,
            'paid_amount' => 75000,
            'remaining_amount' => 0,
            'payment_status' => 'paid',
            'status' => 'completed',
            'created_by' => $user->id,
        ]);

        $detail = PartSaleDetail::create([
            'part_sale_id' => $partSale->id,
            'part_id' => $part->id,
            'quantity' => 1,
            'reserved_quantity' => 0,
            'unit_price' => 75000,
            'subtotal' => 75000,
            'discount_type' => 'none',
            'discount_value' => 0,
            'discount_amount' => 0,
            'final_amount' => 75000,
            'source_purchase_detail_id' => null,
            'cost_price' => 50000,
            'selling_price' => 75000,
            'warranty_period_days' => 30,
            'warranty_start_date' => '2026-04-08',
            'warranty_end_date' => '2026-05-08',
            'warranty_claimed_at' => null,
            'warranty_claim_notes' => null,
        ]);

        Http::fake([
            'http://127.0.0.1:8081/api/v1/part-sales/' . $partSale->id . '/details/' . $detail->id . '/claim-warranty' => Http::response([
                'ok' => true,
                'message' => 'Klaim garansi berhasil dicatat',
            ], 200),
        ]);

        $response = $this->actingAs($user)
            ->post(route('part-sales.details.claim-warranty', [
                'partSale' => $partSale->id,
                'detail' => $detail->id,
            ]), [
                'warranty_claim_notes' => 'Produk bermasalah saat dipasang',
            ]);

        $response->assertRedirect();
        $response->assertSessionHas('success', 'Klaim garansi berhasil dicatat');
    }

    public function test_service_order_index_proxy_returns_go_payload_shape(): void
    {
        config()->set('go_backend.features.service_order_index', true);
        config()->set('go_backend.base_url', 'http://127.0.0.1:8081');

        Permission::firstOrCreate(['name' => 'service-orders-access', 'guard_name' => 'web']);

        /** @var \App\Models\User $user */
        $user = User::factory()->create();
        $user->givePermissionTo('service-orders-access');

        Http::fake([
            'http://127.0.0.1:8081/api/v1/service-orders*' => Http::response([
                'orders' => [
                    'current_page' => 1,
                    'data' => [
                        [
                            'id' => 1,
                            'order_number' => 'SO-ABC123XY',
                            'status' => 'pending',
                            'total' => 500000,
                            'labor_cost' => 300000,
                            'material_cost' => 200000,
                            'created_at' => '2026-04-08T10:00:00+07:00',
                            'customer' => [
                                'id' => 1,
                                'name' => 'Customer A',
                            ],
                            'vehicle' => [
                                'id' => 1,
                                'plate_number' => 'B1234CD',
                                'brand' => 'Honda',
                                'model' => 'Vario',
                            ],
                            'mechanic' => [
                                'id' => 1,
                                'name' => 'Iwan',
                            ],
                            'details' => [
                                [
                                    'id' => 1,
                                    'qty' => 2,
                                    'price' => 100000,
                                    'amount' => 200000,
                                    'final_amount' => 200000,
                                    'service' => [
                                        'id' => 1,
                                        'name' => 'Oil Change',
                                    ],
                                    'part' => null,
                                ],
                            ],
                        ],
                    ],
                    'per_page' => 15,
                    'total' => 1,
                    'last_page' => 1,
                    'from' => 1,
                    'to' => 1,
                ],
                'stats' => [
                    'pending' => 5,
                    'in_progress' => 3,
                    'completed' => 10,
                    'paid' => 8,
                    'total_revenue' => 5000000,
                ],
                'mechanics' => [
                    ['id' => 1, 'name' => 'Iwan'],
                    ['id' => 2, 'name' => 'Budi'],
                ],
                'filters' => [
                    'search' => '',
                    'status' => '',
                    'date_from' => '',
                    'date_to' => '',
                    'mechanic_id' => '',
                ],
            ], 200),
        ]);

        $response = $this->actingAs($user)
            ->get(route('service-orders.index'));

        $response->assertOk();
        $response->assertInertia(fn ($page) => $page
            ->component('Dashboard/ServiceOrders/Index')
            ->where('orders.total', 1)
            ->where('orders.data.0.order_number', 'SO-ABC123XY')
            ->where('orders.data.0.status', 'pending')
            ->where('stats.pending', 5)
            ->where('stats.in_progress', 3)
            ->where('stats.completed', 10)
            ->where('stats.paid', 8)
            -> where('stats.total_revenue', 5000000)
            ->where('mechanics.0.name', 'Iwan')
        );
    }

    public function test_service_order_show_proxy_returns_go_payload_shape(): void
    {
        config()->set('go_backend.features.service_order_show', true);
        config()->set('go_backend.base_url', 'http://127.0.0.1:8081');

        Permission::firstOrCreate(['name' => 'service-orders-access', 'guard_name' => 'web']);

        /** @var \App\Models\User $user */
        $user = User::factory()->create();
        $user->givePermissionTo('service-orders-access');

        Http::fake([
            'http://127.0.0.1:8081/api/v1/service-orders/1' => Http::response([
                'order' => [
                    'id' => 1,
                    'order_number' => 'SO-ABC123XY',
                    'status' => 'pending',
                    'total' => 500000,
                    'labor_cost' => 300000,
                    'material_cost' => 200000,
                    'odometer_km' => 42000,
                    'created_at' => '2026-04-08T10:00:00+07:00',
                    'estimated_start_at' => '2026-04-08T11:00:00+07:00',
                    'estimated_finish_at' => '2026-04-08T13:00:00+07:00',
                    'actual_start_at' => null,
                    'actual_finish_at' => null,
                    'warranty_period' => 0,
                    'notes' => 'Service order notes',
                    'maintenance_type' => 'Regular',
                    'next_service_km' => 44000,
                    'next_service_date' => '2026-05-08',
                    'customer' => [
                        'id' => '1',
                        'name' => 'Customer A',
                        'phone' => '081234567890',
                    ],
                    'vehicle' => [
                        'id' => 1,
                        'plate_number' => 'B1234CD',
                        'brand' => 'Honda',
                        'model' => 'Vario',
                        'year' => '2024',
                        'km' => '42000',
                    ],
                    'mechanic' => [
                        'id' => 1,
                        'name' => 'Iwan',
                    ],
                    'details' => [
                        [
                            'id' => 1,
                            'qty' => 1,
                            'price' => 300000,
                            'amount' => 300000,
                            'final_amount' => 300000,
                            'service' => [
                                'id' => 1,
                                'name' => 'Oil Change',
                                'description' => 'Change engine oil',
                                'price' => 150000,
                            ],
                            'part' => null,
                        ],
                        [
                            'id' => 2,
                            'qty' => 2,
                            'price' => 100000,
                            'amount' => 200000,
                            'final_amount' => 200000,
                            'service' => null,
                            'part' => [
                                'id' => 1,
                                'name' => 'Spark Plug',
                                'part_number' => 'SP-001',
                            ],
                        ],
                    ],
                ],
                'warrantyRegistrations' => [
                    '1' => [
                        'id' => 1,
                        'status' => 'active',
                        'warranty_period_days' => 30,
                        'warranty_start_date' => '2026-04-08',
                        'warranty_end_date' => '2026-05-08',
                        'claimed_at' => '',
                        'claim_notes' => '',
                    ],
                ],
                'permissions' => [
                    'can_view_customers' => true,
                    'can_view_vehicles' => true,
                    'can_view_mechanics' => true,
                ],
            ], 200),
        ]);

        $response = $this->actingAs($user)
            ->get(route('service-orders.show', ['id' => 1]));

        $response->assertOk();
        $response->assertInertia(fn ($page) => $page
            ->component('Dashboard/ServiceOrders/Show')
            ->where('order.order_number', 'SO-ABC123XY')
            ->where('order.status', 'pending')
            ->where('order.total', 500000)
            ->where('order.details.0.service.name', 'Oil Change')
            ->where('order.details.1.part.name', 'Spark Plug')
            ->where('warrantyRegistrations.1.status', 'active')
            ->where('permissions.can_view_customers', true)
        );
    }

    public function test_service_order_print_proxy_returns_go_payload_shape(): void
    {
        config()->set('go_backend.features.service_order_print', true);
        config()->set('go_backend.base_url', 'http://127.0.0.1:8081');

        Permission::firstOrCreate(['name' => 'service-orders-access', 'guard_name' => 'web']);

        /** @var \App\Models\User $user */
        $user = User::factory()->create();
        $user->givePermissionTo('service-orders-access');

        Http::fake([
            'http://127.0.0.1:8081/api/v1/service-orders/1/print' => Http::response([
                'order' => [
                    'id' => 1,
                    'order_number' => 'SO-ABC123XY',
                    'status' => 'pending',
                    'total' => 500000,
                    'discount_amount' => 10000,
                    'tax_amount' => 25000,
                    'grand_total' => 515000,
                    'created_at' => '2026-04-08T10:00:00+07:00',
                    'customer' => [
                        'id' => '1',
                        'name' => 'Customer A',
                        'phone' => '081234567890',
                    ],
                    'vehicle' => [
                        'id' => 1,
                        'plate_number' => 'B1234CD',
                        'brand' => 'Honda',
                        'model' => 'Vario',
                        'year' => '2024',
                        'km' => '42000',
                    ],
                    'mechanic' => [
                        'id' => 1,
                        'name' => 'Iwan',
                    ],
                    'details' => [
                        [
                            'id' => 1,
                            'qty' => 1,
                            'price' => 300000,
                            'amount' => 300000,
                            'final_amount' => 300000,
                            'service' => [
                                'id' => 1,
                                'name' => 'Oil Change',
                            ],
                            'part' => null,
                        ],
                    ],
                ],
                'businessProfile' => [
                    'business_name' => 'POS Bengkel',
                    'business_phone' => '081234567890',
                    'business_address' => 'Jl. Contoh No. 1',
                ],
            ], 200),
        ]);

        $response = $this->actingAs($user)
            ->get(route('service-orders.print', ['id' => 1]));

        $response->assertOk();
        $response->assertInertia(fn ($page) => $page
            ->component('Dashboard/ServiceOrders/Print')
            ->where('order.order_number', 'SO-ABC123XY')
            ->where('order.customer.name', 'Customer A')
            ->where('order.vehicle.plate_number', 'B1234CD')
            ->where('order.details.0.service.name', 'Oil Change')
            ->where('businessProfile.business_name', 'POS Bengkel')
        );
    }

    /**
     * Test service order edit form endpoint bridges to Go when enabled
     * Validates that the editable order plus selection data is returned through the Go bridge
     */
    public function test_service_order_edit_proxy_returns_go_payload_shape(): void
    {
        config()->set('go_backend.features.service_order_edit', true);
        config()->set('go_backend.base_url', 'http://127.0.0.1:8081');

        Permission::firstOrCreate(['name' => 'service-orders-update', 'guard_name' => 'web']);
        app(\Spatie\Permission\PermissionRegistrar::class)->forgetCachedPermissions();

        /** @var \App\Models\User $user */
        $user = User::factory()->create();
        $user->givePermissionTo('service-orders-update');

        Http::fake([
            'http://127.0.0.1:8081/api/v1/service-orders/1/edit' => Http::response([
                'order' => [
                    'id' => 1,
                    'order_number' => 'SO-ABC123XY',
                    'status' => 'pending',
                    'odometer_km' => 42000,
                    'notes' => 'Service order notes',
                    'maintenance_type' => 'Regular',
                    'next_service_km' => 44000,
                    'next_service_date' => '2026-05-08',
                    'customer' => [
                        'id' => '1',
                        'name' => 'Customer A',
                        'phone' => '081234567890',
                    ],
                    'vehicle' => [
                        'id' => 1,
                        'plate_number' => 'B1234CD',
                        'brand' => 'Honda',
                        'model' => 'Vario',
                        'year' => '2024',
                        'km' => '42000',
                    ],
                    'mechanic' => [
                        'id' => 1,
                        'name' => 'Iwan',
                    ],
                    'details' => [
                        [
                            'id' => 1,
                            'qty' => 1,
                            'price' => 300000,
                            'amount' => 300000,
                            'final_amount' => 300000,
                            'service' => [
                                'id' => 1,
                                'name' => 'Oil Change',
                            ],
                            'part' => null,
                        ],
                    ],
                    'tags' => [
                        [
                            'id' => 1,
                            'name' => 'urgent',
                        ],
                    ],
                ],
                'customers' => [
                    [
                        'id' => 1,
                        'name' => 'Customer A',
                        'email' => 'customer@example.com',
                        'phone' => '081234567890',
                        'vehicles' => [
                            [
                                'id' => 1,
                                'plate_number' => 'B1234CD',
                                'type' => 'Motor',
                                'brand' => 'Honda',
                                'model' => 'Vario',
                            ],
                        ],
                    ],
                ],
                'vehicles' => [
                    [
                        'id' => 1,
                        'plate_number' => 'B1234CD',
                        'type' => 'Motor',
                        'brand' => 'Honda',
                        'model' => 'Vario',
                        'customer_id' => 1,
                        'customer' => [
                            'id' => 1,
                            'name' => 'Customer A',
                        ],
                    ],
                ],
                'mechanics' => [
                    [
                        'id' => 1,
                        'name' => 'Iwan',
                        'status' => 'active',
                    ],
                ],
                'services' => [
                    [
                        'id' => 1,
                        'name' => 'Oil Change',
                        'description' => 'Change engine oil',
                        'price' => 150000,
                    ],
                ],
                'parts' => [
                    [
                        'id' => 1,
                        'name' => 'Spark Plug',
                        'part_number' => 'SP-001',
                        'quantity' => 10,
                        'category' => [
                            'id' => 1,
                            'name' => 'Electrical',
                        ],
                    ],
                ],
                'tags' => [
                    [
                        'id' => 1,
                        'name' => 'urgent',
                    ],
                ],
                'availableVouchers' => [
                    [
                        'id' => 1,
                        'code' => 'SAVE10',
                        'name' => 'Save 10%',
                        'scope' => 'general',
                    ],
                ],
            ], 200),
        ]);

        $response = $this->actingAs($user)
            ->get(route('service-orders.edit', ['id' => 1]));

        $response->assertOk();
        $response->assertInertia(fn ($page) => $page
            ->component('Dashboard/ServiceOrders/Edit')
            ->where('order.order_number', 'SO-ABC123XY')
            ->where('order.tags.0.name', 'urgent')
            ->where('customers.0.name', 'Customer A')
            ->where('vehicles.0.plate_number', 'B1234CD')
            ->where('mechanics.0.name', 'Iwan')
            ->where('services.0.name', 'Oil Change')
            ->where('parts.0.name', 'Spark Plug')
            ->where('tags.0.name', 'urgent')
            ->where('availableVouchers.0.code', 'SAVE10')
        );
    }

    /**
     * Test service order create form endpoint bridges to Go when enabled
     * Validates that form prep data (customers, vehicles, mechanics, services, parts, tags, active orders, vouchers)
     * is properly returned through the Go bridge
     */
    public function test_service_order_create_proxy_returns_go_payload_shape(): void
    {
        config()->set('go_backend.features.service_order_create', true);
        config()->set('go_backend.base_url', 'http://127.0.0.1:8081');

        Permission::firstOrCreate(['name' => 'service-orders-access', 'guard_name' => 'web']);
        Permission::firstOrCreate(['name' => 'service-orders-create', 'guard_name' => 'web']);
        app(\Spatie\Permission\PermissionRegistrar::class)->forgetCachedPermissions();

        /** @var \App\Models\User $user */
        $user = User::factory()->create();
        $user->givePermissionTo(['service-orders-access', 'service-orders-create']);

        Http::fake([
            'http://127.0.0.1:8081/api/v1/service-orders/create' => Http::response([
                'customers' => [
                    [
                        'id' => 1,
                        'name' => 'John Doe',
                        'email' => 'john@example.com',
                        'phone' => '081234567890',
                        'vehicles' => [
                            [
                                'id' => 1,
                                'plate_number' => 'B1234CD',
                                'type' => 'Motor',
                                'brand' => 'Honda',
                                'model' => 'Vario',
                            ],
                        ],
                    ],
                ],
                'vehicles' => [
                    [
                        'id' => 1,
                        'plate_number' => 'B1234CD',
                        'type' => 'Motor',
                        'brand' => 'Honda',
                        'model' => 'Vario',
                        'customer_id' => 1,
                        'customer' => [
                            'id' => 1,
                            'name' => 'John Doe',
                        ],
                    ],
                ],
                'mechanics' => [
                    [
                        'id' => 1,
                        'name' => 'Iwan',
                        'status' => 'active',
                    ],
                ],
                'services' => [
                    [
                        'id' => 1,
                        'name' => 'Oil Change',
                        'description' => 'Change engine oil',
                        'price' => 150000,
                    ],
                ],
                'parts' => [
                    [
                        'id' => 1,
                        'name' => 'Spark Plug',
                        'part_number' => 'SP-001',
                        'quantity' => 10,
                        'category' => [
                            'id' => 1,
                            'name' => 'Electrical',
                        ],
                    ],
                ],
                'tags' => [
                    [
                        'id' => 1,
                        'name' => 'urgent',
                    ],
                ],
                'activeServiceOrders' => [
                    [
                        'id' => 1,
                        'order_number' => 'SO-001',
                        'status' => 'pending',
                        'vehicle' => [
                            'id' => 1,
                            'plate_number' => 'B1234CD',
                        ],
                    ],
                ],
                'availableVouchers' => [
                    [
                        'id' => 1,
                        'code' => 'SAVE10',
                        'name' => 'Save 10%',
                        'scope' => 'general',
                    ],
                ],
            ], 200),
        ]);

        $response = $this->actingAs($user)
            ->get(route('service-orders.create'));

        $response->assertOk();
        $response->assertInertia(fn ($page) => $page
            ->component('Dashboard/ServiceOrders/Create')
            ->where('customers.0.name', 'John Doe')
            ->where('customers.0.vehicles.0.plate_number', 'B1234CD')
            ->where('vehicles.0.plate_number', 'B1234CD')
            ->where('mechanics.0.name', 'Iwan')
            ->where('services.0.name', 'Oil Change')
            ->where('parts.0.name', 'Spark Plug')
            ->where('tags.0.name', 'urgent')
            ->has('activeServiceOrders', 1)
            ->where('activeServiceOrders.0.order_number', 'SO-001')
            ->has('availableVouchers', 1)
            ->where('availableVouchers.0.code', 'SAVE10')
        );
    }

    public function test_service_order_update_status_proxy_returns_go_payload_shape(): void
    {
        config()->set('go_backend.features.service_order_update_status', true);
        config()->set('go_backend.base_url', 'http://127.0.0.1:8081');

        Permission::firstOrCreate(['name' => 'service-orders-update', 'guard_name' => 'web']);

        /** @var \App\Models\User $user */
        $user = User::factory()->create();
        $user->givePermissionTo('service-orders-update');

        Http::fake([
            'http://127.0.0.1:8081/api/v1/service-orders/1/status' => Http::response([
                'message' => 'Status updated.',
                'order' => [
                    'id' => 1,
                    'status' => 'completed',
                    'odometer_km' => 45000,
                ],
            ], 200),
        ]);

        $response = $this->actingAs($user)
            ->post(route('service-orders.update-status', ['id' => 1]), [
                'status' => 'completed',
                'odometer_km' => 45000,
            ]);

        $response->assertRedirect();
        $response->assertSessionHas('success', 'Status updated.');
    }

    public function test_service_order_store_proxy_returns_go_payload_shape(): void
    {
        config()->set('go_backend.features.service_order_store', true);
        config()->set('go_backend.base_url', 'http://127.0.0.1:8081');

        Permission::firstOrCreate(['name' => 'service-orders-create', 'guard_name' => 'web']);

        /** @var \App\Models\User $user */
        $user = User::factory()->create();
        $user->givePermissionTo('service-orders-create');

        Http::fake([
            'http://127.0.0.1:8081/api/v1/service-orders' => Http::response([
                'message' => 'Service order created.',
                'order' => [
                    'id' => 1201,
                    'order_number' => 'SO-TEST1201',
                    'status' => 'pending',
                ],
            ], 200),
        ]);

        $response = $this->actingAs($user)
            ->post(route('service-orders.store'), [
                'submission_token' => 'tok-1201',
                'odometer_km' => 45000,
                'items' => [
                    [
                        'service_id' => null,
                        'parts' => [
                            [
                                'part_id' => null,
                                'qty' => 1,
                                'price' => 10000,
                            ],
                        ],
                    ],
                ],
            ]);

        $response->assertRedirect(route('service-orders.index'));
        $response->assertSessionHas('success', 'Service order created.');
    }

    public function test_service_order_update_proxy_returns_go_payload_shape(): void
    {
        config()->set('go_backend.features.service_order_update', true);
        config()->set('go_backend.base_url', 'http://127.0.0.1:8081');

        Permission::firstOrCreate(['name' => 'service-orders-update', 'guard_name' => 'web']);

        /** @var \App\Models\User $user */
        $user = User::factory()->create();
        $user->givePermissionTo('service-orders-update');

        Http::fake([
            'http://127.0.0.1:8081/api/v1/service-orders/77' => Http::response([
                'message' => 'Service order updated.',
                'order' => [
                    'id' => 77,
                ],
            ], 200),
        ]);

        $response = $this->actingAs($user)
            ->put(route('service-orders.update', ['id' => 77]), [
                'odometer_km' => 46000,
                'items' => [
                    [
                        'service_id' => null,
                        'parts' => [
                            [
                                'part_id' => null,
                                'qty' => 1,
                                'price' => 12000,
                            ],
                        ],
                    ],
                ],
            ]);

        $response->assertRedirect(route('service-orders.show', 77));
        $response->assertSessionHas('success', 'Service order updated.');
    }

    public function test_service_order_claim_warranty_proxy_returns_go_payload_shape(): void
    {
        config()->set('go_backend.features.service_order_claim_warranty', true);
        config()->set('go_backend.base_url', 'http://127.0.0.1:8081');

        Permission::firstOrCreate(['name' => 'service-orders-update', 'guard_name' => 'web']);

        /** @var \App\Models\User $user */
        $user = User::factory()->create();
        $user->givePermissionTo('service-orders-update');

        Http::fake([
            'http://127.0.0.1:8081/api/v1/service-orders/12/details/34/claim-warranty' => Http::response([
                'ok' => true,
                'message' => 'Klaim garansi berhasil dicatat',
            ], 200),
        ]);

        $response = $this->actingAs($user)
            ->post(route('service-orders.details.claim-warranty', ['id' => 12, 'detailId' => 34]), [
                'claim_notes' => 'Klaim dari test',
            ]);

        $response->assertRedirect();
        $response->assertSessionHas('success', 'Klaim garansi berhasil dicatat');
    }

    public function test_service_order_destroy_proxy_returns_go_payload_shape(): void
    {
        config()->set('go_backend.features.service_order_destroy', true);
        config()->set('go_backend.base_url', 'http://127.0.0.1:8081');

        Permission::firstOrCreate(['name' => 'service-orders-delete', 'guard_name' => 'web']);

        /** @var \App\Models\User $user */
        $user = User::factory()->create();
        $user->givePermissionTo('service-orders-delete');

        Http::fake([
            'http://127.0.0.1:8081/api/v1/service-orders/88' => Http::response([
                'message' => 'Service order deleted.',
                'order_id' => 88,
            ], 200),
        ]);

        $response = $this->actingAs($user)
            ->delete(route('service-orders.destroy', ['id' => 88]));

        $response->assertRedirect(route('service-orders.index'));
        $response->assertSessionHas('success', 'Service order deleted.');
    }

    public function test_service_order_quick_intake_create_proxy_returns_go_payload_shape(): void
    {
        config()->set('go_backend.features.service_order_quick_intake_create', true);
        config()->set('go_backend.base_url', 'http://127.0.0.1:8081');

        Permission::firstOrCreate(['name' => 'service-orders-create', 'guard_name' => 'web']);

        /** @var \App\Models\User $user */
        $user = User::factory()->create();
        $user->givePermissionTo('service-orders-create');

        Http::fake([
            'http://127.0.0.1:8081/api/v1/service-orders/quick-intake' => Http::response([
                'mechanics' => [
                    ['id' => 1, 'name' => 'Budi'],
                ],
            ], 200),
        ]);

        $response = $this->actingAs($user)
            ->get(route('service-orders.quick-intake.create'));

        $response->assertOk();
        $response->assertInertia(fn ($page) => $page
            ->component('Dashboard/ServiceOrders/QuickIntake')
            ->where('mechanics.0.id', 1)
            ->where('mechanics.0.name', 'Budi')
        );
    }

    public function test_service_order_quick_intake_store_proxy_returns_go_payload_shape(): void
    {
        config()->set('go_backend.features.service_order_quick_intake_store', true);
        config()->set('go_backend.base_url', 'http://127.0.0.1:8081');

        Permission::firstOrCreate(['name' => 'service-orders-create', 'guard_name' => 'web']);

        /** @var \App\Models\User $user */
        $user = User::factory()->create();
        $user->givePermissionTo('service-orders-create');

        Http::fake([
            'http://127.0.0.1:8081/api/v1/service-orders/quick-intake' => Http::response([
                'message' => 'Penerimaan konsumen berhasil dibuat.',
                'order_id' => 1234,
                'submit_mode' => 'create_again',
                'order' => [
                    'id' => 1234,
                    'status' => 'pending',
                ],
            ], 200),
        ]);

        $response = $this->actingAs($user)
            ->post(route('service-orders.quick-intake.store'), [
                'customer_name' => 'Customer Quick',
                'customer_phone' => '081200000123',
                'plate_number' => 'B1234CD',
                'odometer_km' => 12000,
                'submit_mode' => 'create_again',
            ]);

        $response->assertRedirect(route('service-orders.quick-intake.create'));
        $response->assertSessionHas('success', 'Penerimaan konsumen berhasil dibuat.');
    }
}
