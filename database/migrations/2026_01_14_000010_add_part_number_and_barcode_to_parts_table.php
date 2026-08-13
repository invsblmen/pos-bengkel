<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('parts', function (Blueprint $table) {
            if (!Schema::hasColumn('parts', 'part_number')) {
                // Insert `part_number` after historical `sku` column. `sku`
                // has been deprecated in runtime; `part_number` is the
                // preferred identifier going forward.
                $table->string('part_number', 100)->nullable()->unique()->after('sku');
            }
            if (!Schema::hasColumn('parts', 'barcode')) {
                $table->string('barcode', 150)->nullable()->unique()->after('part_number');
            }
        });
    }

    public function down(): void
    {
        Schema::table('parts', function (Blueprint $table) {
            if (Schema::hasColumn('parts', 'barcode')) {
                $table->dropUnique('parts_barcode_unique');
                $table->dropColumn('barcode');
            }
            if (Schema::hasColumn('parts', 'part_number')) {
                $table->dropUnique('parts_part_number_unique');
                $table->dropColumn('part_number');
            }
        });
    }
};
