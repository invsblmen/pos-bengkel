<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (!Schema::hasTable('sync_batches')) {
            Schema::create('sync_batches', function (Blueprint $table) {
                $table->id();
                $table->uuid('sync_batch_id')->unique();
                $table->string('scope')->index();
                $table->string('payload_type')->index();
                $table->date('source_date')->nullable()->index();
                $table->string('source_workshop_id')->nullable()->index();
                $table->string('payload_hash')->index();
                $table->json('payload_json')->nullable();
                $table->enum('status', ['pending', 'sent', 'acknowledged', 'failed', 'retrying'])->default('pending')->index();
                $table->unsignedInteger('attempt_count')->default(0);
                $table->timestamp('last_attempt_at')->nullable();
                $table->timestamp('acknowledged_at')->nullable();
                $table->text('last_error')->nullable();
                $table->timestamps();

                $table->index(['scope', 'source_date'], 'sync_batches_scope_date_idx');
            });
        }

        if (!Schema::hasTable('sync_outbox_items')) {
            Schema::create('sync_outbox_items', function (Blueprint $table) {
                $table->id();
                $table->uuid('sync_batch_id')->index();
                $table->string('entity_type')->index();
                $table->string('entity_id')->index();
                $table->string('event_type')->index();
                $table->json('payload');
                $table->string('payload_hash')->index();
                $table->enum('status', ['pending', 'locked', 'sent', 'failed'])->default('pending')->index();
                $table->unsignedInteger('attempt_count')->default(0);
                $table->timestamp('last_attempt_at')->nullable();
                $table->text('last_error')->nullable();
                $table->timestamps();

                $table->index(['sync_batch_id', 'status'], 'sync_outbox_batch_status_idx');
                $table->index(['entity_type', 'entity_id'], 'sync_outbox_entity_idx');
            });
        }

        if (!Schema::hasTable('sync_received_batches')) {
            Schema::create('sync_received_batches', function (Blueprint $table) {
                $table->id();
                $table->uuid('sync_batch_id')->unique();
                $table->string('source_workshop_id')->index();
                $table->string('scope')->index();
                $table->string('payload_type')->index();
                $table->date('source_date')->nullable()->index();
                $table->string('payload_hash')->index();
                $table->json('payload_json');
                $table->json('summary_json')->nullable();
                $table->enum('status', ['received', 'acknowledged', 'duplicate', 'invalid', 'failed'])->default('received')->index();
                $table->text('last_error')->nullable();
                $table->timestamp('received_at')->nullable()->index();
                $table->timestamp('acknowledged_at')->nullable()->index();
                $table->timestamps();

                $table->index(['source_workshop_id', 'source_date'], 'sync_received_workshop_date_idx');
            });
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('sync_received_batches');
        Schema::dropIfExists('sync_outbox_items');
        Schema::dropIfExists('sync_batches');
    }
};