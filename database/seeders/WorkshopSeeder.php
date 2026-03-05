<?php

namespace Database\Seeders;

use App\Models\Mechanic;
use App\Models\Service;
use App\Models\Part;
use App\Models\Vehicle;
use App\Models\Customer;
use Illuminate\Database\Seeder;

class WorkshopSeeder extends Seeder
{
    public function run()
    {
        // Create sample customers first
        $customers = [
            ['name' => 'Budi Santoso', 'phone' => '081234567890', 'email' => 'budi@email.com', 'address' => 'Jl. Merdeka No. 10'],
            ['name' => 'Siti Nurhaliza', 'phone' => '082345678901', 'email' => 'siti@email.com', 'address' => 'Jl. Gatot Subroto No. 25'],
            ['name' => 'Ahmad Wijaya', 'phone' => '083456789012', 'email' => 'ahmad@email.com', 'address' => 'Jl. Sudirman No. 42'],
            ['name' => 'Rina Kusuma', 'phone' => '084567890123', 'email' => 'rina@email.com', 'address' => 'Jl. Ahmad Yani No. 18'],
            ['name' => 'Wawan Hermawan', 'phone' => '085678901234', 'email' => 'wawan@email.com', 'address' => 'Jl. Diponegoro No. 7'],
        ];

        foreach ($customers as $customerData) {
            Customer::firstOrCreate(['phone' => $customerData['phone']], $customerData);
        }

        // Mechanics
        Mechanic::firstOrCreate(['employee_number' => 'M-001'], ['name' => 'Budi', 'phone' => '0811111111']);
        Mechanic::firstOrCreate(['employee_number' => 'M-002'], ['name' => 'Andi', 'phone' => '0822222222']);

        // Services
        Service::firstOrCreate(['code' => 'SVC-OLI'], ['title' => 'Ganti Oli', 'description' => 'Ganti oli mesin', 'est_time_minutes' => 30, 'price' => 50000]);
        Service::firstOrCreate(['code' => 'SVC-TUNE'], ['title' => 'Tune-Up', 'description' => 'Tune-up mesin', 'est_time_minutes' => 60, 'price' => 100000]);

        // Parts
        Part::firstOrCreate(['part_number' => 'OIL-0001'], ['name' => 'Oli 1L', 'stock' => 50, 'minimal_stock' => 15, 'rack_location' => 'B1']);
        Part::firstOrCreate(['part_number' => 'BRK-0006'], ['name' => 'Kampas Rem', 'stock' => 20, 'minimal_stock' => 6, 'rack_location' => 'F5']);

        // Vehicles - sample for existing customers
        $customer = Customer::first();
        if ($customer) {
            Vehicle::firstOrCreate(['plate_number' => 'B 1234 AB'], ['customer_id' => $customer->id, 'brand' => 'Yamaha', 'model' => 'Vixion', 'year' => 2019]);
        }
    }
}
