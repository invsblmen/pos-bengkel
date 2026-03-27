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
        $permission = 'part-sales-warranty-claim';

        Permission::firstOrCreate([
            'name' => $permission,
            'guard_name' => 'web',
        ]);

        $superAdmin = Role::where('name', 'super-admin')->first();
        if ($superAdmin) {
            $superAdmin->givePermissionTo([$permission]);
        }

        $admin = Role::where('name', 'admin')->first();
        if ($admin) {
            $admin->givePermissionTo([$permission]);
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        $permission = 'part-sales-warranty-claim';

        $superAdmin = Role::where('name', 'super-admin')->first();
        if ($superAdmin) {
            $superAdmin->revokePermissionTo([$permission]);
        }

        $admin = Role::where('name', 'admin')->first();
        if ($admin) {
            $admin->revokePermissionTo([$permission]);
        }

        Permission::where('name', $permission)->delete();
    }
};
