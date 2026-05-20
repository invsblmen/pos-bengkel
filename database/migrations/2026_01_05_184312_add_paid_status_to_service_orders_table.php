<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        // Modify status enum to include 'paid' for MySQL/MariaDB only
        $driver = Schema::getConnection()->getDriverName();
        if (in_array($driver, ['mysql', 'mariadb'])) {
            if (DB::getDriverName() !== 'sqlite') {
                DB::statement("ALTER TABLE service_orders MODIFY COLUMN status ENUM('pending', 'in_progress', 'completed', 'paid', 'cancelled') DEFAULT 'pending'");
            }
        }
        // For sqlite and other drivers used in testing, skip altering enum to avoid unsupported SQL
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        // Revert to original enum values for MySQL/MariaDB only
        $driver = Schema::getConnection()->getDriverName();
        if (in_array($driver, ['mysql', 'mariadb'])) {
            if (DB::getDriverName() !== 'sqlite') {
                DB::statement("ALTER TABLE service_orders MODIFY COLUMN status ENUM('pending', 'in_progress', 'completed', 'cancelled') DEFAULT 'pending'");
            }
        }
    }
};
