<?php

namespace App\Http\Controllers\Apps;

use App\Events\VoucherCreated;
use App\Events\VoucherDeleted;
use App\Events\VoucherUpdated;
use App\Http\Controllers\Controller;
use App\Models\Part;
use App\Models\PartCategory;
use App\Models\Service;
use App\Models\ServiceCategory;
use App\Models\Voucher;
use App\Support\DispatchesBroadcastSafely;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;

class VoucherController extends Controller
{
    use DispatchesBroadcastSafely;

    public function index(Request $request)
    {
        $q = trim((string) $request->query('q', ''));
        $status = (string) $request->query('status', 'all');
        $scope = (string) $request->query('scope', 'all');

        $query = Voucher::query()->orderByDesc('id');

        if ($q !== '') {
            $query->where(function ($qBuilder) use ($q) {
                $qBuilder->where('code', 'like', '%' . $q . '%')
                    ->orWhere('name', 'like', '%' . $q . '%');
            });
        }

        if ($status === 'active') {
            $query->where('is_active', true);
        } elseif ($status === 'inactive') {
            $query->where('is_active', false);
        }

        if (in_array($scope, ['item_part', 'item_service', 'transaction'], true)) {
            $query->where('scope', $scope);
        }

        $vouchers = $query->paginate(15)->withQueryString();

        return Inertia::render('Dashboard/Vouchers/Index', [
            'vouchers' => $vouchers,
            'filters' => [
                'q' => $q,
                'status' => $status,
                'scope' => $scope,
            ],
        ]);
    }

    public function create()
    {
        return Inertia::render('Dashboard/Vouchers/Create', [
            'partCategories' => PartCategory::query()->orderBy('name')->get(['id', 'name']),
            'parts' => Part::query()->orderBy('name')->get(['id', 'name']),
            'serviceCategories' => ServiceCategory::query()->orderBy('name')->get(['id', 'name']),
            'services' => Service::query()->orderBy('title')->get(['id', 'title']),
        ]);
    }

    public function store(Request $request)
    {
        $validated = $this->validateVoucher($request);
        $createdVoucher = null;

        DB::transaction(function () use ($validated, &$createdVoucher) {
            $createdVoucher = Voucher::query()->create([
                'code' => strtoupper(trim((string) $validated['code'])),
                'name' => trim((string) $validated['name']),
                'description' => $validated['description'] ?? null,
                'is_active' => (bool) ($validated['is_active'] ?? true),
                'starts_at' => $validated['starts_at'] ?? null,
                'ends_at' => $validated['ends_at'] ?? null,
                'quota_total' => $validated['quota_total'] ?? null,
                'limit_per_customer' => $validated['limit_per_customer'] ?? null,
                'discount_type' => $validated['discount_type'],
                'discount_value' => $validated['discount_value'],
                'scope' => $validated['scope'],
                'min_purchase' => $validated['min_purchase'] ?? 0,
                'max_discount' => $validated['max_discount'] ?? null,
                'can_combine_with_discount' => (bool) ($validated['can_combine_with_discount'] ?? false),
            ]);

            $this->syncEligibility($createdVoucher, $validated);
        });

        if ($createdVoucher) {
            $this->dispatchBroadcastSafely(
                fn () => event(new VoucherCreated($this->toRealtimePayload($createdVoucher))),
                'VoucherCreated'
            );
        }

        return redirect()->route('vouchers.index')->with('success', 'Voucher berhasil dibuat.');
    }

    public function edit(Voucher $voucher)
    {
        $voucher->load('eligibilities');

        return Inertia::render('Dashboard/Vouchers/Edit', [
            'voucher' => [
                'id' => $voucher->id,
                'code' => $voucher->code,
                'name' => $voucher->name,
                'description' => $voucher->description,
                'is_active' => (bool) $voucher->is_active,
                'starts_at' => optional($voucher->starts_at)?->format('Y-m-d\TH:i'),
                'ends_at' => optional($voucher->ends_at)?->format('Y-m-d\TH:i'),
                'quota_total' => $voucher->quota_total,
                'quota_used' => (int) $voucher->quota_used,
                'limit_per_customer' => $voucher->limit_per_customer,
                'discount_type' => $voucher->discount_type,
                'discount_value' => (float) $voucher->discount_value,
                'scope' => $voucher->scope,
                'min_purchase' => (int) $voucher->min_purchase,
                'max_discount' => $voucher->max_discount,
                'can_combine_with_discount' => (bool) $voucher->can_combine_with_discount,
                'eligible_parts' => $voucher->eligibilities->where('eligible_type', 'part')->pluck('eligible_id')->values(),
                'eligible_part_categories' => $voucher->eligibilities->where('eligible_type', 'part_category')->pluck('eligible_id')->values(),
                'eligible_services' => $voucher->eligibilities->where('eligible_type', 'service')->pluck('eligible_id')->values(),
                'eligible_service_categories' => $voucher->eligibilities->where('eligible_type', 'service_category')->pluck('eligible_id')->values(),
            ],
            'partCategories' => PartCategory::query()->orderBy('name')->get(['id', 'name']),
            'parts' => Part::query()->orderBy('name')->get(['id', 'name']),
            'serviceCategories' => ServiceCategory::query()->orderBy('name')->get(['id', 'name']),
            'services' => Service::query()->orderBy('title')->get(['id', 'title']),
        ]);
    }

    public function update(Request $request, Voucher $voucher)
    {
        $validated = $this->validateVoucher($request, $voucher->id);
        $updatedVoucher = null;

        DB::transaction(function () use ($voucher, $validated, &$updatedVoucher) {
            $voucher->update([
                'code' => strtoupper(trim((string) $validated['code'])),
                'name' => trim((string) $validated['name']),
                'description' => $validated['description'] ?? null,
                'is_active' => (bool) ($validated['is_active'] ?? true),
                'starts_at' => $validated['starts_at'] ?? null,
                'ends_at' => $validated['ends_at'] ?? null,
                'quota_total' => $validated['quota_total'] ?? null,
                'limit_per_customer' => $validated['limit_per_customer'] ?? null,
                'discount_type' => $validated['discount_type'],
                'discount_value' => $validated['discount_value'],
                'scope' => $validated['scope'],
                'min_purchase' => $validated['min_purchase'] ?? 0,
                'max_discount' => $validated['max_discount'] ?? null,
                'can_combine_with_discount' => (bool) ($validated['can_combine_with_discount'] ?? false),
            ]);

            $this->syncEligibility($voucher, $validated);
            $updatedVoucher = $voucher->fresh();
        });

        if ($updatedVoucher) {
            $this->dispatchBroadcastSafely(
                fn () => event(new VoucherUpdated($this->toRealtimePayload($updatedVoucher))),
                'VoucherUpdated'
            );
        }

        return redirect()->route('vouchers.index')->with('success', 'Voucher berhasil diperbarui.');
    }

    public function destroy(Voucher $voucher)
    {
        $voucherId = $voucher->id;
        $voucher->delete();

        $this->dispatchBroadcastSafely(
            fn () => event(new VoucherDeleted($voucherId)),
            'VoucherDeleted'
        );

        return back()->with('success', 'Voucher berhasil dihapus.');
    }

    private function toRealtimePayload(Voucher $voucher): array
    {
        return [
            'id' => $voucher->id,
            'code' => $voucher->code,
            'name' => $voucher->name,
            'scope' => $voucher->scope,
            'is_active' => (bool) $voucher->is_active,
            'discount_type' => $voucher->discount_type,
            'discount_value' => (float) $voucher->discount_value,
            'quota_total' => $voucher->quota_total,
            'quota_used' => (int) ($voucher->quota_used ?? 0),
            'starts_at' => optional($voucher->starts_at)?->toIso8601String(),
            'ends_at' => optional($voucher->ends_at)?->toIso8601String(),
            'updated_at' => optional($voucher->updated_at)?->toIso8601String(),
        ];
    }

    private function validateVoucher(Request $request, ?int $ignoreId = null): array
    {
        $codeRule = 'required|string|max:50|unique:vouchers,code';
        if ($ignoreId) {
            $codeRule .= ',' . $ignoreId;
        }

        return $request->validate([
            'code' => $codeRule,
            'name' => 'required|string|max:255',
            'description' => 'nullable|string',
            'is_active' => 'nullable|boolean',
            'starts_at' => 'nullable|date',
            'ends_at' => 'nullable|date|after_or_equal:starts_at',
            'quota_total' => 'nullable|integer|min:1',
            'limit_per_customer' => 'nullable|integer|min:1',
            'discount_type' => 'required|in:percent,fixed',
            'discount_value' => 'required|numeric|min:0.01',
            'scope' => 'required|in:item_part,item_service,transaction',
            'min_purchase' => 'nullable|integer|min:0',
            'max_discount' => 'nullable|integer|min:0',
            'can_combine_with_discount' => 'nullable|boolean',
            'eligible_parts' => 'nullable|array',
            'eligible_parts.*' => 'integer|exists:parts,id',
            'eligible_part_categories' => 'nullable|array',
            'eligible_part_categories.*' => 'integer|exists:part_categories,id',
            'eligible_services' => 'nullable|array',
            'eligible_services.*' => 'integer|exists:services,id',
            'eligible_service_categories' => 'nullable|array',
            'eligible_service_categories.*' => 'integer|exists:service_categories,id',
        ]);
    }

    private function syncEligibility(Voucher $voucher, array $validated): void
    {
        $voucher->eligibilities()->delete();

        $payload = [];
        $now = now();

        foreach (($validated['eligible_parts'] ?? []) as $id) {
            $payload[] = [
                'voucher_id' => $voucher->id,
                'eligible_type' => 'part',
                'eligible_id' => (int) $id,
                'created_at' => $now,
                'updated_at' => $now,
            ];
        }

        foreach (($validated['eligible_part_categories'] ?? []) as $id) {
            $payload[] = [
                'voucher_id' => $voucher->id,
                'eligible_type' => 'part_category',
                'eligible_id' => (int) $id,
                'created_at' => $now,
                'updated_at' => $now,
            ];
        }

        foreach (($validated['eligible_services'] ?? []) as $id) {
            $payload[] = [
                'voucher_id' => $voucher->id,
                'eligible_type' => 'service',
                'eligible_id' => (int) $id,
                'created_at' => $now,
                'updated_at' => $now,
            ];
        }

        foreach (($validated['eligible_service_categories'] ?? []) as $id) {
            $payload[] = [
                'voucher_id' => $voucher->id,
                'eligible_type' => 'service_category',
                'eligible_id' => (int) $id,
                'created_at' => $now,
                'updated_at' => $now,
            ];
        }

        if (!empty($payload)) {
            $voucher->eligibilities()->insert($payload);
        }
    }
}
