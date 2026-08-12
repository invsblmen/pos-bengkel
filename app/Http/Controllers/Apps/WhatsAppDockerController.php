<?php

namespace App\Http\Controllers\Apps;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Symfony\Component\Process\Process;
use Illuminate\Support\Facades\Log;

class WhatsAppDockerController extends Controller
{
    private function resolveDockerCommand(array $parts): array
    {
        // Prefer `docker compose` (modern) but fallback to `docker-compose`
        $cmd = 'docker compose';
        $check = Process::fromShellCommandline('docker compose version');
        $check->run();
        if (! $check->isSuccessful()) {
            $cmd = 'docker-compose';
        }

        return array_merge([$cmd], $parts);
    }

    private function runProcess(array $cmdParts, int $timeout = 120): array
    {
        $process = new Process($cmdParts);
        $process->setTimeout($timeout);
        try {
            $process->run();
            return [
                'success' => $process->isSuccessful(),
                'output' => $process->getOutput(),
                'error' => $process->getErrorOutput(),
                'exit_code' => $process->getExitCode(),
            ];
        } catch (\Throwable $e) {
            Log::error('WhatsAppDockerController process failed', ['exception' => $e->getMessage()]);
            return [
                'success' => false,
                'output' => '',
                'error' => $e->getMessage(),
                'exit_code' => null,
            ];
        }
    }

    private function composeFileArg(): string
    {
        $path = (string) config('whatsapp.docker.compose_file', 'go-whatsapp-web-multidevice/docker-compose.yml');
        if (! str_starts_with($path, '/') && ! preg_match('/^[A-Za-z]:\\\\/', $path)) {
            $path = base_path($path);
        }

        return $path;
    }

    public function start(Request $request): JsonResponse
    {
        $compose = $this->composeFileArg();
        $service = (string) config('whatsapp.docker.service_name', '');

        $parts = [$compose, 'up', '-d', '--build'];
        if (! empty($service)) {
            array_splice($parts, 2, 0, ['-f']); // placeholder to ensure -f is first
        }

        $cmdParts = $this->resolveDockerCommand(array_merge(['-f', $compose], ['up', '-d', '--build']));

        $result = $this->runProcess($cmdParts, 600);

        return response()->json($result, $result['success'] ? 200 : 500);
    }

    public function stop(Request $request): JsonResponse
    {
        $compose = $this->composeFileArg();
        $cmdParts = $this->resolveDockerCommand(['-f', $compose, 'down']);
        $result = $this->runProcess($cmdParts);
        return response()->json($result, $result['success'] ? 200 : 500);
    }

    public function restart(Request $request): JsonResponse
    {
        // Implement as stop then start to ensure a clean restart
        $stop = $this->stop($request)->getData(true);
        if (! ($stop['success'] ?? false)) {
            // proceed anyway to attempt start
            Log::warning('Docker stop reported failure during restart', $stop);
        }

        // Start
        $start = $this->start($request)->getData(true);

        $success = ($start['success'] ?? false);
        $code = $success ? 200 : 500;
        return response()->json($start, $code);
    }

    public function status(Request $request): JsonResponse
    {
        $compose = $this->composeFileArg();
        $cmdParts = $this->resolveDockerCommand(['-f', $compose, 'ps']);
        $result = $this->runProcess($cmdParts);

        // Parse simple status: pass raw output as text
        return response()->json($result, 200);
    }
}
