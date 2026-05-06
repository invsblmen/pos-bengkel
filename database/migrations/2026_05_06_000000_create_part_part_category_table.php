<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        if (!Schema::hasTable('part_part_category')) {
            Schema::create('part_part_category', function (Blueprint $table) {
                $table->unsignedBigInteger('part_id');
                $table->unsignedBigInteger('part_category_id');
                $table->timestamps();

                $table->primary(['part_id', 'part_category_id']);

                $table->foreign('part_id')->references('id')->on('parts')->onDelete('cascade');
                $table->foreign('part_category_id')->references('id')->on('part_categories')->onDelete('cascade');
            });
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('part_part_category');
    }
};
