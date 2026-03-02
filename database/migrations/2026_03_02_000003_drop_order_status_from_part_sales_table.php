<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('part_sales', function (Blueprint $table) {
            if (Schema::hasColumn('part_sales', 'order_status')) {
                $table->dropColumn('order_status');
            }
        });
    }

    public function down(): void
    {
        Schema::table('part_sales', function (Blueprint $table) {
            if (!Schema::hasColumn('part_sales', 'order_status')) {
                $table->string('order_status')->default('pending')->after('status');
            }
        });
    }
};
