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
            AddVoucherPermissionsSeeder::class,
            AddMissingPermissionsSeeder::class,
            \Database\Seeders\AddPartPermissionsSeeder::class,
            \Database\Seeders\AddPartStockPermissionsSeeder::class,
            RoleSeeder::class,
            FixVoucherPermissionForCashierSeeder::class,
            UserSeeder::class,
            PaymentSettingSeeder::class,
            BusinessProfileSeeder::class,
            WorkshopSeeder::class,
            SupplierSeeder::class,
            ServiceCategorySeeder::class,
            PartCategorySeeder::class,
            PartSeeder::class,
            VehicleSeeder::class,
        ]);
    }
}
