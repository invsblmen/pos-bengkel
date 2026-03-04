<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('services', function (Blueprint $table) {
            if (!Schema::hasColumn('services', 'incentive_mode')) {
                $table->enum('incentive_mode', ['same', 'by_mechanic'])
                    ->default('same')
                    ->after('status');
            }

            if (!Schema::hasColumn('services', 'default_incentive_percentage')) {
                $table->decimal('default_incentive_percentage', 5, 2)
                    ->default(0)
                    ->after('incentive_mode');
            }
        });

        if (!Schema::hasTable('service_price_adjustments')) {
            Schema::create('service_price_adjustments', function (Blueprint $table) {
                $table->id();
                $table->foreignId('service_id')->constrained('services')->cascadeOnDelete();
                $table->foreignId('trigger_service_id')->constrained('services')->cascadeOnDelete();
                $table->enum('discount_type', ['percent', 'fixed'])->default('fixed');
                $table->decimal('discount_value', 12, 2)->default(0);
                $table->timestamps();

                $table->unique(['service_id', 'trigger_service_id'], 'svc_price_adjust_unique');
            });
        }

        if (!Schema::hasTable('service_mechanic_incentives')) {
            Schema::create('service_mechanic_incentives', function (Blueprint $table) {
                $table->id();
                $table->foreignId('service_id')->constrained('services')->cascadeOnDelete();
                $table->foreignId('mechanic_id')->constrained('mechanics')->cascadeOnDelete();
                $table->decimal('incentive_percentage', 5, 2)->default(0);
                $table->timestamps();

                $table->unique(['service_id', 'mechanic_id'], 'svc_mechanic_incentive_unique');
            });
        }

        Schema::table('service_order_details', function (Blueprint $table) {
            if (!Schema::hasColumn('service_order_details', 'base_amount')) {
                $table->bigInteger('base_amount')->default(0)->after('amount');
            }

            if (!Schema::hasColumn('service_order_details', 'auto_discount_amount')) {
                $table->bigInteger('auto_discount_amount')->default(0)->after('base_amount');
            }

            if (!Schema::hasColumn('service_order_details', 'auto_discount_notes')) {
                $table->string('auto_discount_notes')->nullable()->after('auto_discount_amount');
            }

            if (!Schema::hasColumn('service_order_details', 'incentive_percentage')) {
                $table->decimal('incentive_percentage', 5, 2)->default(0)->after('final_amount');
            }

            if (!Schema::hasColumn('service_order_details', 'incentive_amount')) {
                $table->bigInteger('incentive_amount')->default(0)->after('incentive_percentage');
            }
        });
    }

    public function down(): void
    {
        Schema::table('service_order_details', function (Blueprint $table) {
            $columns = [
                'base_amount',
                'auto_discount_amount',
                'auto_discount_notes',
                'incentive_percentage',
                'incentive_amount',
            ];

            foreach ($columns as $column) {
                if (Schema::hasColumn('service_order_details', $column)) {
                    $table->dropColumn($column);
                }
            }
        });

        Schema::dropIfExists('service_mechanic_incentives');
        Schema::dropIfExists('service_price_adjustments');

        Schema::table('services', function (Blueprint $table) {
            if (Schema::hasColumn('services', 'default_incentive_percentage')) {
                $table->dropColumn('default_incentive_percentage');
            }

            if (Schema::hasColumn('services', 'incentive_mode')) {
                $table->dropColumn('incentive_mode');
            }
        });
    }
};
