<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('part_categories', function (Blueprint $table): void {
            $table->foreignId('parent_id')
                ->nullable()
                ->after('id')
                ->constrained('part_categories')
                ->nullOnDelete();
        });

        Schema::table('service_categories', function (Blueprint $table): void {
            $table->foreignId('parent_id')
                ->nullable()
                ->after('id')
                ->constrained('service_categories')
                ->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('part_categories', function (Blueprint $table): void {
            $table->dropConstrainedForeignId('parent_id');
        });

        Schema::table('service_categories', function (Blueprint $table): void {
            $table->dropConstrainedForeignId('parent_id');
        });
    }
};
