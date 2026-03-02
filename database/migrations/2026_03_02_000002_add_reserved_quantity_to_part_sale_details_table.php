<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('part_sale_details', function (Blueprint $table) {
            if (!Schema::hasColumn('part_sale_details', 'reserved_quantity')) {
                $table->integer('reserved_quantity')->default(0)->after('quantity');
            }
        });
    }

    public function down(): void
    {
        Schema::table('part_sale_details', function (Blueprint $table) {
            if (Schema::hasColumn('part_sale_details', 'reserved_quantity')) {
                $table->dropColumn('reserved_quantity');
            }
        });
    }
};
