<?php

use App\Http\Controllers\Apps\CategoryController;
use App\Http\Controllers\Apps\BusinessProfileController;
use App\Http\Controllers\Apps\CustomerController;
use App\Http\Controllers\Apps\PaymentSettingController;
use App\Http\Controllers\Apps\ProductController;
use App\Http\Controllers\Apps\TransactionController;
use App\Http\Controllers\DashboardController;
use App\Http\Controllers\PermissionController;
use App\Http\Controllers\ProfileController;
use App\Http\Controllers\Reports\ProfitReportController;
use App\Http\Controllers\Reports\PartSalesProfitReportController;
use App\Http\Controllers\Reports\SalesReportController;
use App\Http\Controllers\NotificationController;
use App\Http\Controllers\RoleController;
use App\Http\Controllers\UserController;
use Illuminate\Foundation\Application;
use Illuminate\Support\Facades\Route;
use Illuminate\Support\Facades\Auth;
use Inertia\Inertia;
use App\Http\Controllers\Apps\ServiceCategoryController;
use App\Http\Controllers\Apps\PartCategoryController;
use App\Http\Controllers\Apps\ServiceController;
use App\Http\Controllers\Apps\VehicleController;
use App\Http\Controllers\Apps\PartPurchaseController;
use App\Http\Controllers\PartSaleController;
use App\Http\Controllers\Apps\PartSalesOrderController;
use App\Http\Controllers\Apps\PartPurchaseOrderController;
use App\Http\Controllers\Apps\PartStockHistoryController;
use App\Http\Controllers\Apps\LowStockAlertController;

// Include authentication routes
require __DIR__.'/auth.php';

Route::get('/', function () {
    return Inertia::render('Welcome', [
        'canLogin'       => Route::has('login'),
        'canRegister'    => Route::has('register'),
        'laravelVersion' => Application::VERSION,
        'phpVersion'     => PHP_VERSION,
    ]);
});

// Test route untuk cek permissions
Route::get('/test-permissions', function () {
    if (!Auth::check()) {
        return 'User not authenticated. Please login first.';
    }

    $user = Auth::user();
    $permissions = $user->getAllPermissions()->pluck('name');

    return [
        'user' => $user->name,
        'email' => $user->email,
        'roles' => $user->roles->pluck('name'),
        'permissions_count' => $permissions->count(),
        'permissions' => $permissions->sort()->values(),
    ];
})->middleware('auth');

Route::group(['prefix' => 'dashboard', 'middleware' => ['auth']], function () {
    Route::get('/notifications', [NotificationController::class, 'index'])->name('notifications.index');
    Route::post('/notifications/read-all', [NotificationController::class, 'markAllRead'])->name('notifications.read-all');
    Route::post('/notifications/mark-read', [NotificationController::class, 'markRead'])->name('notifications.read');
    Route::post('/notifications/delete', [NotificationController::class, 'destroy'])->name('notifications.destroy');

    Route::get('/', [DashboardController::class, 'index'])->middleware(['auth', 'verified', 'permission:dashboard-access'])->name('dashboard');
    Route::get('/permissions', [PermissionController::class, 'index'])->middleware('permission:permissions-access')->name('permissions.index');
    // roles route
    Route::resource('/roles', RoleController::class)
        ->except(['create', 'edit', 'show'])
        ->middlewareFor('index', 'permission:roles-access')
        ->middlewareFor('store', 'permission:roles-create')
        ->middlewareFor('update', 'permission:roles-update')
        ->middlewareFor('destroy', 'permission:roles-delete');
    // users route
    Route::resource('/users', UserController::class)
        ->except('show')
        ->middlewareFor('index', 'permission:users-access')
        ->middlewareFor(['create', 'store'], 'permission:users-create')
        ->middlewareFor(['edit', 'update'], 'permission:users-update')
        ->middlewareFor('destroy', 'permission:users-delete');

    Route::resource('categories', CategoryController::class)
        ->middlewareFor(['index', 'show'], 'permission:categories-access')
        ->middlewareFor(['create', 'store'], 'permission:categories-create')
        ->middlewareFor(['edit', 'update'], 'permission:categories-edit')
        ->middlewareFor('destroy', 'permission:categories-delete');
    Route::resource('products', ProductController::class)
        ->middlewareFor(['index', 'show'], 'permission:products-access')
        ->middlewareFor(['create', 'store'], 'permission:products-create')
        ->middlewareFor(['edit', 'update'], 'permission:products-edit')
        ->middlewareFor('destroy', 'permission:products-delete');
    // customers search (AJAX) - MUST be before resource route to avoid conflict
    Route::get('/customers/search', [CustomerController::class, 'search'])->middleware('permission:customers-access')->name('customers.search');

    Route::resource('customers', CustomerController::class)
        ->middlewareFor(['index', 'show'], 'permission:customers-access')
        ->middlewareFor(['create', 'store'], 'permission:customers-create')
        ->middlewareFor(['edit', 'update'], 'permission:customers-edit')
        ->middlewareFor('destroy', 'permission:customers-delete');

    // Vehicles Management
    Route::resource('vehicles', VehicleController::class)
        ->middlewareFor(['index', 'show'], 'permission:vehicles-access')
        ->middlewareFor(['create', 'store'], 'permission:vehicles-create')
        ->middlewareFor(['edit', 'update'], 'permission:vehicles-edit')
        ->middlewareFor('destroy', 'permission:vehicles-delete');
    Route::get('/vehicles/{vehicle}/maintenance-insights', [VehicleController::class, 'maintenanceInsights'])
        ->middleware('permission:vehicles-access')
        ->name('vehicles.maintenance.insights');
    Route::get('/vehicles/{vehicle}/with-history', [VehicleController::class, 'getWithHistory'])
        ->middleware('permission:vehicles-access')
        ->name('vehicles.with-history');
    Route::get('/vehicles/{vehicle}/service-history', [VehicleController::class, 'getServiceHistory'])
        ->middleware('permission:vehicles-access')
        ->name('vehicles.service-history');

    // Recommendations
    Route::get('/vehicles/{vehicle}/recommendations', [\App\Http\Controllers\Apps\RecommendationController::class, 'getVehicleRecommendations'])
        ->middleware('permission:vehicles-access')
        ->name('vehicles.recommendations');
    Route::get('/vehicles/{vehicle}/maintenance-schedule', [\App\Http\Controllers\Apps\RecommendationController::class, 'getMaintenanceSchedule'])
        ->middleware('permission:vehicles-access')
        ->name('vehicles.maintenance-schedule');

    // Service Categories
    Route::resource('service-categories', ServiceCategoryController::class)
        ->middlewareFor(['index', 'show'], 'permission:service-categories-access')
        ->middlewareFor(['create', 'store'], 'permission:service-categories-create')
        ->middlewareFor(['edit', 'update'], 'permission:service-categories-edit')
        ->middlewareFor('destroy', 'permission:service-categories-delete');

    // Part Categories
    Route::resource('part-categories', PartCategoryController::class)
        ->middlewareFor(['index', 'show'], 'permission:part-categories-access')
        ->middlewareFor(['create', 'store'], 'permission:part-categories-create')
        ->middlewareFor(['edit', 'update'], 'permission:part-categories-edit')
        ->middlewareFor('destroy', 'permission:part-categories-delete');
    Route::post('part-categories/storeAjax', [PartCategoryController::class, 'storeAjax'])->middleware('permission:part-categories-create')->name('part-categories.storeAjax');

    // Services Management
    Route::resource('services', ServiceController::class)
        ->middlewareFor(['index', 'show'], 'permission:services-access')
        ->middlewareFor(['create', 'store'], 'permission:services-create')
        ->middlewareFor(['edit', 'update'], 'permission:services-edit')
        ->middlewareFor('destroy', 'permission:services-delete');
    // mechanics management
    Route::get('/mechanics', [\App\Http\Controllers\Apps\MechanicController::class, 'index'])->middleware('permission:mechanics-access')->name('mechanics.index');
    Route::post('/mechanics', [\App\Http\Controllers\Apps\MechanicController::class, 'store'])->middleware('permission:mechanics-create')->name('mechanics.store');
    Route::patch('/mechanics/{id}', [\App\Http\Controllers\Apps\MechanicController::class, 'update'])->middleware('permission:mechanics-update')->name('mechanics.update');
    Route::delete('/mechanics/{id}', [\App\Http\Controllers\Apps\MechanicController::class, 'destroy'])->middleware('permission:mechanics-delete')->name('mechanics.destroy');

    //suppliers management
    Route::get('/suppliers', [\App\Http\Controllers\Apps\SupplierController::class, 'index'])->middleware('permission:suppliers-access')->name('suppliers.index');
    Route::post('/suppliers', [\App\Http\Controllers\Apps\SupplierController::class, 'store'])->middleware('permission:suppliers-create')->name('suppliers.store');
    Route::post('/suppliers/storeAjax', [\App\Http\Controllers\Apps\SupplierController::class, 'storeAjax'])->middleware('permission:suppliers-create')->name('suppliers.storeAjax');
    Route::patch('/suppliers/{id}', [\App\Http\Controllers\Apps\SupplierController::class, 'update'])->middleware('permission:suppliers-update')->name('suppliers.update');
    Route::delete('/suppliers/{id}', [\App\Http\Controllers\Apps\SupplierController::class, 'destroy'])->middleware('permission:suppliers-delete')->name('suppliers.destroy');

    // parts management
    Route::get('/parts', [\App\Http\Controllers\Apps\PartController::class, 'index'])->middleware('permission:parts-access')->name('parts.index');
    Route::get('/parts/low-stock', [LowStockAlertController::class, 'index'])->middleware('permission:parts-access')->name('parts.low-stock');
    Route::get('/parts/create', [\App\Http\Controllers\Apps\PartController::class, 'create'])->middleware('permission:parts-create')->name('parts.create');
    Route::get('/parts/{id}', [\App\Http\Controllers\Apps\PartController::class, 'show'])->middleware('permission:parts-access')->name('parts.show');
    Route::get('/parts/{id}/edit', [\App\Http\Controllers\Apps\PartController::class, 'edit'])->middleware('permission:parts-update')->name('parts.edit');
    Route::post('/parts', [\App\Http\Controllers\Apps\PartController::class, 'store'])->middleware('permission:parts-create')->name('parts.store');
    Route::patch('/parts/{id}', [\App\Http\Controllers\Apps\PartController::class, 'update'])->middleware('permission:parts-update')->name('parts.update');
    Route::delete('/parts/{id}', [\App\Http\Controllers\Apps\PartController::class, 'destroy'])->middleware('permission:parts-delete')->name('parts.destroy');

    // Part Purchases
    Route::get('/part-purchases', [PartPurchaseController::class, 'index'])->middleware('permission:part-purchases-access')->name('part-purchases.index');
    Route::get('/part-purchases/create', [PartPurchaseController::class, 'create'])->middleware('permission:part-purchases-create')->name('part-purchases.create');
    Route::post('/part-purchases', [PartPurchaseController::class, 'store'])->middleware('permission:part-purchases-create')->name('part-purchases.store');
    Route::get('/part-purchases/{id}', [PartPurchaseController::class, 'show'])->middleware('permission:part-purchases-access')->name('part-purchases.show');
    Route::get('/part-purchases/{id}/print', [PartPurchaseController::class, 'print'])->middleware('permission:part-purchases-access')->name('part-purchases.print');
    Route::get('/part-purchases/{id}/edit', [PartPurchaseController::class, 'edit'])->middleware('permission:part-purchases-update')->name('part-purchases.edit');
    Route::put('/part-purchases/{id}', [PartPurchaseController::class, 'update'])->middleware('permission:part-purchases-update')->name('part-purchases.update');
    Route::post('/part-purchases/{id}/update-status', [PartPurchaseController::class, 'updateStatus'])->middleware('permission:part-purchases-update')->name('part-purchases.update-status');

    // Part Sales Orders - DISABLED
    // Route::get('/part-sales-orders', [PartSalesOrderController::class, 'index'])->middleware('permission:part-sales-orders-access')->name('part-sales-orders.index');
    // Route::get('/part-sales-orders/create', [PartSalesOrderController::class, 'create'])->middleware('permission:part-sales-orders-create')->name('part-sales-orders.create');
    // Route::post('/part-sales-orders', [PartSalesOrderController::class, 'store'])->middleware('permission:part-sales-orders-create')->name('part-sales-orders.store');
    // Route::get('/part-sales-orders/{id}', [PartSalesOrderController::class, 'show'])->middleware('permission:part-sales-orders-access')->name('part-sales-orders.show');
    // Route::post('/part-sales-orders/{id}/update-status', [PartSalesOrderController::class, 'updateStatus'])->middleware('permission:part-sales-orders-update')->name('part-sales-orders.update-status');

    // Part Sales (Direct Sales & Invoices)
    Route::get('/part-sales', [PartSaleController::class, 'index'])->middleware('permission:part-sales-access')->name('part-sales.index');
    Route::get('/part-sales/create', [PartSaleController::class, 'create'])->middleware('permission:part-sales-create')->name('part-sales.create');
    Route::post('/part-sales', [PartSaleController::class, 'store'])->middleware('permission:part-sales-create')->name('part-sales.store');
    Route::get('/part-sales/{partSale}', [PartSaleController::class, 'show'])->middleware('permission:part-sales-show')->name('part-sales.show');
    Route::get('/part-sales/{partSale}/print', [PartSaleController::class, 'print'])->middleware('permission:part-sales-show')->name('part-sales.print');
    Route::get('/part-sales/{partSale}/edit', [PartSaleController::class, 'edit'])->middleware('permission:part-sales-edit')->name('part-sales.edit');
    Route::put('/part-sales/{partSale}', [PartSaleController::class, 'update'])->middleware('permission:part-sales-edit')->name('part-sales.update');
    Route::delete('/part-sales/{partSale}', [PartSaleController::class, 'destroy'])->middleware('permission:part-sales-delete')->name('part-sales.destroy');
    Route::post('/part-sales/{partSale}/update-payment', [PartSaleController::class, 'updatePayment'])->middleware('permission:part-sales-edit')->name('part-sales.update-payment');
    Route::post('/part-sales/{partSale}/update-status', [PartSaleController::class, 'updateStatus'])->middleware('permission:part-sales-edit')->name('part-sales.update-status');
    Route::post('/part-sales/create-from-order', [PartSaleController::class, 'createFromOrder'])->middleware('permission:part-sales-create')->name('part-sales.create-from-order');

    // Part Purchase Orders - DISABLED
    // Route::get('/part-purchase-orders', [PartPurchaseOrderController::class, 'index'])->middleware('permission:part-purchase-orders-access')->name('part-purchase-orders.index');
    // Route::get('/part-purchase-orders/create', [PartPurchaseOrderController::class, 'create'])->middleware('permission:part-purchase-orders-create')->name('part-purchase-orders.create');
    // Route::post('/part-purchase-orders', [PartPurchaseOrderController::class, 'store'])->middleware('permission:part-purchase-orders-create')->name('part-purchase-orders.store');
    // Route::get('/part-purchase-orders/{partPurchaseOrder}', [PartPurchaseOrderController::class, 'show'])->middleware('permission:part-purchase-orders-access')->name('part-purchase-orders.show');
    // Route::post('/part-purchase-orders/{partPurchaseOrder}/update-status', [PartPurchaseOrderController::class, 'updateStatus'])->middleware('permission:part-purchase-orders-update')->name('part-purchase-orders.update-status');

    // Part Stock History
    Route::get('/part-stock-history', [PartStockHistoryController::class, 'index'])->middleware('permission:part-stock-history-access|parts-stock-access')->name('part-stock-history.index');
    Route::get('/part-stock-history/export', [PartStockHistoryController::class, 'export'])->middleware('permission:part-stock-history-access|parts-stock-access')->name('part-stock-history.export');

    // parts stock / movements (redirect to unified history)
    Route::get('/parts/stock', function () {
        return redirect()->route('part-stock-history.index');
    })->middleware('permission:parts-stock-access|part-stock-history-access')->name('parts.stock.index');
    Route::get('/parts/stock/in', [\App\Http\Controllers\Apps\PartStockController::class, 'createIn'])->middleware('permission:parts-stock-in')->name('parts.stock.in.create');
    Route::post('/parts/stock/in', [\App\Http\Controllers\Apps\PartStockController::class, 'storeIn'])->middleware('permission:parts-stock-in')->name('parts.stock.in.store');
    Route::get('/parts/stock/out', [\App\Http\Controllers\Apps\PartStockController::class, 'createOut'])->middleware('permission:parts-stock-out')->name('parts.stock.out.create');
    Route::post('/parts/stock/out', [\App\Http\Controllers\Apps\PartStockController::class, 'storeOut'])->middleware('permission:parts-stock-out')->name('parts.stock.out.store');

    // suppliers create route
    Route::get('/suppliers/create', [\App\Http\Controllers\Apps\SupplierController::class, 'create'])->middleware('permission:suppliers-create')->name('suppliers.create');
    Route::get('/suppliers/{id}/edit', [\App\Http\Controllers\Apps\SupplierController::class, 'edit'])->middleware('permission:suppliers-update')->name('suppliers.edit');

    // mechanics create route
    Route::get('/mechanics/create', [\App\Http\Controllers\Apps\MechanicController::class, 'create'])->middleware('permission:mechanics-create')->name('mechanics.create');

    // mechanics performance dashboard
    Route::get('/mechanics/performance/dashboard', [\App\Http\Controllers\Apps\MechanicPerformanceController::class, 'dashboard'])->middleware('permission:mechanics-access')->name('mechanics.performance.dashboard');
    Route::get('/mechanics/{id}/performance', [\App\Http\Controllers\Apps\MechanicPerformanceController::class, 'show'])->middleware('permission:mechanics-access')->name('mechanics.performance.show');
    Route::get('/mechanics/performance/export', [\App\Http\Controllers\Apps\MechanicPerformanceController::class, 'export'])->middleware('permission:mechanics-access')->name('mechanics.performance.export');

    //route customer history
    Route::get('/customers/{customer}/history', [CustomerController::class, 'getHistory'])->middleware('permission:transactions-access')->name('customers.history');

    //route customer store via AJAX (no redirect)
    Route::post('/customers/store-ajax', [CustomerController::class, 'storeAjax'])->middleware('permission:customers-create')->name('customers.storeAjax');

    //route transaction
    Route::get('/transactions', [TransactionController::class, 'index'])->middleware('permission:transactions-access')->name('transactions.index');

    //route transaction searchProduct
    Route::post('/transactions/searchProduct', [TransactionController::class, 'searchProduct'])->middleware('permission:transactions-access')->name('transactions.searchProduct');

    //route transaction addToCart
    Route::post('/transactions/addToCart', [TransactionController::class, 'addToCart'])->middleware('permission:transactions-access')->name('transactions.addToCart');

    //route transaction destroyCart
    Route::delete('/transactions/{cart_id}/destroyCart', [TransactionController::class, 'destroyCart'])->middleware('permission:transactions-access')->name('transactions.destroyCart');

    //route transaction updateCart
    Route::patch('/transactions/{cart_id}/updateCart', [TransactionController::class, 'updateCart'])->middleware('permission:transactions-access')->name('transactions.updateCart');

    //route hold transaction
    Route::post('/transactions/hold', [TransactionController::class, 'holdCart'])->middleware('permission:transactions-access')->name('transactions.hold');
    Route::post('/transactions/{holdId}/resume', [TransactionController::class, 'resumeCart'])->middleware('permission:transactions-access')->name('transactions.resume');
    Route::delete('/transactions/{holdId}/clearHold', [TransactionController::class, 'clearHold'])->middleware('permission:transactions-access')->name('transactions.clearHold');
    Route::get('/transactions/held', [TransactionController::class, 'getHeldCarts'])->middleware('permission:transactions-access')->name('transactions.held');

    //route transaction store
    Route::post('/transactions/store', [TransactionController::class, 'store'])->middleware('permission:transactions-access')->name('transactions.store');
    Route::get('/transactions/{invoice}/print', [TransactionController::class, 'print'])->middleware('permission:transactions-access')->name('transactions.print');
    Route::get('/transactions/history', [TransactionController::class, 'history'])->middleware('permission:transactions-access')->name('transactions.history');

    // service orders
    Route::get('/service-orders', [\App\Http\Controllers\Apps\ServiceOrderController::class, 'index'])->middleware('permission:service-orders-access')->name('service-orders.index');
    Route::get('/service-orders/create', [\App\Http\Controllers\Apps\ServiceOrderController::class, 'create'])->middleware('permission:service-orders-create')->name('service-orders.create');
    Route::get('/service-orders/{id}/print', [\App\Http\Controllers\Apps\ServiceOrderController::class, 'print'])->middleware('permission:service-orders-access')->name('service-orders.print');
    Route::get('/service-orders/{id}', [\App\Http\Controllers\Apps\ServiceOrderController::class, 'show'])->middleware('permission:service-orders-access')->name('service-orders.show');
    Route::get('/service-orders/{id}/edit', [\App\Http\Controllers\Apps\ServiceOrderController::class, 'edit'])->middleware('permission:service-orders-update')->name('service-orders.edit');
    Route::post('/service-orders', [\App\Http\Controllers\Apps\ServiceOrderController::class, 'store'])->middleware('permission:service-orders-create')->name('service-orders.store');
    Route::put('/service-orders/{id}', [\App\Http\Controllers\Apps\ServiceOrderController::class, 'update'])->middleware('permission:service-orders-update')->name('service-orders.update');
    Route::post('/transactions/service-orders', [\App\Http\Controllers\Apps\ServiceOrderController::class, 'store'])->middleware('permission:transactions-access')->name('transactions.service-orders.store');
    Route::post('/service-orders/{id}/status', [\App\Http\Controllers\Apps\ServiceOrderController::class, 'updateStatus'])->middleware('permission:service-orders-update')->name('service-orders.update-status');

    //appointments
    Route::get('/appointments', [\App\Http\Controllers\Apps\AppointmentController::class, 'index'])->middleware('permission:appointments-access')->name('appointments.index');
    Route::get('/appointments/calendar', [\App\Http\Controllers\Apps\AppointmentController::class, 'calendar'])->middleware('permission:appointments-access')->name('appointments.calendar');
    Route::get('/appointments/{id}/edit', [\App\Http\Controllers\Apps\AppointmentController::class, 'edit'])->middleware('permission:appointments-update')->name('appointments.edit');
    Route::get('/appointments/slots', [\App\Http\Controllers\Apps\AppointmentController::class, 'getAvailableSlots'])->middleware('permission:appointments-access')->name('appointments.available-slots');
    Route::post('/appointments', [\App\Http\Controllers\Apps\AppointmentController::class, 'store'])->middleware('permission:appointments-create')->name('appointments.store');
    Route::put('/appointments/{id}', [\App\Http\Controllers\Apps\AppointmentController::class, 'update'])->middleware('permission:appointments-update')->name('appointments.update');
    Route::patch('/appointments/{id}/status', [\App\Http\Controllers\Apps\AppointmentController::class, 'updateStatus'])->middleware('permission:appointments-update')->name('appointments.updateStatus');
    Route::delete('/appointments/{id}', [\App\Http\Controllers\Apps\AppointmentController::class, 'destroy'])->middleware('permission:appointments-delete')->name('appointments.destroy');
    Route::get('/appointments/{id}/export', [\App\Http\Controllers\Apps\AppointmentController::class, 'exportIcs'])->middleware('permission:appointments-access')->name('appointments.export');

    Route::get('/settings/payments', [PaymentSettingController::class, 'edit'])->middleware('permission:payment-settings-access')->name('settings.payments.edit');
    Route::put('/settings/payments', [PaymentSettingController::class, 'update'])->middleware('permission:payment-settings-access')->name('settings.payments.update');
    Route::get('/settings/business-profile', [BusinessProfileController::class, 'edit'])->middleware('permission:payment-settings-access')->name('settings.business-profile.edit');
    Route::put('/settings/business-profile', [BusinessProfileController::class, 'update'])->middleware('permission:payment-settings-access')->name('settings.business-profile.update');

    //reports
    Route::get('/reports/sales', [SalesReportController::class, 'index'])->middleware('permission:reports-access')->name('reports.sales.index');
    Route::get('/reports/profits', [ProfitReportController::class, 'index'])->middleware('permission:profits-access')->name('reports.profits.index');
    Route::get('/reports/part-sales-profit', [PartSalesProfitReportController::class, 'index'])->middleware('permission:reports-access')->name('reports.part-sales-profit.index');
    Route::get('/reports/part-sales-profit/by-supplier', [PartSalesProfitReportController::class, 'bySupplier'])->middleware('permission:reports-access')->name('reports.part-sales-profit.by-supplier');

    // Service Reports
    Route::get('/reports/service-revenue', [\App\Http\Controllers\Apps\ServiceReportController::class, 'revenue'])->middleware('permission:reports-access')->name('reports.service-revenue.index');
    Route::get('/reports/mechanic-productivity', [\App\Http\Controllers\Apps\ServiceReportController::class, 'mechanicProductivity'])->middleware('permission:reports-access')->name('reports.mechanic-productivity.index');
    Route::get('/reports/mechanic-payroll', [\App\Http\Controllers\Apps\ServiceReportController::class, 'mechanicPayroll'])->middleware('permission:reports-access')->name('reports.mechanic-payroll.index');
    Route::get('/reports/parts-inventory', [\App\Http\Controllers\Apps\ServiceReportController::class, 'partsInventory'])->middleware('permission:reports-access')->name('reports.parts-inventory.index');
    Route::get('/reports/outstanding-payments', [\App\Http\Controllers\Apps\ServiceReportController::class, 'outstandingPayments'])->middleware('permission:reports-access')->name('reports.outstanding-payments.index');
    Route::get('/reports/export', [\App\Http\Controllers\Apps\ServiceReportController::class, 'exportCsv'])->middleware('permission:reports-access')->name('reports.export');

    Route::get('/profile', [ProfileController::class, 'edit'])->name('profile.edit');
    Route::patch('/profile', [ProfileController::class, 'update'])->name('profile.update');
    Route::delete('/profile', [ProfileController::class, 'destroy'])->name('profile.destroy');
});
