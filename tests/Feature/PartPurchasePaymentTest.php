<?php

namespace Tests\Feature;

use Tests\TestCase;
use Illuminate\Foundation\Testing\RefreshDatabase;
use App\Models\User;
use App\Models\Supplier;
use App\Models\PartPurchase;
use App\Models\CashDenomination;
use App\Models\CashDrawerDenomination;
use App\Models\CashTransaction;
use Spatie\Permission\Models\Permission;
use Illuminate\Support\Facades\DB;

class PartPurchasePaymentTest extends TestCase
{
    use RefreshDatabase;

    public function test_cash_payment_records_outgoing_and_change_incoming()
    {
        $user = User::factory()->create();
        Permission::firstOrCreate(['name' => 'part-purchases-update']);
        $user->givePermissionTo('part-purchases-update');
        $this->actingAs($user);

        $supplier = Supplier::create(['name' => 'Test Supplier']);

        // Create denominations and drawer stock (use existing seeded denominations if present)
        $d100 = CashDenomination::firstOrCreate(['value' => 100000], ['is_active' => true]);
        $d25 = CashDenomination::firstOrCreate(['value' => 25000], ['is_active' => true]);

        DB::table('cash_drawer_denominations')->updateOrInsert(
            ['denomination_id' => $d100->id],
            ['quantity' => 10, 'updated_at' => now(), 'created_at' => now()]
        );
        DB::table('cash_drawer_denominations')->updateOrInsert(
            ['denomination_id' => $d25->id],
            ['quantity' => 10, 'updated_at' => now(), 'created_at' => now()]
        );

        // Create a purchase with grand_total 75000
        $purchase = PartPurchase::create([
            'supplier_id' => $supplier->id,
            'purchase_date' => now(),
            'status' => 'pending',
            'total_amount' => 75000,
            'grand_total' => 75000,
            'paid_amount' => 0,
        ]);

        // Payer gives 100000 (1x100k) to pay 75000 -> change 25000
        $payload = [
            'payment_amount' => 100000,
            'applied_amount' => 75000,
            'payment_method' => 'cash',
            'given_denominations' => [
                ['denomination_id' => $d100->id, 'quantity' => 1],
            ],
            'payment_meta' => [
                'cash_given_total' => 100000,
                'cash_change_amount' => 25000,
                'cash_breakdown' => [
                    ['denomination_id' => $d100->id, 'quantity' => 1]
                ],
            ],
        ];

        $this->postJson(route('part-purchases.update-payment', $purchase->id), $payload)
            ->assertStatus(200);

        $purchase->refresh();
        $this->assertEquals(75000, $purchase->paid_amount);

        // Outgoing transaction recorded
        $out = CashTransaction::where('source', 'part-purchase-payment')->where('transaction_type', 'expense')->first();
        $this->assertNotNull($out);
        $this->assertEquals(100000, $out->amount);

        // Change transaction recorded
        $change = CashTransaction::where('source', 'part-purchase-change')->where('transaction_type', 'income')->first();
        $this->assertNotNull($change);
        $this->assertEquals(25000, $change->amount);

        // Drawer updates: 100k decreased, 25k increased
        $drawer100 = CashDrawerDenomination::where('denomination_id', $d100->id)->first();
        $drawer25 = CashDrawerDenomination::where('denomination_id', $d25->id)->first();

        $this->assertEquals(9, (int) $drawer100->quantity);
        $this->assertEquals(11, (int) $drawer25->quantity);
    }
}
