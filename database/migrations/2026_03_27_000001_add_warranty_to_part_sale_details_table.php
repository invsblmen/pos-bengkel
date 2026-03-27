<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('part_sale_details', function (Blueprint $table) {
            if (!Schema::hasColumn('part_sale_details', 'warranty_period_days')) {
                $table->unsignedInteger('warranty_period_days')->default(0)->after('selling_price');
            }
            if (!Schema::hasColumn('part_sale_details', 'warranty_start_date')) {
                $table->date('warranty_start_date')->nullable()->after('warranty_period_days');
            }
            if (!Schema::hasColumn('part_sale_details', 'warranty_end_date')) {
                $table->date('warranty_end_date')->nullable()->after('warranty_start_date');
            }
            if (!Schema::hasColumn('part_sale_details', 'warranty_claimed_at')) {
                $table->timestamp('warranty_claimed_at')->nullable()->after('warranty_end_date');
            }
            if (!Schema::hasColumn('part_sale_details', 'warranty_claim_notes')) {
                $table->text('warranty_claim_notes')->nullable()->after('warranty_claimed_at');
            }
        });
    }

    public function down(): void
    {
        Schema::table('part_sale_details', function (Blueprint $table) {
            if (Schema::hasColumn('part_sale_details', 'warranty_claim_notes')) {
                $table->dropColumn('warranty_claim_notes');
            }
            if (Schema::hasColumn('part_sale_details', 'warranty_claimed_at')) {
                $table->dropColumn('warranty_claimed_at');
            }
            if (Schema::hasColumn('part_sale_details', 'warranty_end_date')) {
                $table->dropColumn('warranty_end_date');
            }
            if (Schema::hasColumn('part_sale_details', 'warranty_start_date')) {
                $table->dropColumn('warranty_start_date');
            }
            if (Schema::hasColumn('part_sale_details', 'warranty_period_days')) {
                $table->dropColumn('warranty_period_days');
            }
        });
    }
};
