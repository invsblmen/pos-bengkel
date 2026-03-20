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
            $table->index(['mechanic_id', 'status', 'created_at'], 'service_orders_mechanic_status_created_at_idx');
        });

        Schema::table('service_order_details', function (Blueprint $table) {
            $table->index(['service_order_id', 'service_id'], 'service_order_details_order_service_idx');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('service_orders', function (Blueprint $table) {
            $table->dropIndex('service_orders_mechanic_status_created_at_idx');
        });

        Schema::table('service_order_details', function (Blueprint $table) {
            $table->dropIndex('service_order_details_order_service_idx');
        });
    }
};
