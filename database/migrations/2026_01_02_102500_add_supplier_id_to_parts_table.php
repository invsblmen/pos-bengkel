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
        if (!Schema::hasColumn('parts', 'supplier_id')) {
            Schema::table('parts', function (Blueprint $table) {
                // Kept `after('sku')` for historical ordering; SKU has been
                // superseded by `part_number` in runtime code.
                $table->foreignId('supplier_id')->nullable()->after('sku')->constrained()->nullOnDelete();
            });
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        if (Schema::hasColumn('parts', 'supplier_id')) {
            Schema::table('parts', function (Blueprint $table) {
                $table->dropConstrainedForeignId('supplier_id');
            });
        }
    }
};