<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up()
    {
        Schema::table('parts', function (Blueprint $table) {
            if (!Schema::hasColumn('parts', 'part_category_id')) {
                // `after('sku')` kept for historical schema order; application
                // now uses `part_number` as the canonical part identifier.
                $table->unsignedBigInteger('part_category_id')->nullable()->after('sku')->index();
            }
            if (!Schema::hasColumn('parts', 'unit_measure')) {
                $table->string('unit_measure')->default('pcs')->after('description'); // pcs, liter, kg, meter
            }
            if (!Schema::hasColumn('parts', 'reorder_level')) {
                $table->integer('reorder_level')->default(5)->after('unit_measure');
            }
            if (!Schema::hasColumn('parts', 'status')) {
                $table->enum('status', ['active', 'inactive'])->default('active')->after('reorder_level');
            }
            if (!Schema::hasColumn('parts', 'deleted_at')) {
                $table->softDeletes()->after('status');
            }
        });

    }

    public function down()
    {
        Schema::table('parts', function (Blueprint $table) {
            if (Schema::hasColumn('parts', 'part_category_id')) {
                $table->dropForeign(['part_category_id']);
            }
        });

        Schema::table('parts', function (Blueprint $table) {
            $columns = ['part_category_id', 'unit_measure', 'reorder_level', 'status', 'deleted_at'];
            $existing_columns = [];

            foreach ($columns as $col) {
                if (Schema::hasColumn('parts', $col)) {
                    $existing_columns[] = $col;
                }
            }

            if (!empty($existing_columns)) {
                $table->dropColumn($existing_columns);
            }
        });
    }
};
