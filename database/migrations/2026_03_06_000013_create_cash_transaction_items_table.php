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
        Schema::create('cash_transaction_items', function (Blueprint $table) {
            $table->id();
            $table->foreignId('cash_transaction_id')->constrained('cash_transactions')->cascadeOnDelete();
            $table->foreignId('denomination_id')->constrained('cash_denominations')->cascadeOnDelete();
            $table->enum('direction', ['in', 'out']);
            $table->unsignedInteger('quantity');
            $table->unsignedBigInteger('line_total');
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('cash_transaction_items');
    }
};
