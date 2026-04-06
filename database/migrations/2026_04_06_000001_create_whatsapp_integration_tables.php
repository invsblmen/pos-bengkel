<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (!Schema::hasTable('whatsapp_outbound_messages')) {
            Schema::create('whatsapp_outbound_messages', function (Blueprint $table) {
                $table->id();
                $table->string('event_type')->nullable();
                $table->string('related_type')->nullable();
                $table->unsignedBigInteger('related_id')->nullable();
                $table->foreignId('customer_id')->nullable()->constrained('customers')->nullOnDelete();
                $table->string('device_id')->nullable();
                $table->string('phone');
                $table->text('message');
                $table->enum('status', ['queued', 'sent', 'failed'])->default('queued')->index();
                $table->string('external_message_id')->nullable();
                $table->json('response_body')->nullable();
                $table->text('error_message')->nullable();
                $table->timestamp('sent_at')->nullable();
                $table->timestamp('failed_at')->nullable();
                $table->timestamps();

                $table->index(['related_type', 'related_id'], 'wa_outbound_related_idx');
                $table->index(['event_type', 'created_at'], 'wa_outbound_event_created_idx');
            });
        }

        if (!Schema::hasTable('whatsapp_webhook_events')) {
            Schema::create('whatsapp_webhook_events', function (Blueprint $table) {
                $table->id();
                $table->string('event')->index();
                $table->string('device_id')->nullable()->index();
                $table->boolean('signature_valid')->default(false)->index();
                $table->json('headers')->nullable();
                $table->json('payload')->nullable();
                $table->timestamp('received_at')->index();
                $table->timestamps();
            });
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('whatsapp_webhook_events');
        Schema::dropIfExists('whatsapp_outbound_messages');
    }
};
