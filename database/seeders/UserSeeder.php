<?php

namespace Database\Seeders;

use App\Models\User;
use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\Models\Role;

class UserSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        $user = User::firstOrCreate(
            ['email' => 'arya@gmail.com'],
            ['name' => 'Arya Dwi Putra', 'password' => bcrypt('password')]
        );

        // get admin role
        $role = Role::where('name', 'super-admin')->first();

        // get all permissions
        $permissions = Permission::all();

        // assign role to user
        $user->syncPermissions($permissions);

        // assign a role to user
        $user->assignRole($role);

        $cashier = User::firstOrCreate(
            ['email' => 'cashier@gmail.com'],
            ['name' => 'Cashier', 'password' => bcrypt('password')]
        );

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

        $cashier->syncPermissions($cashierPermissions);
    }
}
