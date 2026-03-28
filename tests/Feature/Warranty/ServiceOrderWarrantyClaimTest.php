<?php

namespace Tests\Feature\Warranty;

use Tests\TestCase;
use App\Models\Service;
use App\Models\ServiceOrder;
use App\Models\ServiceOrderDetail;
use App\Models\User;
use App\Models\WarrantyRegistration;
use PHPUnit\Framework\Attributes\Test;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\Models\Role;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Foundation\Http\Middleware\ValidateCsrfToken;

class ServiceOrderWarrantyClaimTest extends TestCase
{
    use RefreshDatabase;

    protected User $user;

    protected function setUp(): void
    {
        parent::setUp();

        $this->withoutMiddleware(ValidateCsrfToken::class);

        Role::create(['name' => 'tester']);
        Permission::create(['name' => 'service-orders-update']);

        $this->user = User::create([
            'name' => 'Warranty Tester',
            'email' => 'warranty-tester@example.com',
            'password' => bcrypt('password'),
        ]);
        $this->user->assignRole('tester');
        $this->user->givePermissionTo('service-orders-update');
    }

    #[Test]
    public function it_claims_service_order_warranty_when_still_active()
    {
        [$order, $detail] = $this->createServiceOrderAndDetail();

        $registration = WarrantyRegistration::create([
            'warrantable_type' => Service::class,
            'warrantable_id' => $detail->service_id,
            'source_type' => ServiceOrder::class,
            'source_id' => $order->id,
            'source_detail_id' => $detail->id,
            'warranty_period_days' => 30,
            'warranty_start_date' => now()->subDays(1)->toDateString(),
            'warranty_end_date' => now()->addDays(10)->toDateString(),
            'status' => 'active',
        ]);

        $response = $this->actingAs($this->user)
            ->post(route('service-orders.details.claim-warranty', [
                'id' => $order->id,
                'detailId' => $detail->id,
            ]), [
                'claim_notes' => 'Customer reports issue',
            ]);

        $response->assertStatus(302);
        $response->assertSessionHas('success');

        $registration->refresh();
        $this->assertSame('claimed', $registration->status);
        $this->assertNotNull($registration->claimed_at);
        $this->assertSame('Customer reports issue', $registration->claim_notes);
    }

    #[Test]
    public function it_rejects_claim_for_invalid_detail_mapping()
    {
        [$orderA] = $this->createServiceOrderAndDetail('SO-A-001', 'SVC-A');
        [$orderB, $detailB] = $this->createServiceOrderAndDetail('SO-B-001', 'SVC-B');

        $response = $this->actingAs($this->user)
            ->post(route('service-orders.details.claim-warranty', [
                'id' => $orderA->id,
                'detailId' => $detailB->id,
            ]), [
                'claim_notes' => 'Invalid mapping test',
            ]);

        $response->assertStatus(302);
        $response->assertSessionHasErrors('error');
    }

    #[Test]
    public function it_rejects_claim_when_warranty_is_expired()
    {
        [$order, $detail] = $this->createServiceOrderAndDetail('SO-EXP-001', 'SVC-EXP');

        WarrantyRegistration::create([
            'warrantable_type' => Service::class,
            'warrantable_id' => $detail->service_id,
            'source_type' => ServiceOrder::class,
            'source_id' => $order->id,
            'source_detail_id' => $detail->id,
            'warranty_period_days' => 7,
            'warranty_start_date' => now()->subDays(20)->toDateString(),
            'warranty_end_date' => now()->subDays(1)->toDateString(),
            'status' => 'expired',
        ]);

        $response = $this->actingAs($this->user)
            ->post(route('service-orders.details.claim-warranty', [
                'id' => $order->id,
                'detailId' => $detail->id,
            ]), [
                'claim_notes' => 'Expired test',
            ]);

        $response->assertStatus(302);
        $response->assertSessionHasErrors('error');
    }

    private function createServiceOrderAndDetail(string $orderNumber = 'SO-CLAIM-001', string $serviceCode = 'SVC-CLAIM'): array
    {
        $service = Service::create([
            'code' => $serviceCode,
            'title' => 'Warranty Service ' . $serviceCode,
            'price' => 150000,
            'has_warranty' => true,
            'warranty_duration_days' => 30,
        ]);

        $order = ServiceOrder::create([
            'order_number' => $orderNumber,
            'status' => 'completed',
            'odometer_km' => 20000,
            'labor_cost' => 150000,
            'material_cost' => 0,
            'total' => 150000,
            'discount_type' => 'none',
            'discount_value' => 0,
            'discount_amount' => 0,
            'tax_type' => 'none',
            'tax_value' => 0,
            'tax_amount' => 0,
            'grand_total' => 150000,
            'actual_finish_at' => now(),
        ]);

        $detail = ServiceOrderDetail::create([
            'service_order_id' => $order->id,
            'service_id' => $service->id,
            'qty' => 1,
            'price' => 150000,
            'amount' => 150000,
            'discount_type' => 'none',
            'discount_value' => 0,
            'discount_amount' => 0,
            'final_amount' => 150000,
        ]);

        return [$order, $detail];
    }
}
