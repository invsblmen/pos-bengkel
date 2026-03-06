<?php
namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\Models\Role;

class RoleSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        $superRole = Role::firstOrCreate(['name' => 'super-admin']);
        $superRole->givePermissionTo(Permission::all());

        $cashierRole = Role::firstOrCreate(['name' => 'cashier']);
        $cashierPermissions = Permission::whereIn('name', [
            'dashboard-access',
            'customers-access',
            'customers-create',
            'service-orders-access',
            'service-orders-create',
            'service-orders-update',
            'part-sales-access',
            'part-sales-create',
            'part-sales-show',
            'part-sales-edit',
            'cash-management-access',
            'cash-management-manage',
        ])->get();
        $cashierRole->givePermissionTo($cashierPermissions);
    }
}
