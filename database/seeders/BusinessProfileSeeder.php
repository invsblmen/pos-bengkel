<?php

namespace Database\Seeders;

use App\Models\BusinessProfile;
use Illuminate\Database\Seeder;

class BusinessProfileSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        BusinessProfile::firstOrCreate([], [
            'business_name' => 'Nama Usaha Anda',
            'business_phone' => null,
            'business_address' => null,
            'facebook' => null,
            'instagram' => null,
            'tiktok' => null,
            'google_my_business' => null,
            'website' => null,
        ]);
    }
}
