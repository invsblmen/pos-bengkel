<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::table('service_orders', function (Blueprint $table) {
            $table->index(['status', 'created_at'], 'service_orders_status_created_at_idx');
        });

        Schema::table('part_sales', function (Blueprint $table) {
            $table->index(['status', 'created_at'], 'part_sales_status_created_at_idx');
            $table->index(['created_at'], 'part_sales_created_at_idx');
        });

        Schema::table('cash_transactions', function (Blueprint $table) {
            $table->index(['happened_at', 'created_at'], 'cash_transactions_happened_created_idx');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('service_orders', function (Blueprint $table) {
            $table->dropIndex('service_orders_status_created_at_idx');
        });

        Schema::table('part_sales', function (Blueprint $table) {
            $table->dropIndex('part_sales_status_created_at_idx');
            $table->dropIndex('part_sales_created_at_idx');
        });

        Schema::table('cash_transactions', function (Blueprint $table) {
            $table->dropIndex('cash_transactions_happened_created_idx');
        });
    }
};
