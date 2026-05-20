<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        DB::table('service_orders')
            ->where('status', 'paid')
            ->update([
                'status' => 'completed',
                'payment_status' => 'paid',
                'remaining_amount' => 0,
            ]);

        if (DB::getDriverName() !== 'sqlite') {
            DB::statement("ALTER TABLE service_orders MODIFY COLUMN status ENUM('pending', 'in_progress', 'completed', 'cancelled') NOT NULL DEFAULT 'pending'");
        }
    }

    public function down(): void
    {
        if (DB::getDriverName() !== 'sqlite') {
            DB::statement("ALTER TABLE service_orders MODIFY COLUMN status ENUM('pending', 'in_progress', 'completed', 'paid', 'cancelled') NOT NULL DEFAULT 'pending'");
        }

        DB::table('service_orders')
            ->where('status', 'completed')
            ->where('payment_status', 'paid')
            ->update([
                'status' => 'paid',
            ]);
    }
};
