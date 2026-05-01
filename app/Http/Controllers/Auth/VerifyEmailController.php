<?php

namespace App\Http\Controllers\Auth;

use App\Http\Controllers\Controller;
use Illuminate\Auth\Events\Verified;
use Illuminate\Foundation\Auth\EmailVerificationRequest;
use Illuminate\Http\RedirectResponse;
use App\Http\Controllers\Concerns\RespondsWithJsonOrRedirect;

class VerifyEmailController extends Controller
{
    use RespondsWithJsonOrRedirect;
    /**
     * Mark the authenticated user's email address as verified.
     */
    public function __invoke(EmailVerificationRequest $request)
    {
        if ($request->user()->hasVerifiedEmail()) {
            return $this->jsonOrRedirect('dashboard', ['verified' => 1], 'Email sudah terverifikasi');
        }

        if ($request->user()->markEmailAsVerified()) {
            event(new Verified($request->user()));
        }

        return $this->jsonOrRedirect('dashboard', ['verified' => 1], 'Email berhasil diverifikasi');
    }
}
