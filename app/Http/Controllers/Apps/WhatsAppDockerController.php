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

    private function dockerCliAvailable(): bool
    {
        try {
            $p = Process::fromShellCommandline('docker version');
            $p->setTimeout(5);
            $p->run();
            return $p->isSuccessful();
        } catch (\Throwable $e) {
            return false;
        }
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

    private function dockerApiHost(): ?string
    {
        $host = (string) config('whatsapp.docker.host', '');
        if (empty($host)) {
            return null;
        }

        // Normalize tcp:// to http:// for requests
        if (str_starts_with($host, 'tcp://')) {
            $host = 'http://' . substr($host, strlen('tcp://'));
        }

        return rtrim($host, '/');
    }

    private function callDockerApi(string $method, string $path, array $options = []): array
    {
        $host = $this->dockerApiHost();
        if (empty($host)) {
            return ['success' => false, 'error' => 'Docker API host not configured (WHATSAPP_DOCKER_HOST).'];
        }

        try {
            $full = $host . $path;
            $client = app()->make('http.client');
            // If http.client binding not available, fallback to Http facade
            if (is_callable([$client, 'request'])) {
                $response = $client->request($method, $full, $options);
                $body = (string) $response->getBody();
                $status = $response->getStatusCode();
                $json = json_decode($body, true);
                return ['success' => $status >= 200 && $status < 300, 'status' => $status, 'body' => $json ?? $body];
            }

            $response = \Illuminate\Support\Facades\Http::withOptions(['verify' => false, 'timeout' => 10])->send($method, $full, $options);
            $body = $response->body();
            $status = $response->status();
            $json = null;
            try { $json = $response->json(); } catch (\Throwable $_) { $json = null; }
            return ['success' => $response->successful(), 'status' => $status, 'body' => $json ?? $body];
        } catch (\Throwable $e) {
            return ['success' => false, 'error' => $e->getMessage()];
        }
    }

    public function start(Request $request): JsonResponse
    {
        // Prefer CLI if available
        if ($this->dockerCliAvailable()) {
            $compose = $this->composeFileArg();
            $cmdParts = $this->resolveDockerCommand(['-f', $compose, 'up', '-d', '--build']);
            $result = $this->runProcess($cmdParts, 600);
            return response()->json($result, $result['success'] ? 200 : 500);
        }

        // Fallback to Docker Engine API over TCP
        $service = (string) config('whatsapp.docker.service_name', '');
        if (empty($service)) {
            return response()->json(['success' => false, 'error' => 'Docker CLI unavailable and no service_name configured for API fallback. Set WHATSAPP_GO_DOCKER_SERVICE or install Docker.'], 500);
        }

        // Find containers matching compose service label or name
        $res = $this->callDockerApi('GET', '/containers/json?all=1');
        if (!($res['success'] ?? false)) {
            return response()->json($res, 500);
        }

        $containers = is_array($res['body']) ? $res['body'] : [];
        $matched = array_filter($containers, function ($c) use ($service) {
            $labels = $c['Labels'] ?? [];
            if (isset($labels['com.docker.compose.service']) && $labels['com.docker.compose.service'] === $service) return true;
            foreach ($c['Names'] ?? [] as $n) {
                if (str_contains($n, $service)) return true;
            }
            return false;
        });

        if (empty($matched)) {
            return response()->json(['success' => false, 'error' => 'No containers found matching service name for API fallback.'], 404);
        }

        $results = [];
        foreach ($matched as $c) {
            $id = $c['Id'];
            $r = $this->callDockerApi('POST', "/containers/{$id}/start");
            $results[] = ['id' => $id, 'result' => $r];
        }

        return response()->json(['success' => true, 'results' => $results], 200);
    }

    public function stop(Request $request): JsonResponse
    {
        if ($this->dockerCliAvailable()) {
            $compose = $this->composeFileArg();
            $cmdParts = $this->resolveDockerCommand(['-f', $compose, 'down']);
            $result = $this->runProcess($cmdParts);
            return response()->json($result, $result['success'] ? 200 : 500);
        }

        $service = (string) config('whatsapp.docker.service_name', '');
        if (empty($service)) {
            return response()->json(['success' => false, 'error' => 'Docker CLI unavailable and no service_name configured for API fallback. Set WHATSAPP_GO_DOCKER_SERVICE or install Docker.'], 500);
        }

        $res = $this->callDockerApi('GET', '/containers/json?all=1');
        if (!($res['success'] ?? false)) {
            return response()->json($res, 500);
        }

        $containers = is_array($res['body']) ? $res['body'] : [];
        $matched = array_filter($containers, function ($c) use ($service) {
            $labels = $c['Labels'] ?? [];
            if (isset($labels['com.docker.compose.service']) && $labels['com.docker.compose.service'] === $service) return true;
            foreach ($c['Names'] ?? [] as $n) {
                if (str_contains($n, $service)) return true;
            }
            return false;
        });

        if (empty($matched)) {
            return response()->json(['success' => false, 'error' => 'No containers found matching service name for API fallback.'], 404);
        }

        $results = [];
        foreach ($matched as $c) {
            $id = $c['Id'];
            $r = $this->callDockerApi('POST', "/containers/{$id}/stop?t=10");
            $results[] = ['id' => $id, 'result' => $r];
        }

        return response()->json(['success' => true, 'results' => $results], 200);
    }

    public function restart(Request $request): JsonResponse
    {
        if ($this->dockerCliAvailable()) {
            $stop = $this->stop($request)->getData(true);
            if (! ($stop['success'] ?? false)) {
                Log::warning('Docker stop reported failure during restart', $stop);
            }
            $start = $this->start($request)->getData(true);
            $success = ($start['success'] ?? false);
            $code = $success ? 200 : 500;
            return response()->json($start, $code);
        }

        // API fallback: restart containers matching service
        $service = (string) config('whatsapp.docker.service_name', '');
        if (empty($service)) {
            return response()->json(['success' => false, 'error' => 'Docker CLI unavailable and no service_name configured for API fallback. Set WHATSAPP_GO_DOCKER_SERVICE or install Docker.'], 500);
        }

        $res = $this->callDockerApi('GET', '/containers/json?all=1');
        if (!($res['success'] ?? false)) {
            return response()->json($res, 500);
        }

        $containers = is_array($res['body']) ? $res['body'] : [];
        $matched = array_filter($containers, function ($c) use ($service) {
            $labels = $c['Labels'] ?? [];
            if (isset($labels['com.docker.compose.service']) && $labels['com.docker.compose.service'] === $service) return true;
            foreach ($c['Names'] ?? [] as $n) {
                if (str_contains($n, $service)) return true;
            }
            return false;
        });

        if (empty($matched)) {
            return response()->json(['success' => false, 'error' => 'No containers found matching service name for API fallback.'], 404);
        }

        $results = [];
        foreach ($matched as $c) {
            $id = $c['Id'];
            $r = $this->callDockerApi('POST', "/containers/{$id}/restart?t=10");
            $results[] = ['id' => $id, 'result' => $r];
        }

        return response()->json(['success' => true, 'results' => $results], 200);
    }

    public function status(Request $request): JsonResponse
    {
        if ($this->dockerCliAvailable()) {
            $compose = $this->composeFileArg();
            $cmdParts = $this->resolveDockerCommand(['-f', $compose, 'ps']);
            $result = $this->runProcess($cmdParts);
            return response()->json($result, 200);
        }

        $service = (string) config('whatsapp.docker.service_name', '');
        if (empty($service)) {
            return response()->json(['success' => false, 'error' => 'Docker CLI unavailable and no service_name configured for API fallback. Set WHATSAPP_GO_DOCKER_SERVICE or install Docker.'], 500);
        }

        $res = $this->callDockerApi('GET', '/containers/json?all=1');
        if (!($res['success'] ?? false)) {
            return response()->json($res, 500);
        }

        $containers = is_array($res['body']) ? $res['body'] : [];
        $matched = array_values(array_filter($containers, function ($c) use ($service) {
            $labels = $c['Labels'] ?? [];
            if (isset($labels['com.docker.compose.service']) && $labels['com.docker.compose.service'] === $service) return true;
            foreach ($c['Names'] ?? [] as $n) {
                if (str_contains($n, $service)) return true;
            }
            return false;
        }));

        $summary = array_map(function ($c) {
            return [
                'id' => $c['Id'],
                'names' => $c['Names'] ?? [],
                'image' => $c['Image'] ?? null,
                'state' => $c['State'] ?? null,
                'status' => $c['Status'] ?? null,
                'labels' => $c['Labels'] ?? [],
            ];
        }, $matched);

        return response()->json(['success' => true, 'containers' => $summary], 200);
    }

    // --- Local binary control (non-Docker) ---------------------------------
    public function localStart(Request $request): JsonResponse
    {
        $bin = $this->localBinaryPath();
        if (! file_exists($bin)) {
            return response()->json(['success' => false, 'error' => "Local binary not found: {$bin}"], 404);
        }

        try {
            if (str_starts_with(PHP_OS_FAMILY, 'Windows')) {
                $cmd = sprintf('start /B "" "%s" rest > NUL 2>&1', $bin);
            } else {
                $cmd = sprintf('nohup "%s" rest > /dev/null 2>&1 &', $bin);
            }

            Log::info('localStart executing', ['cmd' => $cmd]);
            $process = Process::fromShellCommandline($cmd);
            $process->setTimeout(10);
            $process->run();

            $result = [
                'success' => $process->isSuccessful(),
                'cmd' => $cmd,
                'output' => $process->getOutput(),
                'error' => $process->getErrorOutput(),
                'exit_code' => $process->getExitCode(),
            ];
            Log::info('localStart result', $result);
            return response()->json($result, $result['success'] ? 200 : 500);
        } catch (\Throwable $e) {
            Log::error('localStart failed', ['exception' => $e->getMessage()]);
            return response()->json(['success' => false, 'error' => $e->getMessage()], 500);
        }
    }

    public function localStop(Request $request): JsonResponse
    {
        $bin = $this->localBinaryPath();
        if (! file_exists($bin)) {
            return response()->json(['success' => false, 'error' => "Local binary not found: {$bin}"], 404);
        }

        try {
            if (str_starts_with(PHP_OS_FAMILY, 'Windows')) {
                $name = basename($bin);
                $cmd = sprintf('taskkill /IM "%s" /F', $name);
                Log::info('localStop executing', ['cmd' => $cmd]);
                $p = Process::fromShellCommandline($cmd);
                $p->setTimeout(10);
                $p->run();
                $res = [
                    'success' => $p->isSuccessful(),
                    'cmd' => $cmd,
                    'output' => $p->getOutput(),
                    'error' => $p->getErrorOutput(),
                    'exit_code' => $p->getExitCode(),
                ];
                Log::info('localStop result', $res);
                return response()->json($res, ($res['success'] ?? false) ? 200 : 500);
            }

            $name = basename($bin);
            $cmd = sprintf('pkill -f "%s rest" || true', $name);
            Log::info('localStop executing', ['cmd' => $cmd]);
            $p = Process::fromShellCommandline($cmd);
            $p->setTimeout(10);
            $p->run();
            $res = [
                'success' => $p->isSuccessful(),
                'cmd' => $cmd,
                'output' => $p->getOutput(),
                'error' => $p->getErrorOutput(),
                'exit_code' => $p->getExitCode(),
            ];
            Log::info('localStop result', $res);
            return response()->json($res, ($res['success'] ?? false) ? 200 : 500);
        } catch (\Throwable $e) {
            Log::error('localStop failed', ['exception' => $e->getMessage()]);
            return response()->json(['success' => false, 'error' => $e->getMessage()], 500);
        }
    }

    public function localStatus(Request $request): JsonResponse
    {
        $bin = $this->localBinaryPath();
        if (! file_exists($bin)) {
            return response()->json(['success' => false, 'error' => "Local binary not found: {$bin}"], 404);
        }

        try {
            if (str_starts_with(PHP_OS_FAMILY, 'Windows')) {
                $name = basename($bin);
                $cmd = sprintf('tasklist /FI "IMAGENAME eq %s"', $name);
                Log::info('localStatus executing', ['cmd' => $cmd]);
                $p = Process::fromShellCommandline($cmd);
                $p->setTimeout(5);
                $p->run();
                $out = $p->getOutput();
                $running = ! str_contains($out, 'No tasks are running');
                $res = ['success' => true, 'running' => $running, 'output' => $out, 'cmd' => $cmd, 'error' => $p->getErrorOutput(), 'exit_code' => $p->getExitCode()];
                Log::info('localStatus result', $res);
                return response()->json($res, 200);
            }

            $name = basename($bin);
            $cmd = sprintf('pgrep -fl "%s rest" || true', $name);
            Log::info('localStatus executing', ['cmd' => $cmd]);
            $p = Process::fromShellCommandline($cmd);
            $p->setTimeout(5);
            $p->run();
            $out = $p->getOutput();
            $running = trim($out) !== '';
            $res = ['success' => true, 'running' => $running, 'output' => $out, 'cmd' => $cmd, 'error' => $p->getErrorOutput(), 'exit_code' => $p->getExitCode()];
            Log::info('localStatus result', $res);
            return response()->json($res, 200);
        } catch (\Throwable $e) {
            Log::error('localStatus failed', ['exception' => $e->getMessage()]);
            return response()->json(['success' => false, 'error' => $e->getMessage()], 500);
        }
    }

    private function localBinaryPath(): string
    {
        $path = (string) config('whatsapp.local.binary_path', base_path('go-whatsapp-web-multidevice/src/whatsapp'));
        if (str_starts_with(PHP_OS_FAMILY, 'Windows') && ! str_ends_with($path, '.exe')) {
            $path .= '.exe';
        }

        return $path;
    }
}
