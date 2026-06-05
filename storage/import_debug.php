<?php
require __DIR__ . '/../vendor/autoload.php';
$app = require_once __DIR__ . '/../bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

use Illuminate\Http\UploadedFile;

try {
    $manager = $app->make(App\Services\Import\WorkshopImportManager::class);
    $path = __DIR__ . '/imports/template-import-vehicles.xlsx';
    if (!file_exists($path)) {
        echo json_encode(['error' => 'File not found: ' . $path]);
        exit(1);
    }

    $file = new UploadedFile($path, 'template-import-vehicles.xlsx', null, null, true);
    $result = $manager->import('vehicles', $file, true);
    echo json_encode($result, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
} catch (Throwable $e) {
    echo json_encode(['exception' => $e->getMessage(), 'trace' => $e->getTraceAsString()]);
}
