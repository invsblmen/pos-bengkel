<?php

namespace App\Services\Import;

use App\Models\Customer;
use App\Models\Mechanic;
use App\Models\Part;
use App\Models\PartPurchase;
use App\Models\PartPurchaseDetail;
use App\Models\PartSale;
use App\Models\PartSaleDetail;
use App\Models\Service;
use App\Models\ServiceOrder;
use App\Models\ServiceOrderDetail;
use App\Models\Supplier;
use App\Models\User;
use App\Models\Vehicle;
use Carbon\Carbon;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Arr;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use InvalidArgumentException;
use PhpOffice\PhpSpreadsheet\Cell\Coordinate;
use PhpOffice\PhpSpreadsheet\Style\Fill;
use PhpOffice\PhpSpreadsheet\Style\Alignment;
use PhpOffice\PhpSpreadsheet\IOFactory;
use PhpOffice\PhpSpreadsheet\Shared\Date as ExcelDate;
use PhpOffice\PhpSpreadsheet\Spreadsheet;

class WorkshopTransactionImportManager
{
    private array $warnings = [];
    public const DATASET_META = [
        'service_orders' => [
            'label' => 'Service Orders',
            'description' => 'Import transaksi service order beserta detail servis/sparepart.',
            'import_order' => 9,
            'notes' => 'Gunakan sheet ServiceOrders dan ServiceOrderDetails. Master pelanggan, kendaraan, mekanik, service, dan part akan dicari otomatis berdasarkan referensi.',
            'worksheets' => [
                'main' => [
                    'title' => 'ServiceOrders',
                    'headers' => [
                        'order_number', 'customer_name', 'customer_phone', 'vehicle_plate_number', 'vehicle_brand', 'vehicle_model',
                        'mechanic_name', 'mechanic_employee_number', 'status', 'odometer_km', 'estimated_start_at', 'estimated_finish_at',
                        'actual_start_at', 'actual_finish_at', 'labor_cost', 'material_cost', 'warranty_period', 'notes', 'maintenance_type',
                        'next_service_km', 'next_service_date', 'discount_type', 'discount_value', 'voucher_code', 'voucher_discount_amount',
                        'tax_type', 'tax_value', 'total', 'grand_total',
                    ],
                    'sample' => [[
                        'SO-20260409-0001', 'Budi Santoso', '081234567890', 'D1234AB', 'Honda', 'Beat',
                        'Andi Wijaya', 'MK-001', 'completed', '12345', '2026-04-09 08:00:00', '2026-04-09 10:00:00',
                        '2026-04-09 08:15:00', '2026-04-09 10:05:00', '50000', '150000', '30', 'Servis besar', 'routine',
                        '13345', '2026-05-09', 'none', '0', '', '0', 'none', '0', '200000', '200000',
                    ]],
                    'required_headers' => ['order_number'],
                    'recommended_headers' => ['customer_phone', 'vehicle_plate_number', 'status', 'grand_total'],
                ],
                'details' => [
                    'title' => 'ServiceOrderDetails',
                    'headers' => [
                        'order_number', 'line_type', 'service_code', 'service_title', 'part_number', 'part_name', 'qty', 'price', 'notes',
                        'amount', 'discount_type', 'discount_value', 'discount_amount', 'final_amount', 'incentive_percentage', 'incentive_amount',
                    ],
                    'sample' => [[
                        'SO-20260409-0001', 'service', 'SRV-TUNEUP', 'Tune Up Matic', '', '', '1', '50000', 'Jasa tune up',
                        '50000', 'none', '0', '0', '50000', '10', '5000',
                    ], [
                        'SO-20260409-0001', 'part', '', '', 'OLI-HONDA-001', 'Oli MPX 2 10W-30', '1', '150000', 'Oli mesin',
                        '150000', 'none', '0', '0', '150000', '0', '0',
                    ]],
                    'required_headers' => ['order_number'],
                    'recommended_headers' => ['line_type', 'qty', 'price', 'service_code', 'part_number'],
                ],
            ],
        ],
        'part_purchases' => [
            'label' => 'Part Purchases',
            'description' => 'Import transaksi pembelian sparepart beserta detail item.',
            'import_order' => 10,
            'notes' => 'Gunakan sheet PartPurchases dan PartPurchaseDetails. Supplier dan part akan dicari otomatis; jika part belum ada, sistem akan membuat placeholder part sederhana.',
            'worksheets' => [
                'main' => [
                    'title' => 'PartPurchases',
                    'headers' => [
                        'purchase_number', 'supplier_name', 'supplier_phone', 'purchase_date', 'expected_delivery_date', 'actual_delivery_date',
                        'status', 'notes', 'discount_type', 'discount_value', 'tax_type', 'tax_value', 'total_amount', 'grand_total', 'updated_by_email',
                    ],
                    'sample' => [[
                        'PUR-20260409-0001', 'CV Sumber Jaya', '022778899', '2026-04-09', '2026-04-10', '2026-04-10',
                        'received', 'Pembelian oli dan part servis', 'none', '0', 'none', '0', '500000', '500000', 'admin@example.com',
                    ]],
                    'required_headers' => ['purchase_number'],
                    'recommended_headers' => ['supplier_name', 'purchase_date', 'status', 'grand_total'],
                ],
                'details' => [
                    'title' => 'PartPurchaseDetails',
                    'headers' => [
                        'purchase_number', 'part_number', 'part_name', 'quantity', 'unit_price', 'subtotal', 'discount_type', 'discount_value',
                        'discount_amount', 'final_amount', 'margin_type', 'margin_value', 'promo_discount_type', 'promo_discount_value',
                        'margin_amount', 'normal_unit_price', 'promo_discount_amount', 'selling_price', 'created_by_email',
                    ],
                    'sample' => [[
                        'PUR-20260409-0001', 'OLI-HONDA-001', 'Oli MPX 2 10W-30', '5', '45000', '225000', 'none', '0', '0', '225000',
                        'percent', '10', 'none', '0', '22500', '247500', '0', '247500', 'admin@example.com',
                    ]],
                    'required_headers' => ['purchase_number'],
                    'recommended_headers' => ['part_number', 'quantity', 'unit_price', 'selling_price'],
                ],
            ],
        ],
        'part_sales' => [
            'label' => 'Part Sales',
            'description' => 'Import transaksi penjualan sparepart beserta detail penjualan.',
            'import_order' => 11,
            'notes' => 'Gunakan sheet PartSales dan PartSaleDetails. Customer dan part akan dicari otomatis.',
            'worksheets' => [
                'main' => [
                    'title' => 'PartSales',
                    'headers' => [
                        'invoice', 'customer_name', 'customer_phone', 'sale_date', 'notes', 'discount_type', 'discount_value', 'voucher_code',
                        'voucher_discount_amount', 'tax_type', 'tax_value', 'subtotal', 'grand_total', 'paid_amount', 'remaining_amount',
                        'payment_status', 'status', 'created_by_email',
                    ],
                    'sample' => [[
                        'SAL-20260409-0001', 'Budi Santoso', '081234567890', '2026-04-09', 'Penjualan sparepart', 'none', '0', '', '0', 'none', '0',
                        '150000', '150000', '150000', '0', 'paid', 'completed', 'admin@example.com',
                    ]],
                    'required_headers' => ['invoice'],
                    'recommended_headers' => ['customer_phone', 'sale_date', 'status', 'payment_status', 'grand_total'],
                ],
                'details' => [
                    'title' => 'PartSaleDetails',
                    'headers' => [
                        'invoice', 'part_number', 'part_name', 'quantity', 'reserved_quantity', 'unit_price', 'subtotal', 'discount_type', 'discount_value',
                        'discount_amount', 'final_amount', 'source_purchase_detail_ref', 'cost_price', 'selling_price', 'warranty_period_days',
                        'warranty_start_date', 'warranty_end_date', 'warranty_claim_notes',
                    ],
                    'sample' => [[
                        'SAL-20260409-0001', 'OLI-HONDA-001', 'Oli MPX 2 10W-30', '1', '0', '150000', '150000', 'none', '0', '0', '150000', '', '100000', '150000', '30', '2026-04-09', '2026-05-09', '',
                    ]],
                    'required_headers' => ['invoice'],
                    'recommended_headers' => ['part_number', 'quantity', 'unit_price', 'selling_price'],
                ],
            ],
        ],
    ];

    public function datasetOptions(): array
    {
        return collect(self::DATASET_META)
            ->map(function (array $meta, string $type) {
                return [
                    'type' => $type,
                    'label' => $meta['label'],
                    'description' => $meta['description'],
                    'headers' => array_merge($meta['worksheets']['main']['headers'], $meta['worksheets']['details']['headers']),
                    'required_headers' => collect(array_merge(
                        $meta['worksheets']['main']['required_headers'] ?? [],
                        $meta['worksheets']['details']['required_headers'] ?? []
                    ))->unique()->values()->all(),
                    'recommended_headers' => collect(array_merge(
                        $meta['worksheets']['main']['recommended_headers'] ?? [],
                        $meta['worksheets']['details']['recommended_headers'] ?? []
                    ))->unique()->values()->all(),
                    'import_order' => (int) ($meta['import_order'] ?? 999),
                    'notes' => $meta['notes'] ?? null,
                ];
            })
            ->sortBy('import_order')
            ->values()
            ->all();
    }

    public function buildTemplate(string $type): Spreadsheet
    {
        $this->assertDataset($type);
        $meta = self::DATASET_META[$type];

        $spreadsheet = new Spreadsheet();
        $instructions = $spreadsheet->getActiveSheet();
        $instructions->setTitle('Instructions');
        $instructions->setCellValue('A1', 'Template Import ' . $meta['label']);
        $instructions->setCellValue('A3', 'Header bertanda * (merah) wajib diisi pada sheet utama dan detail.');
        $instructions->setCellValue('A4', 'Header biru adalah kolom rekomendasi agar data transaksi lebih lengkap.');
        $instructions->setCellValue('A5', 'Sheet detail berisi baris item yang dihubungkan via nomor transaksi.');
        $instructions->setCellValue('A6', 'Referensi master di-resolve otomatis dari nama/kode/nomor.');
        $instructions->setCellValue('A7', 'Disarankan jalankan Dry Run terlebih dahulu.');
        if (! empty($meta['notes'])) {
            $instructions->setCellValue('A8', 'Catatan: ' . $meta['notes']);
            $instructions->getStyle('A8')->getAlignment()->setWrapText(true)->setVertical(Alignment::VERTICAL_TOP);
        }
        $instructions->getStyle('A1')->getFont()->setBold(true)->setSize(14);
        $instructions->getColumnDimension('A')->setAutoSize(true);

        $this->populateSheet(
            $spreadsheet->createSheet(),
            $meta['worksheets']['main']['title'],
            $meta['worksheets']['main']['headers'],
            $meta['worksheets']['main']['sample'],
            $meta['worksheets']['main']['required_headers'] ?? [],
            $meta['worksheets']['main']['recommended_headers'] ?? []
        );

        $this->populateSheet(
            $spreadsheet->createSheet(),
            $meta['worksheets']['details']['title'],
            $meta['worksheets']['details']['headers'],
            $meta['worksheets']['details']['sample'],
            $meta['worksheets']['details']['required_headers'] ?? [],
            $meta['worksheets']['details']['recommended_headers'] ?? []
        );

        $spreadsheet->setActiveSheetIndex(1);

        return $spreadsheet;
    }

    public function import(string $type, UploadedFile $file, bool $dryRun = false): array
    {
        $this->assertDataset($type);
        $this->warnings = [];

        if (! in_array(strtolower($file->getClientOriginalExtension()), ['xlsx', 'xls'], true)) {
            throw new InvalidArgumentException('Import transaksi hanya mendukung file Excel .xlsx atau .xls karena membutuhkan lebih dari satu sheet.');
        }

        $meta = self::DATASET_META[$type];
        $spreadsheet = IOFactory::load($file->getRealPath());

        $mainRows = $this->readSheetRows($spreadsheet, $meta['worksheets']['main']['title']);
        $detailRows = $this->readSheetRows($spreadsheet, $meta['worksheets']['details']['title']);

        $result = match ($type) {
            'service_orders' => $this->importServiceOrders($mainRows, $detailRows, $dryRun),
            'part_purchases' => $this->importPartPurchases($mainRows, $detailRows, $dryRun),
            'part_sales' => $this->importPartSales($mainRows, $detailRows, $dryRun),
            default => throw new InvalidArgumentException('Tipe transaksi tidak didukung.'),
        };

        $result['warnings'] = $this->warnings;

        return $result;
    }

    private function importServiceOrders(array $mainRows, array $detailRows, bool $dryRun): array
    {
        $mainIndex = $this->indexRowsByKey($mainRows, 'order_number');
        $detailGroups = $this->groupRowsByKey($detailRows, 'order_number');

        return $this->runTransactionImport(
            dataset: 'Service Orders',
            processedRows: max(0, count($mainRows) - 1),
            detailProcessedRows: max(0, count($detailRows) - 1),
            dryRun: $dryRun,
            rows: $mainIndex,
            detailGroups: $detailGroups,
            mainRequiredHeaders: self::DATASET_META['service_orders']['worksheets']['main']['required_headers'] ?? [],
            detailRequiredHeaders: self::DATASET_META['service_orders']['worksheets']['details']['required_headers'] ?? [],
            detailSheetName: self::DATASET_META['service_orders']['worksheets']['details']['title'] ?? 'Detail',
            handler: function (array $row, array $detailRows, bool $dryRun) {
                $orderNumber = $this->stringOrNull($row, 'order_number');
                if (! $orderNumber) {
                    throw new InvalidArgumentException('Kolom order_number wajib diisi.');
                }

                $customer = $this->resolveCustomer(
                    $this->stringOrNull($row, 'customer_phone'),
                    $this->stringOrNull($row, 'customer_name'),
                    (int) ($row['__line'] ?? null)
                );
                $vehicle = $this->resolveVehicle(
                    $customer,
                    $this->stringOrNull($row, 'vehicle_plate_number'),
                    $this->stringOrNull($row, 'vehicle_brand'),
                    $this->stringOrNull($row, 'vehicle_model'),
                    (int) ($row['__line'] ?? null)
                );
                $mechanic = $this->resolveMechanic(
                    $this->stringOrNull($row, 'mechanic_employee_number'),
                    $this->stringOrNull($row, 'mechanic_name'),
                    (int) ($row['__line'] ?? null)
                );

                $payload = [
                    'order_number' => $orderNumber,
                    'customer_id' => $customer?->id,
                    'vehicle_id' => $vehicle?->id,
                    'mechanic_id' => $mechanic?->id,
                    'status' => $this->enumOrDefault($row, 'status', ['pending', 'in_progress', 'completed', 'cancelled'], 'pending'),
                    'odometer_km' => $this->intOrNull($row, 'odometer_km'),
                    'estimated_start_at' => $this->dateTimeOrNull($row, 'estimated_start_at'),
                    'estimated_finish_at' => $this->dateTimeOrNull($row, 'estimated_finish_at'),
                    'actual_start_at' => $this->dateTimeOrNull($row, 'actual_start_at'),
                    'actual_finish_at' => $this->dateTimeOrNull($row, 'actual_finish_at'),
                    'labor_cost' => $this->intOrDefault($row, 'labor_cost', 0),
                    'material_cost' => $this->intOrDefault($row, 'material_cost', 0),
                    'warranty_period' => $this->intOrNull($row, 'warranty_period'),
                    'notes' => $this->stringOrNull($row, 'notes'),
                    'maintenance_type' => $this->stringOrNull($row, 'maintenance_type'),
                    'next_service_km' => $this->intOrNull($row, 'next_service_km'),
                    'next_service_date' => $this->dateOrNull($row, 'next_service_date'),
                    'discount_type' => $this->enumOrDefault($row, 'discount_type', ['none', 'percent', 'fixed'], 'none'),
                    'discount_value' => $this->floatOrDefault($row, 'discount_value', 0),
                    'voucher_code' => $this->stringOrNull($row, 'voucher_code'),
                    'voucher_discount_amount' => $this->intOrDefault($row, 'voucher_discount_amount', 0),
                    'tax_type' => $this->enumOrDefault($row, 'tax_type', ['none', 'percent', 'fixed'], 'none'),
                    'tax_value' => $this->floatOrDefault($row, 'tax_value', 0),
                    'total' => $this->intOrDefault($row, 'total', 0),
                    'grand_total' => $this->intOrDefault($row, 'grand_total', 0),
                ];

                return $this->upsertServiceOrder($payload, $detailRows, $dryRun);
            }
        );
    }

    private function importPartPurchases(array $mainRows, array $detailRows, bool $dryRun): array
    {
        $mainIndex = $this->indexRowsByKey($mainRows, 'purchase_number');
        $detailGroups = $this->groupRowsByKey($detailRows, 'purchase_number');

        return $this->runTransactionImport(
            dataset: 'Part Purchases',
            processedRows: max(0, count($mainRows) - 1),
            detailProcessedRows: max(0, count($detailRows) - 1),
            dryRun: $dryRun,
            rows: $mainIndex,
            detailGroups: $detailGroups,
            mainRequiredHeaders: self::DATASET_META['part_purchases']['worksheets']['main']['required_headers'] ?? [],
            detailRequiredHeaders: self::DATASET_META['part_purchases']['worksheets']['details']['required_headers'] ?? [],
            detailSheetName: self::DATASET_META['part_purchases']['worksheets']['details']['title'] ?? 'Detail',
            handler: function (array $row, array $detailRows, bool $dryRun) {
                $purchaseNumber = $this->stringOrNull($row, 'purchase_number');
                if (! $purchaseNumber) {
                    throw new InvalidArgumentException('Kolom purchase_number wajib diisi.');
                }

                $supplier = $this->resolveSupplier(
                    $this->stringOrNull($row, 'supplier_phone'),
                    $this->stringOrNull($row, 'supplier_name'),
                    (int) ($row['__line'] ?? null)
                );

                $updatedBy = $this->resolveUser($this->stringOrNull($row, 'updated_by_email'));

                $payload = [
                    'purchase_number' => $purchaseNumber,
                    'supplier_id' => $supplier?->id,
                    'purchase_date' => $this->dateOrNull($row, 'purchase_date') ?? now()->toDateString(),
                    'expected_delivery_date' => $this->dateOrNull($row, 'expected_delivery_date'),
                    'actual_delivery_date' => $this->dateOrNull($row, 'actual_delivery_date'),
                    'status' => $this->enumOrDefault($row, 'status', ['pending', 'ordered', 'received', 'cancelled'], 'pending'),
                    'total_amount' => $this->intOrDefault($row, 'total_amount', 0),
                    'notes' => $this->stringOrNull($row, 'notes'),
                    'discount_type' => $this->enumOrDefault($row, 'discount_type', ['none', 'percent', 'fixed'], 'none'),
                    'discount_value' => $this->floatOrDefault($row, 'discount_value', 0),
                    'tax_type' => $this->enumOrDefault($row, 'tax_type', ['none', 'percent', 'fixed'], 'none'),
                    'tax_value' => $this->floatOrDefault($row, 'tax_value', 0),
                    'grand_total' => $this->intOrDefault($row, 'grand_total', 0),
                    'updated_by' => $updatedBy?->id,
                ];

                return $this->upsertPartPurchase($payload, $detailRows, $dryRun);
            }
        );
    }

    private function importPartSales(array $mainRows, array $detailRows, bool $dryRun): array
    {
        $mainIndex = $this->indexRowsByKey($mainRows, 'invoice');
        $detailGroups = $this->groupRowsByKey($detailRows, 'invoice');

        return $this->runTransactionImport(
            dataset: 'Part Sales',
            processedRows: max(0, count($mainRows) - 1),
            detailProcessedRows: max(0, count($detailRows) - 1),
            dryRun: $dryRun,
            rows: $mainIndex,
            detailGroups: $detailGroups,
            mainRequiredHeaders: self::DATASET_META['part_sales']['worksheets']['main']['required_headers'] ?? [],
            detailRequiredHeaders: self::DATASET_META['part_sales']['worksheets']['details']['required_headers'] ?? [],
            detailSheetName: self::DATASET_META['part_sales']['worksheets']['details']['title'] ?? 'Detail',
            handler: function (array $row, array $detailRows, bool $dryRun) {
                $invoice = $this->stringOrNull($row, 'invoice');
                if (! $invoice) {
                    throw new InvalidArgumentException('Kolom invoice wajib diisi.');
                }

                $customer = $this->resolveCustomer(
                    $this->stringOrNull($row, 'customer_phone'),
                    $this->stringOrNull($row, 'customer_name'),
                    (int) ($row['__line'] ?? null)
                );
                $createdBy = $this->resolveUser($this->stringOrNull($row, 'created_by_email'));

                $payload = [
                    'sale_number' => $invoice,
                    'customer_id' => $customer?->id,
                    'sale_date' => $this->dateOrNull($row, 'sale_date') ?? now()->toDateString(),
                    'subtotal' => $this->intOrDefault($row, 'subtotal', 0),
                    'discount_type' => $this->enumOrDefault($row, 'discount_type', ['none', 'percent', 'fixed'], 'none'),
                    'discount_value' => $this->floatOrDefault($row, 'discount_value', 0),
                    'voucher_code' => $this->stringOrNull($row, 'voucher_code'),
                    'voucher_discount_amount' => $this->intOrDefault($row, 'voucher_discount_amount', 0),
                    'tax_type' => $this->enumOrDefault($row, 'tax_type', ['none', 'percent', 'fixed'], 'none'),
                    'tax_value' => $this->floatOrDefault($row, 'tax_value', 0),
                    'grand_total' => $this->intOrDefault($row, 'grand_total', 0),
                    'paid_amount' => $this->intOrDefault($row, 'paid_amount', 0),
                    'remaining_amount' => $this->intOrDefault($row, 'remaining_amount', 0),
                    'payment_status' => $this->enumOrDefault($row, 'payment_status', ['paid', 'partial', 'unpaid'], 'unpaid'),
                    'status' => $this->enumOrDefault($row, 'status', ['pending', 'completed', 'cancelled'], 'pending'),
                    'notes' => $this->stringOrNull($row, 'notes'),
                    'created_by' => $createdBy?->id,
                ];

                return $this->upsertPartSale($payload, $detailRows, $dryRun);
            }
        );
    }

    private function upsertServiceOrder(array $payload, array $detailRows, bool $dryRun): array
    {
        $orderNumber = $payload['order_number'];
        $model = ServiceOrder::query()->where('order_number', $orderNumber)->first();
        $action = $model ? 'updated' : 'created';

        if ($dryRun) {
            return [$action, count($detailRows)];
        }

        return DB::transaction(function () use ($payload, $detailRows, $model, $action) {
            $order = $model ?? new ServiceOrder();
            $order->fill($payload)->save();
            $order->details()->delete();

            foreach ($detailRows as $detailRow) {
                $detailPayload = $this->buildServiceOrderDetailPayload($detailRow, $order->id);
                ServiceOrderDetail::create($detailPayload);
            }

            $order->load('details');
            $order->recalculateTotals();
            if (($payload['total'] ?? 0) > 0) {
                $order->total = $payload['total'];
            }
            if (($payload['grand_total'] ?? 0) > 0) {
                $order->grand_total = $payload['grand_total'];
            }
            $order->save();

            return [$action, count($detailRows)];
        });
    }

    private function upsertPartPurchase(array $payload, array $detailRows, bool $dryRun): array
    {
        $purchaseNumber = $payload['purchase_number'];
        $model = PartPurchase::query()->where('purchase_number', $purchaseNumber)->first();
        $action = $model ? 'updated' : 'created';

        if ($dryRun) {
            return [$action, count($detailRows)];
        }

        return DB::transaction(function () use ($payload, $detailRows, $model, $action) {
            $purchase = $model ?? new PartPurchase();
            $purchase->fill($payload)->save();
            $purchase->details()->delete();

            foreach ($detailRows as $detailRow) {
                $detailPayload = $this->buildPartPurchaseDetailPayload($detailRow, $purchase->id);
                PartPurchaseDetail::create($detailPayload);
            }

            $purchase->load('details');
            $purchase->recalculateTotals();
            if (($payload['grand_total'] ?? 0) > 0) {
                $purchase->grand_total = $payload['grand_total'];
            }
            $purchase->save();

            return [$action, count($detailRows)];
        });
    }

    private function upsertPartSale(array $payload, array $detailRows, bool $dryRun): array
    {
        $invoice = $payload['sale_number'];
        $model = PartSale::query()->where('sale_number', $invoice)->first();
        $action = $model ? 'updated' : 'created';

        if ($dryRun) {
            return [$action, count($detailRows)];
        }

        return DB::transaction(function () use ($payload, $detailRows, $model, $action) {
            $sale = $model ?? new PartSale();
            $sale->fill($payload)->save();
            $sale->details()->delete();

            foreach ($detailRows as $detailRow) {
                $detailPayload = $this->buildPartSaleDetailPayload($detailRow, $sale->id);
                PartSaleDetail::create($detailPayload);
            }

            $sale->load('details');
            $sale->recalculateTotals();
            if (($payload['grand_total'] ?? 0) > 0) {
                $sale->grand_total = $payload['grand_total'];
            }
            if (($payload['paid_amount'] ?? 0) > 0) {
                $sale->paid_amount = $payload['paid_amount'];
            }
            if (($payload['remaining_amount'] ?? 0) > 0) {
                $sale->remaining_amount = $payload['remaining_amount'];
            }
            $sale->payment_status = $payload['payment_status'];
            $sale->save();

            return [$action, count($detailRows)];
        });
    }

    private function buildServiceOrderDetailPayload(array $row, int $serviceOrderId): array
    {
        $lineType = Str::lower((string) $this->stringOrDefault($row, 'line_type', 'service'));
        $service = null;
        $part = null;

        if ($lineType === 'service') {
            $service = $this->resolveService(
                $this->stringOrNull($row, 'service_code'),
                $this->stringOrNull($row, 'service_title'),
                (int) ($row['__line'] ?? null)
            );
        } else {
            $part = $this->resolvePart(
                $this->stringOrNull($row, 'part_number'),
                $this->stringOrNull($row, 'part_name'),
                (int) ($row['__line'] ?? null)
            );
        }

        $qty = max(1, $this->intOrDefault($row, 'qty', 1));
        $price = $this->intOrDefault($row, 'price', 0);
        $amount = $this->intOrDefault($row, 'amount', $qty * $price);
        $discountType = $this->enumOrDefault($row, 'discount_type', ['none', 'percent', 'fixed'], 'none');
        $discountValue = $this->floatOrDefault($row, 'discount_value', 0);
        $discountAmount = $this->intOrDefault($row, 'discount_amount', $this->calculateDiscountAmount($amount, $discountType, $discountValue));
        $finalAmount = $this->intOrDefault($row, 'final_amount', max(0, $amount - $discountAmount));

        return [
            'service_order_id' => $serviceOrderId,
            'service_id' => $service?->id,
            'part_id' => $part?->id,
            'qty' => $qty,
            'price' => $price,
            'notes' => $this->stringOrNull($row, 'notes'),
            'amount' => $amount,
            'base_amount' => $amount,
            'auto_discount_amount' => 0,
            'auto_discount_notes' => null,
            'discount_type' => $discountType,
            'discount_value' => $discountValue,
            'discount_amount' => $discountAmount,
            'final_amount' => $finalAmount,
            'incentive_percentage' => $this->floatOrDefault($row, 'incentive_percentage', 0),
            'incentive_amount' => $this->intOrDefault($row, 'incentive_amount', 0),
        ];
    }

    private function buildPartPurchaseDetailPayload(array $row, int $purchaseId): array
    {
        $part = $this->resolvePart(
            $this->stringOrNull($row, 'part_number'),
            $this->stringOrNull($row, 'part_name'),
            (int) ($row['__line'] ?? null)
        );

        $quantity = max(1, $this->intOrDefault($row, 'quantity', 1));
        $unitPrice = $this->intOrDefault($row, 'unit_price', 0);
        $subtotal = $this->intOrDefault($row, 'subtotal', $quantity * $unitPrice);
        $discountType = $this->enumOrDefault($row, 'discount_type', ['none', 'percent', 'fixed'], 'none');
        $discountValue = $this->floatOrDefault($row, 'discount_value', 0);
        $discountAmount = $this->intOrDefault($row, 'discount_amount', $this->calculateDiscountAmount($subtotal, $discountType, $discountValue));
        $finalAmount = $this->intOrDefault($row, 'final_amount', max(0, $subtotal - $discountAmount));

        return [
            'part_purchase_id' => $purchaseId,
            'part_id' => $part->id,
            'quantity' => $quantity,
            'unit_price' => $unitPrice,
            'subtotal' => $subtotal,
            'discount_type' => $discountType,
            'discount_value' => $discountValue,
            'discount_amount' => $discountAmount,
            'final_amount' => $finalAmount,
            'margin_type' => $this->enumOrDefault($row, 'margin_type', ['percent', 'fixed'], 'percent'),
            'margin_value' => $this->floatOrDefault($row, 'margin_value', 0),
            'promo_discount_type' => $this->enumOrDefault($row, 'promo_discount_type', ['none', 'percent', 'fixed'], 'none'),
            'promo_discount_value' => $this->floatOrDefault($row, 'promo_discount_value', 0),
            'margin_amount' => $this->intOrDefault($row, 'margin_amount', 0),
            'normal_unit_price' => $this->intOrDefault($row, 'normal_unit_price', 0),
            'promo_discount_amount' => $this->intOrDefault($row, 'promo_discount_amount', 0),
            'selling_price' => $this->intOrDefault($row, 'selling_price', 0),
            'created_by' => $this->resolveUser($this->stringOrNull($row, 'created_by_email'))?->id,
        ];
    }

    private function buildPartSaleDetailPayload(array $row, int $saleId): array
    {
        $part = $this->resolvePart(
            $this->stringOrNull($row, 'part_number'),
            $this->stringOrNull($row, 'part_name')
        );

        $quantity = max(1, $this->intOrDefault($row, 'quantity', 1));
        $unitPrice = $this->intOrDefault($row, 'unit_price', 0);
        $subtotal = $this->intOrDefault($row, 'subtotal', $quantity * $unitPrice);
        $discountType = $this->enumOrDefault($row, 'discount_type', ['none', 'percent', 'fixed'], 'none');
        $discountValue = $this->floatOrDefault($row, 'discount_value', 0);
        $discountAmount = $this->intOrDefault($row, 'discount_amount', $this->calculateDiscountAmount($subtotal, $discountType, $discountValue));
        $finalAmount = $this->intOrDefault($row, 'final_amount', max(0, $subtotal - $discountAmount));

        return [
            'part_sale_id' => $saleId,
            'part_id' => $part->id,
            'quantity' => $quantity,
            'reserved_quantity' => $this->intOrDefault($row, 'reserved_quantity', 0),
            'unit_price' => $unitPrice,
            'subtotal' => $subtotal,
            'discount_type' => $discountType,
            'discount_value' => $discountValue,
            'discount_amount' => $discountAmount,
            'final_amount' => $finalAmount,
            'source_purchase_detail_id' => $this->intOrNullIfNumeric($row, 'source_purchase_detail_ref'),
            'cost_price' => $this->intOrDefault($row, 'cost_price', 0),
            'selling_price' => $this->intOrDefault($row, 'selling_price', 0),
            'warranty_period_days' => $this->intOrNull($row, 'warranty_period_days'),
            'warranty_start_date' => $this->dateOrNull($row, 'warranty_start_date'),
            'warranty_end_date' => $this->dateOrNull($row, 'warranty_end_date'),
            'warranty_claim_notes' => $this->stringOrNull($row, 'warranty_claim_notes'),
        ];
    }

    private function runTransactionImport(
        string $dataset,
        int $processedRows,
        int $detailProcessedRows,
        bool $dryRun,
        array $rows,
        array $detailGroups,
        array $mainRequiredHeaders,
        array $detailRequiredHeaders,
        string $detailSheetName,
        callable $handler
    ): array
    {
        $created = 0;
        $updated = 0;
        $failed = 0;
        $detailFailed = 0;
        $skipped = 0;
        $detailSkipped = 0;
        $failures = [];
        $detailFailures = [];

        foreach ($rows as $row) {
            if ($this->isRowEmpty($row)) {
                $skipped++;
                continue;
            }

            $key = $this->transactionKey($row);
            $detailRows = $detailGroups[$key] ?? [];
            $validDetailRows = [];

            try {
                $this->assertRequiredColumns($row, $mainRequiredHeaders, $dataset);

                foreach ($detailRows as $detailRow) {
                    if ($this->isRowEmpty($detailRow)) {
                        $detailSkipped++;
                        continue;
                    }

                    try {
                        $this->assertRequiredColumns($detailRow, $detailRequiredHeaders, $detailSheetName);
                        $validDetailRows[] = $detailRow;
                    } catch (\Throwable $e) {
                        $detailFailed++;
                        $detailFailures[] = [
                            'sheet' => $detailSheetName,
                            'line' => (int) ($detailRow['__line'] ?? 0),
                            'message' => $e->getMessage(),
                        ];
                    }
                }

                [$action, $detailCount] = $handler($row, $validDetailRows, $dryRun);
                if ($action === 'created') {
                    $created++;
                } else {
                    $updated++;
                }

                $detailSkipped += max(0, count($validDetailRows) - $detailCount);
            } catch (\Throwable $e) {
                $failed++;
                $failures[] = [
                    'line' => (int) ($row['__line'] ?? 0),
                    'message' => $e->getMessage(),
                ];
            }
        }

        foreach ($detailGroups as $key => $groupRows) {
            foreach ($groupRows as $detailRow) {
                if ($this->isRowEmpty($detailRow)) {
                    $detailSkipped++;
                }
            }
        }

        return [
            'dataset' => $dataset,
            'dataset_type' => Str::snake(str_replace(' ', '_', $dataset)),
            'processed_rows' => $processedRows,
            'successful_rows' => $created + $updated,
            'created_rows' => $created,
            'updated_rows' => $updated,
            'failed_rows' => $failed,
            'skipped_rows' => $skipped,
            'detail_rows_processed' => $detailProcessedRows,
            'detail_rows_failed' => $detailFailed,
            'detail_rows_skipped' => $detailSkipped,
            'dry_run' => $dryRun,
            'would_create_rows' => $dryRun ? $created : 0,
            'would_update_rows' => $dryRun ? $updated : 0,
            'failures' => $failures,
            'detail_failures' => $detailFailures,
        ];
    }

    private function assertRequiredColumns(array $row, array $requiredHeaders, string $sheetName): void
    {
        if (empty($requiredHeaders)) {
            return;
        }

        $missing = collect($requiredHeaders)
            ->filter(function (string $header) use ($row) {
                $value = Arr::get($row, $header);
                return $value === null || $value === '';
            })
            ->values()
            ->all();

        if (! empty($missing)) {
            throw new InvalidArgumentException('Kolom wajib pada ' . $sheetName . ' belum diisi: ' . implode(', ', $missing) . '.');
        }
    }

    private function populateSheet($sheet, string $title, array $headers, array $sampleRows, array $requiredHeaders = [], array $recommendedHeaders = []): void
    {
        $sheet->setTitle($title);

        foreach ($headers as $index => $header) {
            $column = Coordinate::stringFromColumnIndex($index + 1);
            $isRequired = in_array($header, $requiredHeaders, true);
            $isRecommended = in_array($header, $recommendedHeaders, true);
            $sheet->setCellValue($column . '1', $this->renderTemplateHeader($header, $isRequired));
            $this->styleTemplateHeader($sheet, $column . '1', $isRequired, $isRecommended);
        }

        foreach ($sampleRows as $rowIndex => $sampleRow) {
            foreach ($sampleRow as $cellIndex => $cellValue) {
                $column = Coordinate::stringFromColumnIndex($cellIndex + 1);
                $sheet->setCellValue($column . ($rowIndex + 2), $cellValue);
            }
        }

        $sheet->freezePane('A2');
        $maxColumn = $sheet->getHighestColumn();
        $maxColumnIndex = Coordinate::columnIndexFromString($maxColumn);
        for ($columnIndex = 1; $columnIndex <= $maxColumnIndex; $columnIndex++) {
            $sheet->getColumnDimension(Coordinate::stringFromColumnIndex($columnIndex))->setAutoSize(true);
        }
    }

    private function renderTemplateHeader(string $header, bool $required): string
    {
        return $required ? $header . ' *' : $header;
    }

    private function styleTemplateHeader($sheet, string $cellCoordinate, bool $required, bool $recommended = false): void
    {
        $style = $sheet->getStyle($cellCoordinate);
        $style->getFont()->setBold(true);

        if ($required) {
            $style->getFont()->getColor()->setARGB('FFB91C1C');
            $style->getFill()->setFillType(Fill::FILL_SOLID);
            $style->getFill()->getStartColor()->setARGB('FFFEE2E2');
            return;
        }

        if ($recommended) {
            $style->getFont()->getColor()->setARGB('FF1D4ED8');
            $style->getFill()->setFillType(Fill::FILL_SOLID);
            $style->getFill()->getStartColor()->setARGB('FFDBEAFE');
        }
    }

    private function readSheetRows(Spreadsheet $spreadsheet, string $sheetTitle): array
    {
        $sheet = $spreadsheet->getSheetByName($sheetTitle);
        if (! $sheet) {
            throw new InvalidArgumentException('Sheet ' . $sheetTitle . ' tidak ditemukan.');
        }

        return $sheet->toArray(null, true, true, false);
    }

    private function indexRowsByKey(array $rows, string $key): array
    {
        $header = array_map(fn ($value) => $this->normalizeHeader($value), $rows[0] ?? []);
        $indexed = [];

        foreach (array_slice($rows, 1) as $offset => $cells) {
            $row = $this->mapRow($header, $cells);
            $row['__line'] = $offset + 2;
            $value = $this->stringOrNull($row, $key);
            if ($value) {
                $indexed[$value] = $row;
            }
        }

        return $indexed;
    }

    private function groupRowsByKey(array $rows, string $key): array
    {
        $header = array_map(fn ($value) => $this->normalizeHeader($value), $rows[0] ?? []);
        $groups = [];

        foreach (array_slice($rows, 1) as $offset => $cells) {
            $row = $this->mapRow($header, $cells);
            $row['__line'] = $offset + 2;
            $value = $this->stringOrNull($row, $key);
            if ($value) {
                $groups[$value][] = $row;
            }
        }

        return $groups;
    }

    private function transactionKey(array $row): string
    {
        return (string) ($row['order_number'] ?? $row['purchase_number'] ?? $row['invoice'] ?? '');
    }

    private function resolveCustomer(?string $phone, ?string $name, ?int $line = null): ?Customer
    {
        $customer = null;

        if ($phone) {
            $customer = Customer::query()->where('phone', $phone)->first();
        }

        if (! $customer && $name) {
            $customer = Customer::query()->where('name', $name)->first();
        }

        if (! $customer && ($phone || $name)) {
            $customer = Customer::firstOrCreate([
                'phone' => $phone ?? $this->slugFallback($name ?? 'customer'),
            ], [
                'name' => $name ?? 'Customer Import',
                'address' => null,
            ]);

            if ($customer->wasRecentlyCreated) {
                $this->warnings[] = [
                    'line' => $line,
                    'message' => 'Pelanggan "' . ($name ?? $phone) . '" dibuat otomatis karena referensi tidak ditemukan.',
                ];
            }
        }

        return $customer;
    }

    private function resolveVehicle(?Customer $customer, ?string $plateNumber, ?string $brand, ?string $model, ?int $line = null): ?Vehicle
    {
        if (! $plateNumber) {
            return null;
        }

        $vehicle = Vehicle::query()->where('plate_number', $plateNumber)->first();
        if ($vehicle) {
            return $vehicle;
        }

        if (! $customer) {
            $customer = Customer::firstOrCreate([
                'phone' => 'import-' . Str::slug($plateNumber),
            ], [
                'name' => 'Customer ' . $plateNumber,
                'address' => null,
            ]);

            if ($customer->wasRecentlyCreated) {
                $this->warnings[] = [
                    'line' => $line,
                    'message' => 'Customer otomatis dibuat untuk kendaraan dengan plat ' . $plateNumber . '.',
                ];
            }
        }

        $vehicle = Vehicle::firstOrCreate([
            'plate_number' => $plateNumber,
        ], [
            'customer_id' => $customer->id,
            'brand' => $brand,
            'model' => $model,
            'year' => null,
            'notes' => null,
        ]);

        if ($vehicle->wasRecentlyCreated) {
            $this->warnings[] = [
                'line' => $line,
                'message' => 'Kendaraan dengan plat ' . $plateNumber . ' dibuat otomatis karena tidak ditemukan.',
            ];
        }

        return $vehicle;
    }

    private function resolveMechanic(?string $employeeNumber, ?string $name, ?int $line = null): ?Mechanic
    {
        if ($employeeNumber) {
            $mechanic = Mechanic::query()->where('employee_number', $employeeNumber)->first();
            if ($mechanic) {
                return $mechanic;
            }
        }

        if ($name) {
            $mechanic = Mechanic::query()->where('name', $name)->first();
            if ($mechanic) {
                return $mechanic;
            }
        }

        if ($employeeNumber || $name) {
            $mechanic = Mechanic::firstOrCreate([
                'employee_number' => $employeeNumber ?? $this->slugFallback($name ?? 'mechanic'),
            ], [
                'name' => $name ?? 'Mechanic Import',
                'status' => 'active',
            ]);

            if ($mechanic->wasRecentlyCreated) {
                $this->warnings[] = [
                    'line' => $line,
                    'message' => 'Mekanik "' . ($name ?? $employeeNumber) . '" dibuat otomatis karena referensi tidak ditemukan.',
                ];
            }

            return $mechanic;
        }

        return null;
    }

    private function resolveSupplier(?string $phone, ?string $name, ?int $line = null): ?Supplier
    {
        $supplier = null;

        if ($phone) {
            $supplier = Supplier::query()->where('phone', $phone)->first();
        }

        if (! $supplier && $name) {
            $supplier = Supplier::query()->where('name', $name)->first();
        }

        if (! $supplier && ($phone || $name)) {
            $supplier = Supplier::firstOrCreate([
                'name' => $name ?? 'Supplier Import',
            ], [
                'phone' => $phone,
                'email' => null,
                'address' => null,
                'contact_person' => null,
            ]);

            if ($supplier->wasRecentlyCreated) {
                $this->warnings[] = [
                    'line' => $line,
                    'message' => 'Supplier "' . ($name ?? $phone) . '" dibuat otomatis karena referensi tidak ditemukan.',
                ];
            }
        }

        return $supplier;
    }

    private function resolveService(?string $code, ?string $title, ?int $line = null): Service
    {
        $service = null;

        if ($code) {
            $service = Service::query()->where('code', $code)->first();
        }

        if (! $service && $title) {
            $service = Service::query()->where('title', $title)->first();
        }

        if ($service) {
            return $service;
        }

        $generatedCode = $code ?: Str::upper(Str::slug($title ?: 'service-import', '-'));

        $service = Service::firstOrCreate([
            'code' => $generatedCode,
        ], [
            'title' => $title ?? $generatedCode,
            'status' => 'active',
            'price' => 0,
            'est_time_minutes' => null,
            'description' => null,
            'complexity_level' => 'medium',
            'incentive_mode' => 'same',
            'default_incentive_percentage' => 0,
            'has_warranty' => false,
        ]);

        if ($service->wasRecentlyCreated) {
            $this->warnings[] = [
                'line' => $line,
                'message' => 'Layanan "' . ($title ?? $generatedCode) . '" dibuat otomatis karena referensi tidak ditemukan.',
            ];
        }

        return $service;
    }

    private function resolvePart(?string $partNumber, ?string $name, ?int $line = null): Part
    {
        $part = null;

        if ($partNumber) {
            $part = Part::withTrashed()->where('part_number', $partNumber)->first();
        }

        if (! $part && $name) {
            $part = Part::withTrashed()->where('name', $name)->first();
        }

        if ($part) {
            if (method_exists($part, 'trashed') && $part->trashed()) {
                $part->restore();
            }

            return $part;
        }

        $part = Part::create([
            'part_number' => $partNumber,
            'name' => $name ?? ($partNumber ?: 'Part Import'),
            'status' => 'active',
            'stock' => 0,
            'buy_price' => 0,
            'sell_price' => 0,
        ]);

        if ($part->wasRecentlyCreated) {
            $this->warnings[] = [
                'line' => $line,
                'message' => 'Part "' . ($name ?? $partNumber) . '" dibuat otomatis karena referensi tidak ditemukan.',
            ];
        }

        return $part;
    }

    private function resolveUser(?string $email): ?User
    {
        if (! $email) {
            return null;
        }

        return User::query()->where('email', $email)->first();
    }

    private function calculateDiscountAmount(int $amount, string $discountType, float|int $discountValue): int
    {
        return match ($discountType) {
            'percent' => (int) round($amount * ((float) $discountValue / 100)),
            'fixed' => (int) round((float) $discountValue),
            default => 0,
        };
    }

    private function assertDataset(string $type): void
    {
        if (! array_key_exists($type, self::DATASET_META)) {
            throw new InvalidArgumentException('Tipe data transaksi tidak dikenal.');
        }
    }

    private function mapRow(array $headers, array $cells): array
    {
        $mapped = [];

        foreach ($headers as $index => $header) {
            if ($header === '') {
                continue;
            }

            $mapped[$header] = isset($cells[$index]) ? $this->normalizeCellValue($cells[$index]) : null;
        }

        return $mapped;
    }

    private function normalizeHeader(mixed $header): string
    {
        return Str::of((string) $header)
            ->lower()
            ->replaceMatches('/[^a-z0-9]+/', '_')
            ->trim('_')
            ->value();
    }

    private function normalizeCellValue(mixed $value): mixed
    {
        if (is_string($value)) {
            $trimmed = trim($value);
            return $trimmed === '' ? null : $trimmed;
        }

        return $value;
    }

    private function isRowEmpty(array $row): bool
    {
        foreach ($row as $key => $value) {
            if ($key === '__line') {
                continue;
            }

            if ($value !== null && $value !== '') {
                return false;
            }
        }

        return true;
    }

    private function stringOrNull(array $row, string $key): ?string
    {
        $value = Arr::get($row, $key);

        if ($value === null || $value === '') {
            return null;
        }

        return trim((string) $value);
    }

    private function stringOrDefault(array $row, string $key, string $default): string
    {
        return $this->stringOrNull($row, $key) ?? $default;
    }

    private function intOrNull(array $row, string $key): ?int
    {
        $value = Arr::get($row, $key);

        if ($value === null || $value === '') {
            return null;
        }

        if (is_numeric($value)) {
            return (int) round((float) $value);
        }

        throw new InvalidArgumentException('Kolom ' . $key . ' harus berupa angka.');
    }

    private function intOrNullIfNumeric(array $row, string $key): ?int
    {
        $value = Arr::get($row, $key);

        if ($value === null || $value === '') {
            return null;
        }

        return is_numeric($value) ? (int) round((float) $value) : null;
    }

    private function intOrDefault(array $row, string $key, int $default): int
    {
        return $this->intOrNull($row, $key) ?? $default;
    }

    private function floatOrDefault(array $row, string $key, float $default): float
    {
        $value = Arr::get($row, $key);

        if ($value === null || $value === '') {
            return $default;
        }

        if (is_numeric($value)) {
            return (float) $value;
        }

        throw new InvalidArgumentException('Kolom ' . $key . ' harus berupa angka desimal.');
    }

    private function enumOrNull(array $row, string $key, array $allowed): ?string
    {
        $value = $this->stringOrNull($row, $key);
        if ($value === null) {
            return null;
        }

        $exact = collect($allowed)->first(fn ($item) => strcasecmp((string) $item, $value) === 0);
        if ($exact === null) {
            throw new InvalidArgumentException('Kolom ' . $key . ' hanya boleh: ' . implode(', ', $allowed) . '.');
        }

        return (string) $exact;
    }

    private function enumOrDefault(array $row, string $key, array $allowed, string $default): string
    {
        return $this->enumOrNull($row, $key, $allowed) ?? $default;
    }

    private function boolOrDefault(array $row, string $key, bool $default): bool
    {
        $value = Arr::get($row, $key);

        if ($value === null || $value === '') {
            return $default;
        }

        if (is_bool($value)) {
            return $value;
        }

        if (is_numeric($value)) {
            return ((int) $value) === 1;
        }

        $string = Str::lower(trim((string) $value));
        $truthy = ['1', 'true', 'yes', 'ya'];
        $falsy = ['0', 'false', 'no', 'tidak'];

        if (in_array($string, $truthy, true)) {
            return true;
        }

        if (in_array($string, $falsy, true)) {
            return false;
        }

        throw new InvalidArgumentException('Kolom ' . $key . ' harus bernilai true/false.');
    }

    private function dateOrNull(array $row, string $key): ?string
    {
        $value = Arr::get($row, $key);

        if ($value === null || $value === '') {
            return null;
        }

        if (is_numeric($value)) {
            return ExcelDate::excelToDateTimeObject((float) $value)->format('Y-m-d');
        }

        try {
            return Carbon::parse((string) $value)->format('Y-m-d');
        } catch (\Throwable) {
            throw new InvalidArgumentException('Kolom ' . $key . ' harus format tanggal valid (contoh: 2026-04-09).');
        }
    }

    private function dateTimeOrNull(array $row, string $key): ?string
    {
        $value = Arr::get($row, $key);

        if ($value === null || $value === '') {
            return null;
        }

        if (is_numeric($value)) {
            return ExcelDate::excelToDateTimeObject((float) $value)->format('Y-m-d H:i:s');
        }

        try {
            return Carbon::parse((string) $value)->format('Y-m-d H:i:s');
        } catch (\Throwable) {
            throw new InvalidArgumentException('Kolom ' . $key . ' harus format datetime valid (contoh: 2026-04-09 08:00:00).');
        }
    }

    private function slugFallback(string $value): string
    {
        $slug = Str::slug($value);
        return $slug !== '' ? $slug : Str::random(8);
    }
}
