<?php

namespace Tests\Feature\PartSale;

use App\Models\Customer;
use App\Models\Part;
use App\Models\PartPurchase;
use App\Models\PartPurchaseDetail;
use App\Models\Supplier;
use App\Models\User;
use App\Models\Voucher;
use App\Models\VoucherEligibility;
use Illuminate\Foundation\Http\Middleware\ValidateCsrfToken;
use Illuminate\Foundation\Testing\RefreshDatabase;
use PHPUnit\Framework\Attributes\Test;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\PermissionRegistrar;
use Tests\TestCase;

class PartSaleVoucherTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        $this->withoutMiddleware(ValidateCsrfToken::class);
        app(PermissionRegistrar::class)->forgetCachedPermissions();
        Permission::firstOrCreate(['name' => 'part-sales-create', 'guard_name' => 'web']);
        Permission::firstOrCreate(['name' => 'part-sales-edit', 'guard_name' => 'web']);
    }

    #[Test]
    public function part_sale_applies_voucher_and_marks_usage()
    {
        $user = User::create([
            'name' => 'Part Sale Operator',
            'email' => 'partsale@example.com',
            'password' => bcrypt('password'),
        ]);
        $user->givePermissionTo('part-sales-create');

        $customer = Customer::create([
            'name' => 'Voucher Customer',
            'phone' => '081234567890',
        ]);

        $supplier = Supplier::create([
            'name' => 'Sparepart Supplier',
            'phone' => '081111111111',
        ]);

        $part = Part::create([
            'part_number' => 'P-001',
            'name' => 'Oli Mesin',
            'buy_price' => 50000,
            'sell_price' => 100000,
            'stock' => 10,
            'supplier_id' => $supplier->id,
            'status' => 'active',
        ]);

        $purchase = PartPurchase::create([
            'purchase_number' => 'PP-001',
            'supplier_id' => $supplier->id,
            'purchase_date' => now()->toDateString(),
            'status' => 'received',
            'total_amount' => 500000,
        ]);

        PartPurchaseDetail::create([
            'part_purchase_id' => $purchase->id,
            'part_id' => $part->id,
            'quantity' => 10,
            'unit_price' => 50000,
            'subtotal' => 500000,
        ]);

        $voucher = Voucher::query()->create([
            'code' => 'PART10',
            'name' => 'Part Sale 10%',
            'is_active' => true,
            'starts_at' => now()->subDay(),
            'ends_at' => now()->addDay(),
            'quota_total' => 5,
            'quota_used' => 0,
            'limit_per_customer' => 1,
            'discount_type' => 'percent',
            'discount_value' => 10,
            'scope' => 'item_part',
            'min_purchase' => 0,
            'max_discount' => null,
            'can_combine_with_discount' => true,
        ]);

        VoucherEligibility::create([
            'voucher_id' => $voucher->id,
            'eligible_type' => 'part',
            'eligible_id' => $part->id,
        ]);

        $payload = [
            'customer_id' => $customer->id,
            'sale_date' => now()->toDateString(),
            'notes' => 'Test part sale voucher',
            'voucher_code' => 'PART10',
            'items' => [[
                'part_id' => $part->id,
                'quantity' => 1,
                'unit_price' => 100000,
                'discount_type' => 'none',
                'discount_value' => 0,
            ]],
            'discount_type' => 'none',
            'discount_value' => 0,
            'tax_type' => 'none',
            'tax_value' => 0,
        ];

        $response = $this->actingAs($user)->post(route('part-sales.store'), $payload);

        $sale = \App\Models\PartSale::query()->latest('id')->first();

        $response->assertRedirect(route('part-sales.show', $sale));

        $this->assertNotNull($sale);
        $this->assertSame($customer->id, (int) $sale->customer_id);
        $this->assertSame($voucher->id, (int) $sale->voucher_id);
        $this->assertSame('PART10', $sale->voucher_code);
        $this->assertSame(10000, (int) $sale->voucher_discount_amount);
        $this->assertSame(90000, (int) $sale->grand_total);

        $this->assertSame(1, (int) $voucher->fresh()->quota_used);
    }

    #[Test]
    public function part_sale_update_replaces_voucher_and_usage()
    {
        $user = User::create([
            'name' => 'Part Sale Operator',
            'email' => 'partsale-update@example.com',
            'password' => bcrypt('password'),
        ]);
        $user->givePermissionTo('part-sales-create', 'part-sales-edit');

        $customer = Customer::create([
            'name' => 'Voucher Customer',
            'phone' => '081234567891',
        ]);

        $supplier = Supplier::create([
            'name' => 'Sparepart Supplier',
            'phone' => '081111111112',
        ]);

        $part = Part::create([
            'part_number' => 'P-002',
            'name' => 'Filter Oli',
            'buy_price' => 40000,
            'sell_price' => 100000,
            'stock' => 10,
            'supplier_id' => $supplier->id,
            'status' => 'active',
        ]);

        $purchase = PartPurchase::create([
            'purchase_number' => 'PP-002',
            'supplier_id' => $supplier->id,
            'purchase_date' => now()->toDateString(),
            'status' => 'received',
            'total_amount' => 400000,
        ]);

        PartPurchaseDetail::create([
            'part_purchase_id' => $purchase->id,
            'part_id' => $part->id,
            'quantity' => 10,
            'unit_price' => 40000,
            'subtotal' => 400000,
        ]);

        $voucherOld = Voucher::query()->create([
            'code' => 'PARTOLD',
            'name' => 'Part Sale Old',
            'is_active' => true,
            'starts_at' => now()->subDay(),
            'ends_at' => now()->addDay(),
            'quota_total' => 5,
            'quota_used' => 0,
            'limit_per_customer' => 1,
            'discount_type' => 'percent',
            'discount_value' => 10,
            'scope' => 'item_part',
            'min_purchase' => 0,
            'max_discount' => null,
            'can_combine_with_discount' => true,
        ]);

        $voucherNew = Voucher::query()->create([
            'code' => 'PARTNEW',
            'name' => 'Part Sale New',
            'is_active' => true,
            'starts_at' => now()->subDay(),
            'ends_at' => now()->addDay(),
            'quota_total' => 5,
            'quota_used' => 0,
            'limit_per_customer' => 1,
            'discount_type' => 'percent',
            'discount_value' => 5,
            'scope' => 'item_part',
            'min_purchase' => 0,
            'max_discount' => null,
            'can_combine_with_discount' => true,
        ]);

        VoucherEligibility::create([
            'voucher_id' => $voucherOld->id,
            'eligible_type' => 'part',
            'eligible_id' => $part->id,
        ]);

        VoucherEligibility::create([
            'voucher_id' => $voucherNew->id,
            'eligible_type' => 'part',
            'eligible_id' => $part->id,
        ]);

        $createPayload = [
            'customer_id' => $customer->id,
            'sale_date' => now()->toDateString(),
            'notes' => 'Initial sale',
            'voucher_code' => 'PARTOLD',
            'status' => 'draft',
            'items' => [[
                'part_id' => $part->id,
                'quantity' => 1,
                'unit_price' => 100000,
                'discount_type' => 'none',
                'discount_value' => 0,
            ]],
            'discount_type' => 'none',
            'discount_value' => 0,
            'tax_type' => 'none',
            'tax_value' => 0,
        ];

        $this->actingAs($user)->post(route('part-sales.store'), $createPayload);
        $sale = \App\Models\PartSale::query()->latest('id')->first();

        $updatePayload = [
            'customer_id' => $customer->id,
            'sale_date' => now()->toDateString(),
            'notes' => 'Updated sale',
            'voucher_code' => 'PARTNEW',
            'status' => 'draft',
            'items' => [[
                'part_id' => $part->id,
                'quantity' => 1,
                'unit_price' => 100000,
                'discount_type' => 'none',
                'discount_value' => 0,
            ]],
            'discount_type' => 'none',
            'discount_value' => 0,
            'tax_type' => 'none',
            'tax_value' => 0,
        ];

        $response = $this->actingAs($user)->put(route('part-sales.update', $sale), $updatePayload);
        $response->assertRedirect(route('part-sales.show', $sale));

        $sale->refresh();

        $this->assertSame($voucherNew->id, (int) $sale->voucher_id);
        $this->assertSame('PARTNEW', $sale->voucher_code);
        $this->assertSame(5000, (int) $sale->voucher_discount_amount);
        $this->assertSame(95000, (int) $sale->grand_total);
        $this->assertSame(0, (int) $voucherOld->fresh()->quota_used);
        $this->assertSame(1, (int) $voucherNew->fresh()->quota_used);
    }
}
