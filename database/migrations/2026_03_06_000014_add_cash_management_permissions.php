<?php

use Illuminate\Database\Migrations\Migration;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\Models\Role;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        $permissions = [
            'cash-management-access',
            'cash-management-manage',
        ];

        foreach ($permissions as $permissionName) {
            Permission::firstOrCreate([
                'name' => $permissionName,
                'guard_name' => 'web',
            ]);
        }

        $superAdmin = Role::where('name', 'super-admin')->first();
        if ($superAdmin) {
            $superAdmin->givePermissionTo($permissions);
        }

        $cashier = Role::where('name', 'cashier')->first();
        if ($cashier) {
            $cashier->givePermissionTo([
                'cash-management-access',
                'cash-management-manage',
            ]);
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        $permissions = [
            'cash-management-manage',
            'cash-management-access',
        ];

        $superAdmin = Role::where('name', 'super-admin')->first();
        if ($superAdmin) {
            $superAdmin->revokePermissionTo($permissions);
        }

        $cashier = Role::where('name', 'cashier')->first();
        if ($cashier) {
            $cashier->revokePermissionTo($permissions);
        }

        Permission::whereIn('name', $permissions)->delete();
    }
};
