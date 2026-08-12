<?php

namespace Database\Seeders;

use App\Models\Part;
use App\Models\PartCategory;
use App\Models\Supplier;
use Illuminate\Database\Seeder;

class PartSeeder extends Seeder
{
    public function run(): void
    {
        $suppliers = Supplier::all();
        if ($suppliers->isEmpty()) {
            return;
        }

        $parts = [
            // Engine Parts
            [
                'name' => 'Spark Plug',
                'part_number' => 'ENG-0001',
                'description' => 'Busi motor standar',
                'category' => 'Engine Parts',
                'stock' => 50,
                'minimal_stock' => 15,
                'rack_location' => 'A1',
            ],
            [
                'name' => 'Engine Oil SAE 10W-30',
                'part_number' => 'ENG-0002',
                'description' => 'Oli mesin berkualitas premium 1 liter',
                'category' => 'Filters & Fluids',
                'stock' => 80,
                'minimal_stock' => 25,
                'rack_location' => 'B2',
            ],
            [
                'name' => 'Oil Filter',
                'part_number' => 'ENG-0003',
                'description' => 'Filter oli motor standar',
                'category' => 'Filters & Fluids',
                'stock' => 60,
                'minimal_stock' => 20,
                'rack_location' => 'B3',
            ],
            [
                'name' => 'Air Filter',
                'part_number' => 'ENG-0004',
                'description' => 'Filter udara motor standar',
                'category' => 'Filters & Fluids',
                'stock' => 45,
                'minimal_stock' => 15,
                'rack_location' => 'B4',
            ],
            [
                'name' => 'Piston Kit',
                'part_number' => 'ENG-0005',
                'description' => 'Set piston dengan ring standar',
                'category' => 'Engine Parts',
                'stock' => 12,
                'minimal_stock' => 3,
                'rack_location' => 'C1',
            ],
            [
                'name' => 'Valve Set',
                'part_number' => 'ENG-0006',
                'description' => 'Set katup intake dan exhaust',
                'category' => 'Engine Parts',
                'stock' => 10,
                'minimal_stock' => 3,
                'rack_location' => 'C2',
            ],
            [
                'name' => 'Gasket Set',
                'part_number' => 'ENG-0007',
                'description' => 'Set gasket mesin lengkap',
                'category' => 'Engine Parts',
                'stock' => 15,
                'minimal_stock' => 5,
                'rack_location' => 'C3',
            ],

            // Transmission & Clutch
            [
                'name' => 'Clutch Plate',
                'part_number' => 'TRN-0001',
                'description' => 'Plat kopling standar',
                'category' => 'Transmission & Clutch',
                'stock' => 25,
                'minimal_stock' => 8,
                'rack_location' => 'D1',
            ],
            [
                'name' => 'Clutch Springs',
                'part_number' => 'TRN-0002',
                'description' => 'Per kopling set',
                'category' => 'Transmission & Clutch',
                'stock' => 30,
                'minimal_stock' => 10,
                'rack_location' => 'D2',
            ],
            [
                'name' => 'Transmission Fluid',
                'part_number' => 'TRN-0003',
                'description' => 'Oli transmisi motor 1 liter',
                'category' => 'Filters & Fluids',
                'stock' => 40,
                'minimal_stock' => 15,
                'rack_location' => 'B5',
            ],

            // Electrical Parts
            [
                'name' => 'Battery 12V 5AH',
                'part_number' => 'ELC-0001',
                'description' => 'Aki motor 12 Volt 5 AH',
                'category' => 'Electrical Parts',
                'stock' => 18,
                'minimal_stock' => 5,
                'rack_location' => 'E1',
            ],
            [
                'name' => 'Alternator',
                'part_number' => 'ELC-0002',
                'description' => 'Altenator penghasil listrik',
                'category' => 'Electrical Parts',
                'stock' => 8,
                'minimal_stock' => 2,
                'rack_location' => 'E2',
            ],
            [
                'name' => 'Starter Motor',
                'part_number' => 'ELC-0003',
                'description' => 'Motor starter standar',
                'category' => 'Electrical Parts',
                'stock' => 10,
                'minimal_stock' => 3,
                'rack_location' => 'E3',
            ],
            [
                'name' => 'Ignition Coil',
                'part_number' => 'ELC-0004',
                'description' => 'Koil pengapian',
                'category' => 'Electrical Parts',
                'stock' => 35,
                'minimal_stock' => 10,
                'rack_location' => 'E4',
            ],
            [
                'name' => 'Wiring Harness',
                'part_number' => 'ELC-0005',
                'description' => 'Kabel sistem kelistrikan',
                'category' => 'Electrical Parts',
                'stock' => 20,
                'minimal_stock' => 6,
                'rack_location' => 'E5',
            ],

            // Brake Parts
            [
                'name' => 'Brake Pad (Front)',
                'part_number' => 'BRK-0001',
                'description' => 'Kampas rem depan standar',
                'category' => 'Brake Parts',
                'stock' => 70,
                'minimal_stock' => 20,
                'rack_location' => 'F1',
            ],
            [
                'name' => 'Brake Pad (Rear)',
                'part_number' => 'BRK-0002',
                'description' => 'Kampas rem belakang standar',
                'category' => 'Brake Parts',
                'stock' => 75,
                'minimal_stock' => 20,
                'rack_location' => 'F2',
            ],
            [
                'name' => 'Brake Disc (Front)',
                'part_number' => 'BRK-0003',
                'description' => 'Piringan rem depan',
                'category' => 'Brake Parts',
                'stock' => 25,
                'minimal_stock' => 8,
                'rack_location' => 'F3',
            ],
            [
                'name' => 'Brake Disc (Rear)',
                'part_number' => 'BRK-0004',
                'description' => 'Piringan rem belakang',
                'category' => 'Brake Parts',
                'stock' => 20,
                'minimal_stock' => 6,
                'rack_location' => 'F4',
            ],
            [
                'name' => 'Brake Fluid DOT 4',
                'part_number' => 'BRK-0005',
                'description' => 'Minyak rem 500ml',
                'category' => 'Filters & Fluids',
                'stock' => 55,
                'minimal_stock' => 15,
                'rack_location' => 'B6',
            ],

            // Suspension Parts
            [
                'name' => 'Front Shock Absorber',
                'part_number' => 'SUS-0001',
                'description' => 'Peredam kejut depan standar',
                'category' => 'Suspension Parts',
                'stock' => 15,
                'minimal_stock' => 4,
                'rack_location' => 'G1',
            ],
            [
                'name' => 'Rear Shock Absorber',
                'part_number' => 'SUS-0002',
                'description' => 'Peredam kejut belakang standar',
                'category' => 'Suspension Parts',
                'stock' => 18,
                'minimal_stock' => 5,
                'rack_location' => 'G2',
            ],
            [
                'name' => 'Fork Seal',
                'part_number' => 'SUS-0003',
                'description' => 'Seal garpu depan',
                'category' => 'Suspension Parts',
                'stock' => 40,
                'minimal_stock' => 12,
                'rack_location' => 'G3',
            ],
            [
                'name' => 'Suspension Spring',
                'part_number' => 'SUS-0004',
                'description' => 'Per suspensi belakang',
                'category' => 'Suspension Parts',
                'stock' => 30,
                'minimal_stock' => 10,
                'rack_location' => 'G4',
            ],

            // Wheel & Tire
            [
                'name' => 'Motorcycle Tire 80/90-17',
                'part_number' => 'WHE-0001',
                'description' => 'Ban motor ukuran 80/90-17',
                'category' => 'Wheel & Tire',
                'stock' => 22,
                'minimal_stock' => 8,
                'rack_location' => 'H1',
            ],
            [
                'name' => 'Motorcycle Tire 90/90-18',
                'part_number' => 'WHE-0002',
                'description' => 'Ban motor ukuran 90/90-18',
                'category' => 'Wheel & Tire',
                'stock' => 20,
                'minimal_stock' => 7,
                'rack_location' => 'H2',
            ],
            [
                'name' => 'Wheel Hub (Front)',
                'part_number' => 'WHE-0003',
                'description' => 'Naf roda depan',
                'category' => 'Wheel & Tire',
                'stock' => 8,
                'minimal_stock' => 2,
                'rack_location' => 'H3',
            ],
            [
                'name' => 'Wheel Hub (Rear)',
                'part_number' => 'WHE-0004',
                'description' => 'Naf roda belakang',
                'category' => 'Wheel & Tire',
                'stock' => 6,
                'minimal_stock' => 2,
                'rack_location' => 'H4',
            ],
            [
                'name' => 'Inner Tube 80/90-17',
                'part_number' => 'WHE-0005',
                'description' => 'Ban dalam ukuran 80/90-17',
                'category' => 'Wheel & Tire',
                'stock' => 50,
                'minimal_stock' => 15,
                'rack_location' => 'H5',
            ],

            // Fasteners & Hardware
            [
                'name' => 'Bolt Set M6',
                'part_number' => 'FAS-0001',
                'description' => 'Set baut M6 berbagai panjang (25 pcs)',
                'category' => 'Fasteners & Hardware',
                'stock' => 100,
                'minimal_stock' => 30,
                'rack_location' => 'I1',
            ],
            [
                'name' => 'Bolt Set M8',
                'part_number' => 'FAS-0002',
                'description' => 'Set baut M8 berbagai panjang (20 pcs)',
                'category' => 'Fasteners & Hardware',
                'stock' => 90,
                'minimal_stock' => 25,
                'rack_location' => 'I2',
            ],
            [
                'name' => 'Nut Set',
                'part_number' => 'FAS-0003',
                'description' => 'Set mur berbagai ukuran (30 pcs)',
                'category' => 'Fasteners & Hardware',
                'stock' => 120,
                'minimal_stock' => 35,
                'rack_location' => 'I3',
            ],
            [
                'name' => 'Washer Set',
                'part_number' => 'FAS-0004',
                'description' => 'Set ring penahan berbagai ukuran (50 pcs)',
                'category' => 'Fasteners & Hardware',
                'stock' => 150,
                'minimal_stock' => 50,
                'rack_location' => 'I4',
            ],

            // Accessories
            [
                'name' => 'Handle Bar Grip',
                'part_number' => 'ACC-0001',
                'description' => 'Grip handel gas dan rem',
                'category' => 'Accessories',
                'stock' => 60,
                'minimal_stock' => 20,
                'rack_location' => 'J1',
            ],
            [
                'name' => 'Fuel Filter',
                'part_number' => 'ACC-0002',
                'description' => 'Filter bensin standar',
                'category' => 'Filters & Fluids',
                'stock' => 55,
                'minimal_stock' => 15,
                'rack_location' => 'B7',
            ],
            [
                'name' => 'Speedometer Cable',
                'part_number' => 'ACC-0003',
                'description' => 'Kabel speedometer motor',
                'category' => 'Accessories',
                'stock' => 35,
                'minimal_stock' => 10,
                'rack_location' => 'J2',
            ],
            [
                'name' => 'Throttle Cable',
                'part_number' => 'ACC-0004',
                'description' => 'Kabel gas standar',
                'category' => 'Accessories',
                'stock' => 45,
                'minimal_stock' => 12,
                'rack_location' => 'J3',
            ],
            [
                'name' => 'Coolant Radiator',
                'part_number' => 'ACC-0005',
                'description' => 'Cairan pendingin radiator 1 liter',
                'category' => 'Filters & Fluids',
                'stock' => 40,
                'minimal_stock' => 12,
                'rack_location' => 'B8',
            ],
        ];

        // Get category IDs
        $categoryMap = [];
        $categories = PartCategory::all();
        foreach ($categories as $category) {
            $categoryMap[$category->name] = $category->id;
        }

        // Create parts (use firstOrCreate to avoid duplicate unique keys)
        foreach ($parts as $part) {
            $categoryId = $categoryMap[$part['category']] ?? null;
            $supplierId = $suppliers->random()->id;
            $buyPrice = $part['buy_price'] ?? random_int(15000, 60000);
            $sellPrice = $part['sell_price'] ?? ($buyPrice + random_int(5000, 25000));

            Part::firstOrCreate(
                ['part_number' => $part['part_number']],
                [
                    'name' => $part['name'],
                    'description' => $part['description'],
                    'part_category_id' => $categoryId,
                    'buy_price' => $buyPrice,
                    'sell_price' => $sellPrice,
                    'stock' => $part['stock'],
                    'minimal_stock' => $part['minimal_stock'],
                    'rack_location' => $part['rack_location'],
                    'supplier_id' => $supplierId,
                ]
            );
        }
    }
}

