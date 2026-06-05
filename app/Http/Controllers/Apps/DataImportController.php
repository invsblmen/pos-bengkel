<?php

namespace App\Http\Controllers\Apps;

use App\Http\Controllers\Controller;
use App\Services\Import\WorkshopImportManager;
use Illuminate\Http\Request;
use Illuminate\Support\Str;
use InvalidArgumentException;
use Inertia\Inertia;
use Symfony\Component\HttpFoundation\StreamedResponse;

class DataImportController extends Controller
{
    public function __construct(private readonly WorkshopImportManager $importManager)
    {
    }

    public function index(Request $request)
    {
        return Inertia::render('Dashboard/Imports/Index', [
            'datasets' => $this->importManager->datasetOptions(),
            'selectedType' => $request->query('type'),
            'lastResult' => null,
            'importError' => null,
        ]);
    }

    public function store(Request $request)
    {
        $validTypes = collect($this->importManager->datasetOptions())
            ->pluck('type')
            ->all();

        $validated = $request->validate([
            'type' => ['required', 'string', 'in:' . implode(',', $validTypes)],
            'file' => ['required', 'file', 'mimes:xlsx,xls,csv', 'max:10240'],
            'dry_run' => ['nullable', 'boolean'],
        ]);

        $dryRun = (bool) $request->boolean('dry_run');

        try {
            $result = $this->importManager->import($validated['type'], $validated['file'], $dryRun);
            $importError = null;
        } catch (InvalidArgumentException $e) {
            $result = null;
            $importError = $e->getMessage();
        } catch (\Throwable $e) {
            $result = null;
            $importError = 'Gagal memproses file import: ' . $e->getMessage();
        }

        return Inertia::render('Dashboard/Imports/Index', [
            'datasets' => $this->importManager->datasetOptions(),
            'selectedType' => $validated['type'],
            'lastResult' => $result,
            'importError' => $importError,
            'dryRun' => $dryRun,
        ]);
    }

    public function template(string $type): StreamedResponse
    {
        try {
            $spreadsheet = $this->importManager->buildTemplate($type);
        } catch (InvalidArgumentException) {
            abort(404);
        }

        $filename = 'template-import-' . Str::slug($type) . '.xlsx';

        return response()->streamDownload(function () use ($spreadsheet) {
            $writer = new \PhpOffice\PhpSpreadsheet\Writer\Xlsx($spreadsheet);
            $writer->save('php://output');
        }, $filename, [
            'Content-Type' => 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        ]);
    }
}
