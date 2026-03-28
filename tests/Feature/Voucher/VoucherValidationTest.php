<?php

namespace Tests\Feature\Voucher;

use Tests\TestCase;
use App\Models\Customer;
use App\Models\Voucher;
use App\Models\VoucherEligibility;
use App\Services\VoucherService;
use PHPUnit\Framework\Attributes\Test;
use Spatie\Permission\Models\Role;
use Illuminate\Validation\ValidationException;
use Illuminate\Foundation\Testing\RefreshDatabase;

class VoucherValidationTest extends TestCase
{
    use RefreshDatabase;

    protected VoucherService $voucherService;

    protected function setUp(): void
    {
        parent::setUp();
        $this->voucherService = app(VoucherService::class);
        Role::create(['name' => 'super-admin']);
    }

    #[Test]
    public function valid_voucher_passes_validation_and_calculates_discount()
    {
        Voucher::query()->create([
            'code' => 'SUMMER2026',
            'name' => 'Summer Voucher',
            'is_active' => true,
            'starts_at' => now()->subDay(),
            'ends_at' => now()->addDay(),
            'quota_total' => 100,
            'quota_used' => 0,
            'limit_per_customer' => 2,
            'discount_type' => 'percent',
            'discount_value' => 10,
            'scope' => 'transaction',
            'min_purchase' => 100000,
            'max_discount' => null,
            'can_combine_with_discount' => true,
        ]);

        $result = $this->voucherService->validateForTransaction('SUMMER2026', [
            'customer_id' => 1,
            'subtotal' => 500000,
            'part_ids' => [10],
            'part_category_ids' => [20],
            'service_ids' => [],
            'service_category_ids' => [],
            'transaction_discount_type' => 'none',
            'transaction_discount_value' => 0,
        ]);

        $this->assertNotNull($result['voucher']);
        $this->assertEquals('SUMMER2026', $result['voucher']->code);
        $this->assertEquals(50000, $result['discount_amount']);
    }

    #[Test]
    public function expired_voucher_fails_validation()
    {
        Voucher::query()->create([
            'code' => 'EXPIRED',
            'name' => 'Expired Voucher',
            'is_active' => true,
            'starts_at' => now()->subDays(10),
            'ends_at' => now()->subDay(),
            'discount_type' => 'fixed',
            'discount_value' => 10000,
            'scope' => 'transaction',
            'min_purchase' => 0,
        ]);

        $this->expectException(ValidationException::class);
        $this->voucherService->validateForTransaction('EXPIRED', [
            'customer_id' => 1,
            'subtotal' => 100000,
        ]);
    }

    #[Test]
    public function voucher_with_exceeded_quota_fails()
    {
        Voucher::query()->create([
            'code' => 'LIMITED',
            'name' => 'Limited Voucher',
            'is_active' => true,
            'starts_at' => now()->subDay(),
            'ends_at' => now()->addDay(),
            'quota_total' => 5,
            'quota_used' => 5,
            'discount_type' => 'fixed',
            'discount_value' => 5000,
            'scope' => 'transaction',
            'min_purchase' => 0,
        ]);

        $this->expectException(ValidationException::class);
        $this->voucherService->validateForTransaction('LIMITED', [
            'customer_id' => 99,
            'subtotal' => 100000,
        ]);
    }

    #[Test]
    public function voucher_respects_per_customer_limit()
    {
        $customer = Customer::create([
            'name' => 'Voucher Customer',
            'phone' => '08123450000',
        ]);
        $customerId = (int) $customer->id;
        $voucher = Voucher::query()->create([
            'code' => 'CUSTOMER_LIMITED',
            'name' => 'Customer Limited',
            'is_active' => true,
            'starts_at' => now()->subDay(),
            'ends_at' => now()->addDay(),
            'limit_per_customer' => 1,
            'discount_type' => 'fixed',
            'discount_value' => 5000,
            'scope' => 'transaction',
            'min_purchase' => 0,
        ]);

        // Already used once for this customer
        $voucher->usages()->create([
            'source_type' => 'App\\Models\\PartSale',
            'source_id' => 1,
            'customer_id' => $customerId,
            'discount_amount' => 5000,
            'used_at' => now(),
        ]);

        $this->expectException(ValidationException::class);
        $this->voucherService->validateForTransaction('CUSTOMER_LIMITED', [
            'customer_id' => $customerId,
            'subtotal' => 100000,
        ]);
    }

    #[Test]
    public function voucher_scope_item_part_requires_part_items()
    {
        Voucher::query()->create([
            'code' => 'PARTS_ONLY',
            'name' => 'Parts Only',
            'is_active' => true,
            'starts_at' => now()->subDay(),
            'ends_at' => now()->addDay(),
            'discount_type' => 'fixed',
            'discount_value' => 5000,
            'scope' => 'item_part',
            'min_purchase' => 0,
        ]);

        $this->expectException(ValidationException::class);
        $this->voucherService->validateForTransaction('PARTS_ONLY', [
            'customer_id' => 1,
            'subtotal' => 100000,
            'part_ids' => [],
            'service_ids' => [33],
        ]);
    }

    #[Test]
    public function voucher_eligibility_filters_part_ids_correctly()
    {
        $voucher = Voucher::query()->create([
            'code' => 'SELECTIVE',
            'name' => 'Selective',
            'is_active' => true,
            'starts_at' => now()->subDay(),
            'ends_at' => now()->addDay(),
            'discount_type' => 'percent',
            'discount_value' => 10,
            'scope' => 'item_part',
            'min_purchase' => 0,
        ]);

        VoucherEligibility::create([
            'voucher_id' => $voucher->id,
            'eligible_type' => 'part',
            'eligible_id' => 101,
        ]);

        $result = $this->voucherService->validateForTransaction('SELECTIVE', [
            'customer_id' => 1,
            'subtotal' => 200000,
            'part_ids' => [101, 202],
            'part_category_ids' => [],
            'service_ids' => [],
            'service_category_ids' => [],
        ]);

        $this->assertEquals(20000, $result['discount_amount']);

        $this->expectException(ValidationException::class);
        $this->voucherService->validateForTransaction('SELECTIVE', [
            'customer_id' => 1,
            'subtotal' => 200000,
            'part_ids' => [202],
            'part_category_ids' => [],
            'service_ids' => [],
            'service_category_ids' => [],
        ]);
    }

    #[Test]
    public function voucher_rejects_manual_discount_when_combine_is_disabled()
    {
        Voucher::query()->create([
            'code' => 'NOCOMBINE',
            'name' => 'No Combine',
            'is_active' => true,
            'starts_at' => now()->subDay(),
            'ends_at' => now()->addDay(),
            'discount_type' => 'fixed',
            'discount_value' => 10000,
            'scope' => 'transaction',
            'min_purchase' => 0,
            'can_combine_with_discount' => false,
        ]);

        $this->expectException(ValidationException::class);
        $this->voucherService->validateForTransaction('NOCOMBINE', [
            'customer_id' => 1,
            'subtotal' => 150000,
            'transaction_discount_type' => 'percent',
            'transaction_discount_value' => 5,
        ]);
    }

    #[Test]
    public function fixed_voucher_discount_is_capped_by_max_discount_and_subtotal()
    {
        Voucher::query()->create([
            'code' => 'FIXEDHUGE',
            'name' => 'Fixed Huge Voucher',
            'is_active' => true,
            'starts_at' => now()->subDay(),
            'ends_at' => now()->addDay(),
            'discount_type' => 'fixed',
            'discount_value' => 500000,
            'scope' => 'transaction',
            'min_purchase' => 0,
            'max_discount' => 120000,
            'can_combine_with_discount' => true,
        ]);

        $resultHighSubtotal = $this->voucherService->validateForTransaction('FIXEDHUGE', [
            'customer_id' => 1,
            'subtotal' => 300000,
        ]);
        $this->assertEquals(120000, $resultHighSubtotal['discount_amount']);

        $resultLowSubtotal = $this->voucherService->validateForTransaction('FIXEDHUGE', [
            'customer_id' => 1,
            'subtotal' => 100000,
        ]);
        $this->assertEquals(100000, $resultLowSubtotal['discount_amount']);
    }
}
