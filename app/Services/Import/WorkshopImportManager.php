<?php

namespace App\Services\Import;

use App\Models\Customer;
use App\Models\Mechanic;
use App\Models\Part;
use App\Models\PartCategory;
use App\Models\Service;
use App\Models\ServiceCategory;
use App\Models\Supplier;
use App\Models\Vehicle;
use Carbon\Carbon;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Arr;
use Illuminate\Support\Str;
use InvalidArgumentException;
use PhpOffice\PhpSpreadsheet\Cell\Coordinate;
use PhpOffice\PhpSpreadsheet\Style\Alignment;
use PhpOffice\PhpSpreadsheet\Style\Fill;
use PhpOffice\PhpSpreadsheet\IOFactory;
use PhpOffice\PhpSpreadsheet\Shared\Date as ExcelDate;
use PhpOffice\PhpSpreadsheet\Spreadsheet;

class WorkshopImportManager
{
    public const DATASET_META = [
        'customers' => [
            'label' => 'Pelanggan',
            'description' => 'Master pelanggan bengkel',
            'headers' => [
                'name', 'phone', 'email', 'address', 'gender', 'birth_date',
                'city', 'postal_code', 'identity_type', 'identity_number',
            ],
            'sample' => [[
                'Budi Santoso', '081234567890', 'budi@example.com', 'Jl. Merdeka No. 10', 'male', '1990-02-15',
                'Bandung', '40111', 'KTP', '3273010000000001',
            ]],
            'required_headers' => ['name', 'phone'],
            'recommended_headers' => ['email', 'address', 'city'],
            'import_order' => 1,
        ],
        'vehicles' => [
            'label' => 'Kendaraan',
            'description' => 'Data kendaraan milik pelanggan',
            'headers' => [
                'customer_phone', 'customer_identity_number', 'customer_name', 'plate_number', 'brand', 'model', 'year', 'notes',
                'engine_type', 'transmission_type', 'color', 'cylinder_volume',
                'features', 'chassis_number', 'engine_number', 'manufacture_year',
                'registration_number', 'registration_date', 'stnk_expiry_date', 'previous_owner',
            ],
            'sample' => [[
                '', '3273010000000001', 'Budi Santoso', 'D1234AB', 'Honda', 'Beat', '2022', 'Servis rutin',
                '4-stroke', 'automatic', 'Hitam', '110cc',
                'ABS,LED', 'CHS-123', 'ENG-888', '2022',
                'REG-4455', '2024-01-10', '2029-01-10', 'Budi Santoso',
            ]],
            'required_headers' => ['plate_number'],
            'recommended_headers' => ['customer_phone', 'customer_identity_number', 'customer_name', 'brand', 'model', 'year'],
            'import_order' => 2,
            'notes' => 'Isi customer_phone atau customer_identity_number untuk identitas unik pemilik. customer_name boleh dipakai jika unik.',
        ],
        'mechanics' => [
            'label' => 'Mekanik',
            'description' => 'Data tenaga mekanik',
            'headers' => [
                'name', 'phone', 'email', 'employee_number', 'notes', 'status',
                'specialization', 'hourly_rate', 'commission_percentage', 'certification',
            ],
            'sample' => [[
                'Andi Wijaya', '081345678901', 'andi@bengkel.id', 'MK-001', 'Senior mekanik', 'active',
                'Engine,Tune Up', '75000', '12.5', 'Honda Cert,EFI Cert',
            ]],
            'required_headers' => ['name'],
            'recommended_headers' => ['employee_number', 'status', 'phone'],
            'import_order' => 3,
        ],
        'suppliers' => [
            'label' => 'Supplier',
            'description' => 'Data pemasok sparepart',
            'headers' => [
                'name', 'phone', 'email', 'address', 'contact_person',
            ],
            'sample' => [[
                'CV Sumber Jaya', '022778899', 'sales@sumberjaya.co.id', 'Jl. Industri No. 5', 'Rina',
            ]],
            'required_headers' => ['name'],
            'recommended_headers' => ['phone', 'contact_person', 'address'],
            'import_order' => 4,
        ],
        'part_categories' => [
            'label' => 'Kategori Sparepart',
            'description' => 'Kategori master sparepart',
            'headers' => [
                'name', 'description', 'icon', 'sort_order',
            ],
            'sample' => [[
                'Oli', 'Kategori oli mesin', 'droplet', '1',
            ]],
            'required_headers' => ['name'],
            'recommended_headers' => ['description', 'sort_order'],
            'import_order' => 5,
        ],
        'parts' => [
            'label' => 'Sparepart',
            'description' => 'Master sparepart bengkel',
            'headers' => [
                'name', 'part_number', 'barcode', 'description', 'buy_price', 'sell_price', 'stock',
                'minimal_stock', 'rack_location', 'unit_measure', 'reorder_level', 'status',
                'part_category_name', 'supplier_name', 'has_warranty', 'warranty_duration_days', 'warranty_terms',
            ],
            'sample' => [[
                'Oli MPX 2 10W-30', 'OLI-HONDA-001', '8997770001112', 'Oli untuk motor matic', '45000', '55000', '30',
                '8', 'A-01', 'botol', '10', 'active',
                'Oli', 'CV Sumber Jaya', 'true', '30', 'Garansi kebocoran pabrik',
            ]],
            'required_headers' => ['name'],
            'recommended_headers' => ['part_number', 'buy_price', 'sell_price', 'stock', 'part_category_name'],
            'import_order' => 6,
        ],
        'service_categories' => [
            'label' => 'Kategori Layanan',
            'description' => 'Kategori master layanan servis',
            'headers' => [
                'name', 'description', 'icon', 'sort_order',
            ],
            'sample' => [[
                'Servis Ringan', 'Perawatan dasar berkala', 'tool', '1',
            ]],
            'required_headers' => ['name'],
            'recommended_headers' => ['description', 'sort_order'],
            'import_order' => 7,
        ],
        'services' => [
            'label' => 'Layanan',
            'description' => 'Master layanan jasa bengkel',
            'headers' => [
                'code', 'title', 'description', 'est_time_minutes', 'price', 'service_category_name',
                'complexity_level', 'required_tools', 'status', 'incentive_mode',
                'default_incentive_percentage', 'has_warranty', 'warranty_duration_days', 'warranty_terms',
            ],
            'sample' => [[
                'SRV-TUNEUP', 'Tune Up Matic', 'Paket tune up standar', '60', '150000', 'Servis Ringan',
                'medium', 'Kunci T,Feeler Gauge', 'active', 'same',
                '10', 'false', '', '',
            ]],
            'required_headers' => ['title'],
            'recommended_headers' => ['code', 'price', 'service_category_name', 'status'],
            'import_order' => 8,
        ],
    ];

    public function datasetOptions(): array
    {
        $masterOptions = collect(self::DATASET_META)
            ->map(function (array $meta, string $type) {
                return [
                    'type' => $type,
                    'label' => $meta['label'],
                    'description' => $meta['description'],
                    'headers' => $meta['headers'],
                    'required_headers' => $meta['required_headers'] ?? [],
                    'recommended_headers' => $meta['recommended_headers'] ?? [],
                    'import_order' => (int) ($meta['import_order'] ?? 999),
                    'notes' => $meta['notes'] ?? null,
                ];
            })
            ->sortBy('import_order')
            ->values();

        return $masterOptions
            ->merge($this->transactionManager()->datasetOptions())
            ->sortBy('import_order')
            ->values()
            ->all();
    }

    public function import(string $type, UploadedFile $file, bool $dryRun = false): array
    {
        if ($this->isTransactionType($type)) {
            return $this->transactionManager()->import($type, $file, $dryRun);
        }

        $this->assertDataset($type);

        $rows = $this->readRows($file);
        $requiredHeaders = self::DATASET_META[$type]['required_headers'] ?? [];
        if (count($rows) < 2) {
            throw new InvalidArgumentException('File tidak memiliki baris data. Gunakan template sample agar format sesuai.');
        }

        $headers = collect($rows[0])
            ->map(fn ($value) => $this->normalizeHeader($value))
            ->values()
            ->all();

        $processedRows = 0;
        $successRows = 0;
        $createdRows = 0;
        $updatedRows = 0;
        $failedRows = 0;
        $skippedRows = 0;
        $wouldCreateRows = 0;
        $wouldUpdateRows = 0;
        $failures = [];

        foreach (array_slice($rows, 1) as $offset => $cells) {
            $line = $offset + 2;
            $rowData = $this->mapRow($headers, $cells);

            if ($this->isRowEmpty($rowData)) {
                $skippedRows++;
                continue;
            }

            $processedRows++;

            try {
                $this->assertRequiredColumns($rowData, $requiredHeaders);
                $action = $this->dispatchImport($type, $rowData, $dryRun);
                $successRows++;

                if ($action === 'created') {
                    $createdRows++;
                    if ($dryRun) {
                        $wouldCreateRows++;
                    }
                } else {
                    $updatedRows++;
                    if ($dryRun) {
                        $wouldUpdateRows++;
                    }
                }
            } catch (\Throwable $e) {
                $failedRows++;
                $failures[] = [
                    'line' => $line,
                    'message' => $e->getMessage(),
                ];
            }
        }

        return [
            'dataset' => Arr::get(self::DATASET_META, $type . '.label', $type),
            'dataset_type' => $type,
            'processed_rows' => $processedRows,
            'successful_rows' => $successRows,
            'created_rows' => $createdRows,
            'updated_rows' => $updatedRows,
            'failed_rows' => $failedRows,
            'skipped_rows' => $skippedRows,
            'would_create_rows' => $wouldCreateRows,
            'would_update_rows' => $wouldUpdateRows,
            'dry_run' => $dryRun,
            'failures' => $failures,
        ];
    }

    public function buildTemplate(string $type): Spreadsheet
    {
        if ($this->isTransactionType($type)) {
            return $this->transactionManager()->buildTemplate($type);
        }

        $this->assertDataset($type);

        $meta = self::DATASET_META[$type];
        $requiredHeaders = $meta['required_headers'] ?? [];
        $recommendedHeaders = $meta['recommended_headers'] ?? [];
        $spreadsheet = new Spreadsheet();

        $instructions = $spreadsheet->getActiveSheet();
        $instructions->setTitle('Instructions');
        $instructions->setCellValue('A1', 'Template Import ' . $meta['label']);
        $instructions->setCellValue('A3', '1. Isi sheet Data mulai baris 2.');
        $instructions->setCellValue('A4', '2. Header bertanda * wajib diisi (merah).');
        $instructions->setCellValue('A5', '3. Header biru adalah kolom rekomendasi untuk hasil import yang lebih lengkap.');
        $instructions->setCellValue('A6', '4. Jangan ubah nama header kolom.');
        $instructions->setCellValue('A7', '5. Untuk relasi, gunakan nilai referensi yang sudah ada atau sesuai sample.');
        $instructions->setCellValue('A8', '6. Aktifkan Dry Run dulu sebelum simpan ke database.');
        $instructions->setCellValue('A9', '7. File boleh .xlsx, .xls, atau .csv untuk import.');
        $instructions->getStyle('A1')->getFont()->setBold(true)->setSize(14);
        $instructions->getStyle('A3:A9')->getAlignment()->setWrapText(true)->setVertical(Alignment::VERTICAL_TOP);
        $instructions->getColumnDimension('A')->setAutoSize(true);

        $sheet = $spreadsheet->createSheet();
        $sheet->setTitle('Data');

        foreach ($meta['headers'] as $index => $header) {
            $column = Coordinate::stringFromColumnIndex($index + 1);
            $isRequired = in_array($header, $requiredHeaders, true);
            $isRecommended = in_array($header, $recommendedHeaders, true);
            $sheet->setCellValue($column . '1', $this->renderTemplateHeader($header, $isRequired));
            $this->styleTemplateHeader($sheet, $column . '1', $isRequired, $isRecommended);
        }

        foreach ($meta['sample'] as $rowIndex => $sampleRow) {
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

        $spreadsheet->setActiveSheetIndex(1);

        return $spreadsheet;
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

    private function assertDataset(string $type): void
    {
        if (! array_key_exists($type, self::DATASET_META)) {
            throw new InvalidArgumentException('Tipe data import tidak dikenal.');
        }
    }

    private function isTransactionType(string $type): bool
    {
        return in_array($type, ['service_orders', 'part_purchases', 'part_sales'], true);
    }

    private function transactionManager(): WorkshopTransactionImportManager
    {
        return app(WorkshopTransactionImportManager::class);
    }

    private function readRows(UploadedFile $file): array
    {
        $spreadsheet = IOFactory::load($file->getRealPath());
        $sheet = $spreadsheet->getActiveSheet();

        return $sheet->toArray(null, true, true, false);
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
        foreach ($row as $value) {
            if ($value !== null && $value !== '') {
                return false;
            }
        }

        return true;
    }

    private function assertRequiredColumns(array $row, array $requiredHeaders): void
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
            throw new InvalidArgumentException('Kolom wajib belum diisi: ' . implode(', ', $missing) . '.');
        }
    }

    private function dispatchImport(string $type, array $row, bool $dryRun = false): string
    {
        return match ($type) {
            'customers' => $this->importCustomer($row, $dryRun),
            'vehicles' => $this->importVehicle($row, $dryRun),
            'mechanics' => $this->importMechanic($row, $dryRun),
            'suppliers' => $this->importSupplier($row, $dryRun),
            'part_categories' => $this->importPartCategory($row, $dryRun),
            'parts' => $this->importPart($row, $dryRun),
            'service_categories' => $this->importServiceCategory($row, $dryRun),
            'services' => $this->importService($row, $dryRun),
            default => throw new InvalidArgumentException('Tipe import tidak didukung.'),
        };
    }

    private function importCustomer(array $row, bool $dryRun = false): string
    {
        $name = $this->stringOrNull($row, 'name');
        $phone = $this->stringOrNull($row, 'phone');

        if (! $name) {
            throw new InvalidArgumentException('Kolom name wajib diisi.');
        }

        if (! $phone) {
            throw new InvalidArgumentException('Kolom phone wajib diisi.');
        }

        $payload = [
            'name' => $name,
            'phone' => $phone,
            'email' => $this->stringOrNull($row, 'email'),
            'address' => $this->stringOrNull($row, 'address'),
            'gender' => $this->enumOrNull($row, 'gender', ['male', 'female']),
            'birth_date' => $this->dateOrNull($row, 'birth_date'),
            'city' => $this->stringOrNull($row, 'city'),
            'postal_code' => $this->stringOrNull($row, 'postal_code'),
            'identity_type' => $this->enumOrNull($row, 'identity_type', ['KTP', 'SIM', 'Passport']),
            'identity_number' => $this->stringOrNull($row, 'identity_number'),
        ];

        $model = Customer::where('phone', $phone)->first();

        if ($model) {
            if (! $dryRun) {
                $model->fill($payload)->save();
            }
            return 'updated';
        }

        if (! $dryRun) {
            Customer::create($payload);
        }
        return 'created';
    }

    private function importVehicle(array $row, bool $dryRun = false): string
    {
        $plateNumber = strtoupper((string) ($this->stringOrNull($row, 'plate_number') ?? ''));
        $customerPhone = $this->stringOrNull($row, 'customer_phone');
        $customerIdentityNumber = $this->stringOrNull($row, 'customer_identity_number');
        $customerName = $this->stringOrNull($row, 'customer_name');

        if (! $plateNumber) {
            throw new InvalidArgumentException('Kolom plate_number wajib diisi.');
        }

        $customer = $this->resolveVehicleCustomer($customerName, $customerPhone, $customerIdentityNumber, $dryRun);

        $payload = [
            'customer_id' => $customer->id,
            'plate_number' => $plateNumber,
            'brand' => $this->stringOrNull($row, 'brand'),
            'model' => $this->stringOrNull($row, 'model'),
            'year' => $this->intOrNull($row, 'year'),
            'notes' => $this->stringOrNull($row, 'notes'),
            'engine_type' => $this->stringOrNull($row, 'engine_type'),
            'transmission_type' => $this->enumOrNull($row, 'transmission_type', ['manual', 'automatic']),
            'color' => $this->stringOrNull($row, 'color'),
            'cylinder_volume' => $this->stringOrNull($row, 'cylinder_volume'),
            'features' => $this->csvListOrNull($row, 'features'),
            'chassis_number' => $this->stringOrNull($row, 'chassis_number'),
            'engine_number' => $this->stringOrNull($row, 'engine_number'),
            'manufacture_year' => $this->intOrNull($row, 'manufacture_year'),
            'registration_number' => $this->stringOrNull($row, 'registration_number'),
            'registration_date' => $this->dateOrNull($row, 'registration_date'),
            'stnk_expiry_date' => $this->dateOrNull($row, 'stnk_expiry_date'),
            'previous_owner' => $this->stringOrNull($row, 'previous_owner'),
        ];

        $model = Vehicle::where('plate_number', $plateNumber)->first();

        if ($model) {
            if (! $dryRun) {
                $model->fill($payload)->save();
            }
            return 'updated';
        }

        if (! $dryRun) {
            Vehicle::create($payload);
        }
        return 'created';
    }

    private function resolveVehicleCustomer(?string $customerName, ?string $customerPhone, ?string $customerIdentityNumber, bool $dryRun = false)
    {
        $defaultPhone = '000000000000';
        $defaultName = 'Pemilik Tidak Diketahui';

        if ($customerPhone) {
            $customer = Customer::where('phone', $customerPhone)->first();
            if ($customer) {
                return $customer;
            }

            throw new InvalidArgumentException('Pelanggan dengan customer_phone ' . $customerPhone . ' tidak ditemukan.');
        }

        if ($customerIdentityNumber) {
            $customer = Customer::where('identity_number', $customerIdentityNumber)->first();
            if ($customer) {
                return $customer;
            }

            throw new InvalidArgumentException('Pelanggan dengan customer_identity_number ' . $customerIdentityNumber . ' tidak ditemukan.');
        }

        if ($customerName) {
            $query = Customer::where('name', $customerName);
            $matchCount = (int) $query->count();

            if ($matchCount === 1) {
                return $query->first();
            }

            if ($matchCount > 1) {
                throw new InvalidArgumentException('Nama customer "' . $customerName . '" ditemukan lebih dari satu kali. Gunakan customer_phone atau customer_identity_number.');
            }

            throw new InvalidArgumentException('Pelanggan dengan customer_name ' . $customerName . ' tidak ditemukan.');
        }

        if ($dryRun) {
            return Customer::make([
                'name' => $customerName ?: $defaultName,
                'phone' => $customerPhone,
                'email' => null,
                'address' => null,
                'gender' => null,
                'birth_date' => null,
                'city' => null,
                'postal_code' => null,
                'identity_type' => null,
                'identity_number' => null,
            ]);
        }

        return Customer::create([
            'name' => $customerName ?: $defaultName,
            'phone' => $customerPhone ?: $defaultPhone,
            'email' => null,
            'address' => null,
            'gender' => null,
            'birth_date' => null,
            'city' => null,
            'postal_code' => null,
            'identity_type' => null,
            'identity_number' => null,
        ]);
    }

    private function importMechanic(array $row, bool $dryRun = false): string
    {
        $name = $this->stringOrNull($row, 'name');
        if (! $name) {
            throw new InvalidArgumentException('Kolom name wajib diisi.');
        }

        $employeeNumber = $this->stringOrNull($row, 'employee_number');
        $phone = $this->stringOrNull($row, 'phone');

        $payload = [
            'name' => $name,
            'phone' => $phone,
            'email' => $this->stringOrNull($row, 'email'),
            'employee_number' => $employeeNumber,
            'notes' => $this->stringOrNull($row, 'notes'),
            'status' => $this->enumOrDefault($row, 'status', ['active', 'inactive'], 'active'),
            'specialization' => $this->csvListOrNull($row, 'specialization'),
            'hourly_rate' => $this->intOrDefault($row, 'hourly_rate', 0),
            'commission_percentage' => $this->floatOrDefault($row, 'commission_percentage', 0),
            'certification' => $this->csvListOrNull($row, 'certification'),
        ];

        $model = null;

        if ($employeeNumber) {
            $model = Mechanic::where('employee_number', $employeeNumber)->first();
        }

        if (! $model && $phone) {
            $model = Mechanic::where('phone', $phone)->first();
        }

        if (! $model) {
            $model = Mechanic::where('name', $name)->first();
        }

        if ($model) {
            if (! $dryRun) {
                $model->fill($payload)->save();
            }
            return 'updated';
        }

        if (! $dryRun) {
            Mechanic::create($payload);
        }
        return 'created';
    }

    private function importSupplier(array $row, bool $dryRun = false): string
    {
        $name = $this->stringOrNull($row, 'name');
        if (! $name) {
            throw new InvalidArgumentException('Kolom name wajib diisi.');
        }

        $payload = [
            'name' => $name,
            'phone' => $this->stringOrNull($row, 'phone'),
            'email' => $this->stringOrNull($row, 'email'),
            'address' => $this->stringOrNull($row, 'address'),
            'contact_person' => $this->stringOrNull($row, 'contact_person'),
        ];

        $model = Supplier::where('name', $name)->first();

        if ($model) {
            if (! $dryRun) {
                $model->fill($payload)->save();
            }
            return 'updated';
        }

        if (! $dryRun) {
            Supplier::create($payload);
        }
        return 'created';
    }

    private function importPartCategory(array $row, bool $dryRun = false): string
    {
        $name = $this->stringOrNull($row, 'name');
        if (! $name) {
            throw new InvalidArgumentException('Kolom name wajib diisi.');
        }

        $payload = [
            'name' => $name,
            'description' => $this->stringOrNull($row, 'description'),
            'icon' => $this->stringOrNull($row, 'icon'),
            'sort_order' => $this->intOrDefault($row, 'sort_order', 0),
        ];

        $model = PartCategory::where('name', $name)->first();

        if ($model) {
            if (! $dryRun) {
                $model->fill($payload)->save();
            }
            return 'updated';
        }

        if (! $dryRun) {
            PartCategory::create($payload);
        }
        return 'created';
    }

    private function importPart(array $row, bool $dryRun = false): string
    {
        $name = $this->stringOrNull($row, 'name');
        if (! $name) {
            throw new InvalidArgumentException('Kolom name wajib diisi.');
        }

        $partCategoryName = $this->stringOrNull($row, 'part_category_name');
        $supplierName = $this->stringOrNull($row, 'supplier_name');

        $partCategoryId = null;
        if ($partCategoryName) {
            if ($dryRun) {
                $partCategory = PartCategory::where('name', $partCategoryName)->first();
                $partCategoryId = $partCategory?->id;
            } else {
                $partCategory = PartCategory::firstOrCreate(['name' => $partCategoryName]);
                $partCategoryId = $partCategory->id;
            }
        }

        $supplierId = null;
        if ($supplierName) {
            if ($dryRun) {
                $supplier = Supplier::where('name', $supplierName)->first();
                $supplierId = $supplier?->id;
            } else {
                $supplier = Supplier::firstOrCreate(['name' => $supplierName]);
                $supplierId = $supplier->id;
            }
        }

        $partNumber = $this->stringOrNull($row, 'part_number');
        $barcode = $this->stringOrNull($row, 'barcode');

        $payload = [
            'name' => $name,
            'part_number' => $partNumber,
            'barcode' => $barcode,
            'description' => $this->stringOrNull($row, 'description'),
            'buy_price' => $this->intOrDefault($row, 'buy_price', 0),
            'sell_price' => $this->intOrDefault($row, 'sell_price', 0),
            'stock' => $this->intOrDefault($row, 'stock', 0),
            'minimal_stock' => $this->intOrDefault($row, 'minimal_stock', 0),
            'rack_location' => $this->stringOrNull($row, 'rack_location'),
            'unit_measure' => $this->stringOrDefault($row, 'unit_measure', 'pcs'),
            'reorder_level' => $this->intOrDefault($row, 'reorder_level', 5),
            'status' => $this->enumOrDefault($row, 'status', ['active', 'inactive'], 'active'),
            'part_category_id' => $partCategoryId,
            'supplier_id' => $supplierId,
            'has_warranty' => $this->boolOrDefault($row, 'has_warranty', false),
            'warranty_duration_days' => $this->intOrNull($row, 'warranty_duration_days'),
            'warranty_terms' => $this->stringOrNull($row, 'warranty_terms'),
        ];

        $model = null;

        if ($partNumber) {
            $model = Part::withTrashed()->where('part_number', $partNumber)->first();
        }

        if (! $model && $barcode) {
            $model = Part::withTrashed()->where('barcode', $barcode)->first();
        }

        if (! $model) {
            $model = Part::withTrashed()->where('name', $name)->first();
        }

        if ($model) {
            if (method_exists($model, 'trashed') && $model->trashed()) {
                if (! $dryRun) {
                    $model->restore();
                }
            }

            if (! $dryRun) {
                $model->fill($payload)->save();
            }
            return 'updated';
        }

        if (! $dryRun) {
            Part::create($payload);
        }
        return 'created';
    }

    private function importServiceCategory(array $row, bool $dryRun = false): string
    {
        $name = $this->stringOrNull($row, 'name');
        if (! $name) {
            throw new InvalidArgumentException('Kolom name wajib diisi.');
        }

        $payload = [
            'name' => $name,
            'description' => $this->stringOrNull($row, 'description'),
            'icon' => $this->stringOrNull($row, 'icon'),
            'sort_order' => $this->intOrDefault($row, 'sort_order', 0),
        ];

        $model = ServiceCategory::where('name', $name)->first();

        if ($model) {
            if (! $dryRun) {
                $model->fill($payload)->save();
            }
            return 'updated';
        }

        if (! $dryRun) {
            ServiceCategory::create($payload);
        }
        return 'created';
    }

    private function importService(array $row, bool $dryRun = false): string
    {
        $title = $this->stringOrNull($row, 'title');
        if (! $title) {
            throw new InvalidArgumentException('Kolom title wajib diisi.');
        }

        $serviceCategoryName = $this->stringOrNull($row, 'service_category_name');
        $serviceCategoryId = null;

        if ($serviceCategoryName) {
            if ($dryRun) {
                $serviceCategory = ServiceCategory::where('name', $serviceCategoryName)->first();
                $serviceCategoryId = $serviceCategory?->id;
            } else {
                $serviceCategory = ServiceCategory::firstOrCreate(['name' => $serviceCategoryName]);
                $serviceCategoryId = $serviceCategory->id;
            }
        }

        $code = $this->stringOrNull($row, 'code') ?: Str::upper(Str::slug($title, '-'));

        $payload = [
            'code' => $code,
            'title' => $title,
            'description' => $this->stringOrNull($row, 'description'),
            'est_time_minutes' => $this->intOrNull($row, 'est_time_minutes'),
            'price' => $this->intOrDefault($row, 'price', 0),
            'service_category_id' => $serviceCategoryId,
            'complexity_level' => $this->enumOrDefault($row, 'complexity_level', ['easy', 'medium', 'hard'], 'medium'),
            'required_tools' => $this->csvListOrNull($row, 'required_tools'),
            'status' => $this->enumOrDefault($row, 'status', ['active', 'inactive'], 'active'),
            'incentive_mode' => $this->enumOrDefault($row, 'incentive_mode', ['same', 'by_mechanic'], 'same'),
            'default_incentive_percentage' => $this->floatOrDefault($row, 'default_incentive_percentage', 0),
            'has_warranty' => $this->boolOrDefault($row, 'has_warranty', false),
            'warranty_duration_days' => $this->intOrNull($row, 'warranty_duration_days'),
            'warranty_terms' => $this->stringOrNull($row, 'warranty_terms'),
        ];

        $model = Service::withTrashed()->where('code', $code)->first();
        if (! $model) {
            $model = Service::withTrashed()->where('title', $title)->first();
        }

        if ($model) {
            if (method_exists($model, 'trashed') && $model->trashed()) {
                if (! $dryRun) {
                    $model->restore();
                }
            }

            if (! $dryRun) {
                $model->fill($payload)->save();
            }
            return 'updated';
        }

        if (! $dryRun) {
            Service::create($payload);
        }
        return 'created';
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

    private function csvListOrNull(array $row, string $key): ?array
    {
        $value = $this->stringOrNull($row, $key);

        if ($value === null) {
            return null;
        }

        $items = collect(explode(',', $value))
            ->map(fn ($item) => trim($item))
            ->filter(fn ($item) => $item !== '')
            ->values()
            ->all();

        return empty($items) ? null : $items;
    }
}
