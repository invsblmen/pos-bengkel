<?php

namespace App\Services;

class CashChangeSuggestionService
{
    /**
     * @param int $changeAmount Amount of change to return.
     * @param array<int,int> $availableByValue [denominationValue => availableQty]
     */
    public function suggest(int $changeAmount, array $availableByValue): array
    {
        if ($changeAmount <= 0) {
            return [
                'exact' => true,
                'change_amount' => 0,
                'allocated_amount' => 0,
                'remaining' => 0,
                'pieces' => 0,
                'items' => [],
            ];
        }

        // Prefer larger denominations first to reduce number of notes/coins in tie cases.
        krsort($availableByValue);

        $max = $changeAmount;
        $inf = PHP_INT_MAX;

        $dp = array_fill(0, $max + 1, $inf);
        $choice = array_fill(0, $max + 1, null);
        $dp[0] = 0;

        foreach ($availableByValue as $value => $qty) {
            $value = (int) $value;
            $qty = (int) $qty;

            if ($value <= 0 || $qty <= 0) {
                continue;
            }

            for ($count = 0; $count < $qty; $count++) {
                for ($amount = $max; $amount >= $value; $amount--) {
                    if ($dp[$amount - $value] === $inf) {
                        continue;
                    }

                    $candidatePieces = $dp[$amount - $value] + 1;
                    if ($candidatePieces < $dp[$amount]) {
                        $dp[$amount] = $candidatePieces;
                        $choice[$amount] = [
                            'prev' => $amount - $value,
                            'value' => $value,
                        ];
                    }
                }
            }
        }

        $bestAmount = $changeAmount;
        $exact = $dp[$changeAmount] !== $inf;

        if (!$exact) {
            for ($amount = $changeAmount; $amount >= 0; $amount--) {
                if ($dp[$amount] !== $inf) {
                    $bestAmount = $amount;
                    break;
                }
            }
        }

        $usedByValue = [];
        $cursor = $bestAmount;
        while ($cursor > 0 && $choice[$cursor] !== null) {
            $value = (int) $choice[$cursor]['value'];
            $usedByValue[$value] = ($usedByValue[$value] ?? 0) + 1;
            $cursor = (int) $choice[$cursor]['prev'];
        }

        krsort($usedByValue);
        $items = [];
        foreach ($usedByValue as $value => $quantity) {
            $items[] = [
                'value' => (int) $value,
                'quantity' => (int) $quantity,
                'line_total' => (int) $value * (int) $quantity,
            ];
        }

        return [
            'exact' => $exact,
            'change_amount' => $changeAmount,
            'allocated_amount' => $bestAmount,
            'remaining' => $changeAmount - $bestAmount,
            'pieces' => $bestAmount === 0 ? 0 : $dp[$bestAmount],
            'items' => $items,
        ];
    }
}
