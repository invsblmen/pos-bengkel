<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        $this->backfillTable('part_sales');
        $this->backfillTable('part_purchases');
    }

    public function down(): void
    {
        $this->removeBackfill('part_sales');
        $this->removeBackfill('part_purchases');
    }

    private function backfillTable(string $tableName): void
    {
        if (DB::getDriverName() !== 'sqlite') {
            DB::table($tableName)
                ->where('paid_amount', '>', 0)
                ->where(function ($query) {
                    $query->whereNull('payment_meta')
                        ->orWhereRaw("JSON_UNQUOTE(JSON_EXTRACT(payment_meta, '$.payment_received_at')) IS NULL")
                        ->orWhereRaw("JSON_UNQUOTE(JSON_EXTRACT(payment_meta, '$.payment_received_at')) = ''");
                })
                ->update([
                    'payment_meta' => DB::raw("JSON_SET(COALESCE(payment_meta, JSON_OBJECT()), '$.payment_received_at', DATE_FORMAT(COALESCE(updated_at, created_at), '%Y-%m-%dT%H:%i:%s.000Z'))"),
                ]);
        }
    }

    private function removeBackfill(string $tableName): void
    {
        DB::table($tableName)
            ->where('paid_amount', '>', 0)
            ->whereNotNull('payment_meta')
            ->whereRaw("JSON_UNQUOTE(JSON_EXTRACT(payment_meta, '$.payment_received_at')) IS NOT NULL")
            ->update([
                'payment_meta' => DB::raw("JSON_REMOVE(payment_meta, '$.payment_received_at')"),
            ]);
    }
};
