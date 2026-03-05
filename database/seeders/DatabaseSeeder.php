<?php

namespace Database\Seeders;

use App\Models\User;
// use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;

class DatabaseSeeder extends Seeder
{
    /**
     * Seed the application's database.
     */
    public function run(): void
    {
        $this->call([
            PermissionSeeder::class,
            AddMissingPermissionsSeeder::class,
            \Database\Seeders\AddPartPermissionsSeeder::class,
            \Database\Seeders\AddPartStockPermissionsSeeder::class,
            RoleSeeder::class,
            UserSeeder::class,
            PaymentSettingSeeder::class,
            BusinessProfileSeeder::class,
            WorkshopSeeder::class,  // Run WorkshopSeeder BEFORE SampleDataSeeder so customers aren't truncated
            SampleDataSeeder::class,
            SupplierSeeder::class,
            ServiceCategorySeeder::class,
            PartCategorySeeder::class,
            PartSeeder::class,
            VehicleSeeder::class,
        ]);
    }
}
