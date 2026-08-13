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
        // NOTE: Historically the `parts.sku` column existed in older schemas.
        // The application now uses `parts.part_number` as the canonical identifier
        // for parts and `sku` has been removed from the runtime schema.
        // Migration is kept for history and rollback support.

        Schema::table('parts', function (Blueprint $table) {
            // Drop SKU column if exists
            if (Schema::hasColumn('parts', 'sku')) {
                $table->dropUnique(['sku']); // Drop unique constraint first
                $table->dropColumn('sku');
            }

            // Add minimal_stock column
            if (!Schema::hasColumn('parts', 'minimal_stock')) {
                $table->integer('minimal_stock')->default(0)->after('stock');
            }

            // Add rack_location column for warehouse mapping
            if (!Schema::hasColumn('parts', 'rack_location')) {
                $table->string('rack_location')->nullable()->after('minimal_stock');
            }
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('parts', function (Blueprint $table) {
            // Re-add SKU column
            if (!Schema::hasColumn('parts', 'sku')) {
                $table->string('sku')->nullable()->unique()->after('id');
            }

            // Drop minimal_stock column
            if (Schema::hasColumn('parts', 'minimal_stock')) {
                $table->dropColumn('minimal_stock');
            }

            // Drop rack_location column
            if (Schema::hasColumn('parts', 'rack_location')) {
                $table->dropColumn('rack_location');
            }
        });
    }
};
