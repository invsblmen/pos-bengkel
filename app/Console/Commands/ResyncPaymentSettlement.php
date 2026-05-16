<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use App\Models\ServiceOrder;
use App\Models\PartSale;
use App\Models\PartPurchase;

class ResyncPaymentSettlement extends Command
{
    protected $signature = 'payments:resync {--apply : Apply changes to database instead of dry-run} {--models=* : Restrict to specific models (service_orders, part_sales, part_purchases)}';

    protected $description = 'Resynchronize payment_status and remaining_amount from paid_amount and billed totals (dry-run by default).';

    public function handle()
    {
        $apply = (bool) $this->option('apply');
        $modelsOpt = $this->option('models') ?: [];

        $targets = [
            'service_orders' => ServiceOrder::class,
            'part_sales' => PartSale::class,
            'part_purchases' => PartPurchase::class,
        ];

        if (!empty($modelsOpt)) {
            $targets = array_intersect_key($targets, array_flip($modelsOpt));
        }

        $summary = [];

        foreach ($targets as $key => $class) {
            $this->info("Processing {$key}...");
            $scanned = 0;
            $toUpdate = 0;

            $class::query()->chunkById(200, function ($rows) use (&$scanned, &$toUpdate, $apply) {
                foreach ($rows as $row) {
                    $scanned++;

                    // Settlement total derived from model helper (handles manual rounding via trait)
                    if (method_exists($row, 'getPaymentSettlementTotal')) {
                        $settlementTotal = $row->getPaymentSettlementTotal();
                    } else {
                        $settlementTotal = max(0, (int) ($row->grand_total ?? $row->total ?? 0));
                    }

                    $paid = max(0, (int) ($row->paid_amount ?? 0));
                    $newRemaining = max(0, $settlementTotal - $paid);

                    if ($settlementTotal === 0) {
                        $newStatus = 'paid';
                        $newRemaining = 0;
                    } elseif ($paid <= 0) {
                        $newStatus = 'unpaid';
                    } elseif ($paid >= $settlementTotal) {
                        $newStatus = 'paid';
                        $newRemaining = 0;
                    } else {
                        $newStatus = 'partial';
                    }

                    $needsUpdate = (
                        ((int) ($row->remaining_amount ?? 0) !== $newRemaining) ||
                        (($row->payment_status ?? '') !== $newStatus)
                    );

                    if ($needsUpdate) {
                        $toUpdate++;
                        $this->line(" - [DRY] id={$row->id} will be: payment_status={$newStatus}, remaining_amount={$newRemaining}");
                        if ($apply) {
                            DB::transaction(function () use ($row, $newStatus, $newRemaining) {
                                $row->remaining_amount = $newRemaining;
                                $row->payment_status = $newStatus;
                                $row->save();
                            });
                            $this->line("   -> applied");
                        }
                    }
                }
            });

            $summary[$key] = ['scanned' => $scanned, 'to_update' => $toUpdate];
            $this->info("{$key}: scanned={$scanned}, changes={$toUpdate}");
        }

        $this->info('Done.');
        $this->table(['model', 'scanned', 'changes'], collect($summary)->map(function ($s, $k) { return [$k, $s['scanned'], $s['to_update']]; })->values()->toArray());

        return 0;
    }
}
