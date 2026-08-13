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
        if (!Schema::hasTable('parts')) {
            Schema::create('parts', function (Blueprint $table) {
                $table->id();
                $table->string('name');
                   // NOTE: `sku` existed in earlier schema versions. Use `part_number`
                   // in current code paths; this column remains here for migration history.
                   $table->string('sku')->nullable()->unique();
                $table->foreignId('supplier_id')->nullable()->constrained()->nullOnDelete();
                $table->decimal('buy_price', 12, 2)->default(0);
                $table->decimal('sell_price', 12, 2)->default(0);
                $table->integer('stock')->default(0);
                $table->text('description')->nullable();
                $table->timestamps();
            });
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('parts');
    }
};