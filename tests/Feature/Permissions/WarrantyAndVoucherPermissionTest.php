<?php

namespace Tests\Feature\Permissions;

use Tests\TestCase;
use App\Models\User;
use PHPUnit\Framework\Attributes\Test;
use Spatie\Permission\Models\Role;
use Spatie\Permission\Models\Permission;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Foundation\Http\Middleware\ValidateCsrfToken;

class WarrantyAndVoucherPermissionTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        $this->withoutMiddleware(ValidateCsrfToken::class);

        Role::create(['name' => 'super-admin']);
        Role::create(['name' => 'user']);

        Permission::create(['name' => 'vouchers-access']);
        Permission::create(['name' => 'service-orders-update']);
    }

    #[Test]
    public function user_without_voucher_permission_cannot_access_voucher_index()
    {
        $user = User::create([
            'name' => 'No Voucher Access',
            'email' => 'novoucher@example.com',
            'password' => bcrypt('password'),
        ]);
        $user->assignRole('user');

        $response = $this->actingAs($user)->get(route('vouchers.index'));

        $response->assertStatus(302);
    }

    #[Test]
    public function user_with_voucher_permission_can_access_voucher_index()
    {
        $user = User::create([
            'name' => 'Voucher Access',
            'email' => 'voucher@example.com',
            'password' => bcrypt('password'),
        ]);
        $user->assignRole('user');
        $user->givePermissionTo('vouchers-access');

        $response = $this->actingAs($user)->get(route('vouchers.index'));

        $response->assertOk();
    }

    #[Test]
    public function user_without_service_order_update_permission_cannot_claim_warranty()
    {
        $user = User::create([
            'name' => 'No SO Update',
            'email' => 'noso@example.com',
            'password' => bcrypt('password'),
        ]);
        $user->assignRole('user');

        $response = $this->actingAs($user)->post(route('service-orders.details.claim-warranty', [
            'id' => 99999,
            'detailId' => 99999,
        ]), [
            'claim_notes' => 'test',
        ]);

        $response->assertStatus(302);
    }
}
