<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     *
     * Semua kolom nullable: nilai null berarti "pakai nilai config/.env"
     * (lihat App\Models\WhatsAppSetting dan override di AppServiceProvider).
     */
    public function up(): void
    {
        Schema::create('whatsapp_settings', function (Blueprint $table) {
            $table->id();
            $table->boolean('enabled')->nullable();
            $table->string('api_base_url')->nullable();
            $table->unsignedInteger('api_timeout_seconds')->nullable();
            $table->string('api_device_id')->nullable();
            $table->string('api_username')->nullable();
            $table->string('api_password')->nullable();
            $table->boolean('notify_service_order_created')->nullable();
            $table->boolean('notify_service_order_updated')->nullable();
            $table->boolean('notify_part_sale_order_ready')->nullable();
            $table->boolean('part_sale_auto_waiting_pickup')->nullable();
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('whatsapp_settings');
    }
};
