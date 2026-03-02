<?php

namespace App\Http\Controllers\Apps;

use App\Http\Controllers\Controller;
use App\Models\BusinessProfile;
use Illuminate\Http\Request;
use Inertia\Inertia;

class BusinessProfileController extends Controller
{
    public function edit()
    {
        $profile = BusinessProfile::firstOrCreate([], [
            'business_name' => 'Nama Usaha Anda',
            'business_phone' => null,
            'business_address' => null,
            'facebook' => null,
            'instagram' => null,
            'tiktok' => null,
            'google_my_business' => null,
            'website' => null,
        ]);

        return Inertia::render('Dashboard/Settings/BusinessProfile', [
            'profile' => $profile,
        ]);
    }

    public function update(Request $request)
    {
        $profile = BusinessProfile::firstOrCreate([], [
            'business_name' => 'Nama Usaha Anda',
            'business_phone' => null,
            'business_address' => null,
            'facebook' => null,
            'instagram' => null,
            'tiktok' => null,
            'google_my_business' => null,
            'website' => null,
        ]);

        $data = $request->validate([
            'business_name' => ['required', 'string', 'max:120'],
            'business_phone' => ['nullable', 'string', 'max:30'],
            'business_address' => ['nullable', 'string', 'max:500'],
            'facebook' => ['nullable', 'string', 'max:120'],
            'instagram' => ['nullable', 'string', 'max:120'],
            'tiktok' => ['nullable', 'string', 'max:120'],
            'google_my_business' => ['nullable', 'string', 'max:200'],
            'website' => ['nullable', 'string', 'max:200'],
        ]);

        $profile->update($data);

        return redirect()
            ->route('settings.business-profile.edit')
            ->with('success', 'Profil bisnis berhasil disimpan.');
    }
}
