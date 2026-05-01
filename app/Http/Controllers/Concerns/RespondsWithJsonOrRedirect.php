<?php

namespace App\Http\Controllers\Concerns;

trait RespondsWithJsonOrRedirect
{
    /**
     * Return JSON when request expects JSON, otherwise redirect/back with flash.
     *
     * @param string|null $routeName
     * @param array $routeParams
     * @param string|null $message
     * @param mixed|null $data
     * @param int $status
     * @param string $flashType
     * @return \Illuminate\Http\RedirectResponse|\Illuminate\Http\JsonResponse
     */
    protected function jsonOrRedirect(?string $routeName = null, array $routeParams = [], ?string $message = null, $data = null, int $status = 200, string $flashType = 'success')
    {
        // If this is an Inertia request, prefer redirects/Inertia responses
        // instead of returning plain JSON (Inertia expects an Inertia response).
        $isInertia = request()->header('X-Inertia') !== null;

        if (!$isInertia && (request()->expectsJson() || request()->ajax() || request()->wantsJson())) {
            $payload = ['success' => true];
            if ($message !== null) {
                $payload['message'] = $message;
            }
            if ($data !== null) {
                $payload['data'] = $data;
            }

            return response()->json($payload, $status);
        }

        if ($routeName) {
            try {
                if (\Illuminate\Support\Facades\Route::has($routeName)) {
                    $redirect = redirect()->route($routeName, $routeParams)->with($flashType, $message);
                } else {
                    $redirect = redirect($routeName)->with($flashType, $message);
                }
            } catch (\Throwable $e) {
                // Fallback to URL redirect if named route resolution fails
                $redirect = redirect($routeName)->with($flashType, $message);
            }

            if ($data !== null) {
                $redirect = $redirect->with('flash', $data);
            }

            return $redirect;
        }

        return back()->with($flashType, $message);
    }

    /**
     * Error response for JSON or redirect/back with validation errors.
     *
     * @param string $message
     * @param array $errors
     * @param int $status
     * @return \Illuminate\Http\JsonResponse|\Illuminate\Http\RedirectResponse
     */
    protected function errorResponse(string $message = 'Error', array $errors = [], int $status = 422)
    {
        $isInertia = request()->header('X-Inertia') !== null;

        if (!$isInertia && (request()->expectsJson() || request()->ajax() || request()->wantsJson())) {
            return response()->json([
                'success' => false,
                'message' => $message,
                'errors' => $errors,
            ], $status);
        }

        if (!empty($errors)) {
            throw \Illuminate\Validation\ValidationException::withMessages($errors);
        }

        return back()->with('error', $message);
    }
}
