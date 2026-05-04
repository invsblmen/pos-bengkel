<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('part_part_category', function (Blueprint $table) {
            $table->id();
            $table->foreignId('part_id')->constrained('parts')->cascadeOnDelete();
            $table->foreignId('part_category_id')->constrained('part_categories')->cascadeOnDelete();
            $table->timestamps();

            $table->unique(['part_id', 'part_category_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('part_part_category');
    }
};
