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
        Schema::table('business_profiles', function (Blueprint $table) {
            $table->text('receipt_note_transaction')->nullable()->after('website');
            $table->text('receipt_note_service_order')->nullable()->after('receipt_note_transaction');
            $table->text('receipt_note_part_sale')->nullable()->after('receipt_note_service_order');
            $table->text('receipt_note_part_purchase')->nullable()->after('receipt_note_part_sale');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('business_profiles', function (Blueprint $table) {
            $table->dropColumn([
                'receipt_note_transaction',
                'receipt_note_service_order',
                'receipt_note_part_sale',
                'receipt_note_part_purchase',
            ]);
        });
    }
};
