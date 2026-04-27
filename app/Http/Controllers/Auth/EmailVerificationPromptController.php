<?php

namespace App\Http\Controllers\Auth;

use App\Http\Controllers\Controller;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;
use App\Http\Controllers\Concerns\RespondsWithJsonOrRedirect;

class EmailVerificationPromptController extends Controller
{
    use RespondsWithJsonOrRedirect;
    /**
     * Display the email verification prompt.
     */
    public function __invoke(Request $request)
    {
        return $request->user()->hasVerifiedEmail()
                    ? $this->jsonOrRedirect('dashboard', [], 'Email sudah terverifikasi')
                    : Inertia::render('Auth/VerifyEmail', ['status' => session('status')]);
    }
}
