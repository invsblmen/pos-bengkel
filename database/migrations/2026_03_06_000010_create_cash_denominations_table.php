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
        Schema::create('cash_denominations', function (Blueprint $table) {
            $table->id();
            $table->unsignedInteger('value')->unique();
            $table->boolean('is_active')->default(true);
            $table->timestamps();
        });

        $values = [100, 200, 500, 1000, 2000, 5000, 10000, 20000, 50000, 100000];

        foreach ($values as $value) {
            DB::table('cash_denominations')->insert([
                'value' => $value,
                'is_active' => true,
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
        Schema::dropIfExists('cash_denominations');
    }
};
