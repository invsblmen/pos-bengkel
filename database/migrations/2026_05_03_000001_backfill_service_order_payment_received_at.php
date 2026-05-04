<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        DB::table('service_orders')
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

    public function down(): void
    {
        DB::table('service_orders')
            ->where('paid_amount', '>', 0)
            ->whereNotNull('payment_meta')
            ->whereRaw("JSON_UNQUOTE(JSON_EXTRACT(payment_meta, '$.payment_received_at')) IS NOT NULL")
            ->update([
                'payment_meta' => DB::raw("JSON_REMOVE(payment_meta, '$.payment_received_at')"),
            ]);
    }
};
