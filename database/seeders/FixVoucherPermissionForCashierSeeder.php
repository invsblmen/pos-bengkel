<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\Models\Role;
use Spatie\Permission\PermissionRegistrar;

class FixVoucherPermissionForCashierSeeder extends Seeder
{
    public function run(): void
    {
        app(PermissionRegistrar::class)->forgetCachedPermissions();

        $permissions = [
            'vouchers-access',
            'vouchers-create',
            'vouchers-edit',
            'vouchers-delete',
        ];

        // Ensure permissions exist
        foreach ($permissions as $permission) {
            Permission::firstOrCreate([
                'name' => $permission,
                'guard_name' => 'web',
            ]);
        }

        // Grant vouchers-access to cashier role (they need this to see the menu button)
        $cashierRole = Role::where('name', 'cashier')->first();
        if ($cashierRole) {
            $cashierRole->givePermissionTo('vouchers-access');
            $this->command->info('✅ Vouchers-access permission granted to cashier role');
        } else {
            $this->command->warn('⚠️ Cashier role not found');
        }

        app(PermissionRegistrar::class)->forgetCachedPermissions();
    }
}
