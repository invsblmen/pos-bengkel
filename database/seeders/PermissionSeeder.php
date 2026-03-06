<?php

namespace Database\Seeders;

use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;
use Spatie\Permission\Models\Permission;

class PermissionSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        $permissions = [
            // dashboard
            'dashboard-access',

            // users
            'users-access', 'users-create', 'users-update', 'users-delete',

            // roles
            'roles-access', 'roles-create', 'roles-update', 'roles-delete',

            // permissions
            'permissions-access', 'permissions-create', 'permissions-update', 'permissions-delete',

            // customers
            'customers-access', 'customers-create', 'customers-edit', 'customers-delete',

            // reports
            'reports-access',

            // payment settings
            'payment-settings-access',

            // vehicles
            'vehicles-access', 'vehicles-create', 'vehicles-edit', 'vehicles-delete',

            // service categories
            'service-categories-access', 'service-categories-create', 'service-categories-edit', 'service-categories-delete',

            // part categories
            'part-categories-access', 'part-categories-create', 'part-categories-edit', 'part-categories-delete',

            // services
            'services-access', 'services-create', 'services-edit', 'services-delete',

            // service orders
            'service-orders-access', 'service-orders-create', 'service-orders-update', 'service-orders-delete',

            // appointments
            'appointments-access', 'appointments-create', 'appointments-update', 'appointments-delete',

            // mechanics
            'mechanics-access', 'mechanics-create', 'mechanics-update', 'mechanics-delete',

            // parts
            'parts-access', 'parts-create', 'parts-update', 'parts-delete',

            // part purchases
            'part-purchases-access', 'part-purchases-create', 'part-purchases-update', 'part-purchases-delete',

            // part sales
            'part-sales-access', 'part-sales-create', 'part-sales-show', 'part-sales-edit', 'part-sales-delete',

            // part sales orders
            'part-sales-orders-access', 'part-sales-orders-create', 'part-sales-orders-update', 'part-sales-orders-delete',

            // part purchase orders
            'part-purchase-orders-access', 'part-purchase-orders-create', 'part-purchase-orders-update', 'part-purchase-orders-delete',

            // part stock history
            'part-stock-history-access', 'parts-stock-access', 'parts-stock-in', 'parts-stock-out',

            // suppliers
            'suppliers-access', 'suppliers-create', 'suppliers-update', 'suppliers-delete',

            // cash management
            'cash-management-access', 'cash-management-manage',
        ];

        foreach ($permissions as $permission) {
            Permission::firstOrCreate(
                ['name' => $permission, 'guard_name' => 'web']
            );
        }
    }
}
