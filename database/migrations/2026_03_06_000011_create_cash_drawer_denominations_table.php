<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('cash_drawer_denominations', function (Blueprint $table) {
            $table->id();
            $table->foreignId('denomination_id')->constrained('cash_denominations')->cascadeOnDelete();
            $table->unsignedInteger('quantity')->default(0);
            $table->timestamps();

            $table->unique('denomination_id');
        });

        $denominationIds = DB::table('cash_denominations')->pluck('id');
        foreach ($denominationIds as $denominationId) {
            DB::table('cash_drawer_denominations')->insert([
                'denomination_id' => $denominationId,
                'quantity' => 0,
                'created_at' => now(),
                'updated_at' => now(),
            ]);
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('cash_drawer_denominations');
    }
};
