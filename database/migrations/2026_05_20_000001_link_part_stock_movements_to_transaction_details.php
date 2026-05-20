<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('part_stock_movements', function (Blueprint $table) {
            if (!Schema::hasColumn('part_stock_movements', 'part_purchase_detail_id')) {
                $table->foreignId('part_purchase_detail_id')
                    ->nullable()
                    ->after('part_id')
                    ->constrained('part_purchase_details')
                    ->nullOnDelete();
            }

            if (!Schema::hasColumn('part_stock_movements', 'part_sale_detail_id')) {
                $table->foreignId('part_sale_detail_id')
                    ->nullable()
                    ->after('part_purchase_detail_id')
                    ->constrained('part_sale_details')
                    ->nullOnDelete();
            }

            if (!Schema::hasColumn('part_stock_movements', 'service_order_detail_id')) {
                $table->foreignId('service_order_detail_id')
                    ->nullable()
                    ->after('part_sale_detail_id')
                    ->constrained('service_order_details')
                    ->nullOnDelete();
            }
        });

        Schema::table('service_order_details', function (Blueprint $table) {
            if (!Schema::hasColumn('service_order_details', 'source_purchase_detail_id')) {
                $table->foreignId('source_purchase_detail_id')
                    ->nullable()
                    ->after('part_id')
                    ->constrained('part_purchase_details')
                    ->nullOnDelete();
            }

            if (!Schema::hasColumn('service_order_details', 'cost_price')) {
                $table->bigInteger('cost_price')
                    ->default(0)
                    ->after('source_purchase_detail_id')
                    ->comment('Actual unit cost from FIFO source purchase detail');
            }

            if (!Schema::hasColumn('service_order_details', 'selling_price')) {
                $table->bigInteger('selling_price')
                    ->default(0)
                    ->after('cost_price')
                    ->comment('Unit selling price captured when service order part is added');
            }
        });
    }

    public function down(): void
    {
        Schema::table('service_order_details', function (Blueprint $table) {
            if (Schema::hasColumn('service_order_details', 'source_purchase_detail_id')) {
                $table->dropConstrainedForeignId('source_purchase_detail_id');
            }

            foreach (['cost_price', 'selling_price'] as $column) {
                if (Schema::hasColumn('service_order_details', $column)) {
                    $table->dropColumn($column);
                }
            }
        });

        Schema::table('part_stock_movements', function (Blueprint $table) {
            foreach (['service_order_detail_id', 'part_sale_detail_id', 'part_purchase_detail_id'] as $column) {
                if (Schema::hasColumn('part_stock_movements', $column)) {
                    $table->dropConstrainedForeignId($column);
                }
            }
        });
    }
};
