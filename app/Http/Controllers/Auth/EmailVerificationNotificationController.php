<?php

namespace App\Http\Controllers\Auth;

use App\Http\Controllers\Controller;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use App\Http\Controllers\Concerns\RespondsWithJsonOrRedirect;

class EmailVerificationNotificationController extends Controller
{
    use RespondsWithJsonOrRedirect;
    /**
     * Send a new email verification notification.
     */
    public function store(Request $request)
    {
        if ($request->user()->hasVerifiedEmail()) {
            return $this->jsonOrRedirect('dashboard', [], 'Email sudah terverifikasi');
        }

        $request->user()->sendEmailVerificationNotification();

        return $this->jsonOrRedirect(null, [], 'verification-link-sent');
    }
}
