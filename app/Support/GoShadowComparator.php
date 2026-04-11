<?php

namespace App\Support;

use Illuminate\Support\Facades\Log;
use Throwable;

class GoShadowComparator
{
    public static function compareAndLog(
        string $feature,
        array $laravelPayload,
        ?array $goPayload,
        array $ignorePaths = [],
        ?string $requestId = null,
        array $context = []
    ): void {
        if ($goPayload === null) {
            Log::warning('Go shadow compare skipped because Go payload is unavailable.', array_merge([
                'feature' => $feature,
                'request_id' => $requestId,
            ], $context));

            return;
        }

        try {
            $left = self::normalize($laravelPayload, '', $ignorePaths);
            $right = self::normalize($goPayload, '', $ignorePaths);

            $leftJson = json_encode($left, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
            $rightJson = json_encode($right, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);

            if ($leftJson === false || $rightJson === false) {
                Log::warning('Go shadow compare failed to encode payload.', array_merge([
                    'feature' => $feature,
                    'request_id' => $requestId,
                ], $context));

                return;
            }

            if ($leftJson !== $rightJson) {
                Log::warning('Go shadow compare mismatch detected.', array_merge([
                    'feature' => $feature,
                    'request_id' => $requestId,
                    'laravel_hash' => sha1($leftJson),
                    'go_hash' => sha1($rightJson),
                    'laravel_size' => strlen($leftJson),
                    'go_size' => strlen($rightJson),
                    'laravel_only_top_keys' => array_values(array_diff(array_keys($left), array_keys($right))),
                    'go_only_top_keys' => array_values(array_diff(array_keys($right), array_keys($left))),
                    'sample_diff_paths' => self::sampleDiffPaths($left, $right, 20),
                ], $context));

                return;
            }

            Log::info('Go shadow compare matched.', array_merge([
                'feature' => $feature,
                'request_id' => $requestId,
                'hash' => sha1($leftJson),
            ], $context));
        } catch (Throwable $e) {
            Log::warning('Go shadow compare failed unexpectedly.', array_merge([
                'feature' => $feature,
                'request_id' => $requestId,
                'error' => $e->getMessage(),
            ], $context));
        }
    }

    private static function normalize(mixed $value, string $path, array $ignorePaths): mixed
    {
        if (self::isIgnoredPath($path, $ignorePaths)) {
            return null;
        }

        if (! is_array($value)) {
            return $value;
        }

        if (! self::isAssoc($value)) {
            $normalized = [];
            foreach ($value as $index => $item) {
                $itemPath = $path === '' ? (string) $index : $path . '.' . $index;
                $normalized[] = self::normalize($item, $itemPath, $ignorePaths);
            }

            return $normalized;
        }

        ksort($value);
        $normalized = [];
        foreach ($value as $key => $item) {
            $itemPath = $path === '' ? (string) $key : $path . '.' . $key;
            if (self::isIgnoredPath($itemPath, $ignorePaths)) {
                continue;
            }

            $normalized[$key] = self::normalize($item, $itemPath, $ignorePaths);
        }

        return $normalized;
    }

    private static function isIgnoredPath(string $path, array $ignorePaths): bool
    {
        if ($path === '') {
            return false;
        }

        foreach ($ignorePaths as $pattern) {
            if ($pattern === '') {
                continue;
            }

            if (fnmatch($pattern, $path)) {
                return true;
            }
        }

        return false;
    }

    private static function isAssoc(array $array): bool
    {
        return array_keys($array) !== range(0, count($array) - 1);
    }

    private static function sampleDiffPaths(mixed $left, mixed $right, int $limit = 20): array
    {
        $paths = [];
        self::collectDiffPaths($left, $right, '', max(1, $limit), $paths);

        return $paths;
    }

    private static function collectDiffPaths(mixed $left, mixed $right, string $path, int $limit, array &$paths): void
    {
        if (count($paths) >= $limit) {
            return;
        }

        if (is_array($left) && is_array($right)) {
            if (! self::isAssoc($left) && ! self::isAssoc($right)) {
                if (count($left) !== count($right)) {
                    $paths[] = ($path === '' ? 'root' : $path) . '.length';
                    if (count($paths) >= $limit) {
                        return;
                    }
                }

                $max = max(count($left), count($right));
                for ($i = 0; $i < $max; $i++) {
                    $nextPath = $path === '' ? (string) $i : $path . '.' . $i;
                    $leftExists = array_key_exists($i, $left);
                    $rightExists = array_key_exists($i, $right);

                    if (! $leftExists || ! $rightExists) {
                        $paths[] = $nextPath;
                        if (count($paths) >= $limit) {
                            return;
                        }

                        continue;
                    }

                    self::collectDiffPaths($left[$i], $right[$i], $nextPath, $limit, $paths);
                    if (count($paths) >= $limit) {
                        return;
                    }
                }

                return;
            }

            $keys = array_values(array_unique(array_merge(array_keys($left), array_keys($right))));
            sort($keys);

            foreach ($keys as $key) {
                $nextPath = $path === '' ? (string) $key : $path . '.' . $key;
                $leftExists = array_key_exists($key, $left);
                $rightExists = array_key_exists($key, $right);

                if (! $leftExists || ! $rightExists) {
                    $paths[] = $nextPath;
                    if (count($paths) >= $limit) {
                        return;
                    }

                    continue;
                }

                self::collectDiffPaths($left[$key], $right[$key], $nextPath, $limit, $paths);
                if (count($paths) >= $limit) {
                    return;
                }
            }

            return;
        }

        if ($left !== $right) {
            $paths[] = $path === '' ? 'root' : $path;
        }
    }
}
