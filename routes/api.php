<?php

use App\Http\Controllers\Apps\SyncController;
use App\Http\Controllers\ApiProxyController;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;

Route::prefix('sync')->controller(SyncController::class)->group(function () {
    Route::post('/batches', 'receiveBatch');
    Route::get('/status', 'status');
});

// Development-only proxy endpoints for API documentation (forward to external SDMS API)
// POST /api/authenticate -> forwarded to {SDMS_API_BASE}/authenticate
Route::post('/authenticate', [ApiProxyController::class, 'proxy']);

// Proxy specific PKB endpoint so Swagger UI can call the local /api/reception/Pkb
Route::get('/reception/Pkb', function (Request $request) {
    $controller = app(\App\Http\Controllers\ApiProxyController::class);
    // forward to external path that includes /api prefix
    return $controller->proxy($request, 'api/reception/Pkb');
})->middleware('web');

// Proxy specific DeliveryOrder endpoint so frontend can call local /api/part/DeliveryOrder
Route::get('/part/DeliveryOrder', function (Request $request) {
    $controller = app(\App\Http\Controllers\ApiProxyController::class);
    return $controller->proxy($request, 'api/part/DeliveryOrder');
})->middleware('web');

// Proxy specific ShipmentPackageNonMulia endpoint for SPG detail page
Route::get('/part/ShipmentPackageNonMulia', function (Request $request) {
    $controller = app(\App\Http\Controllers\ApiProxyController::class);
    return $controller->proxy($request, 'api/part/ShipmentPackageNonMulia');
})->middleware('web');

// Proxy specific OrderItem DO endpoint so frontend can call local /api/part/orderitemdo
Route::get('/part/orderitemdo', function (Request $request) {
    $controller = app(\App\Http\Controllers\ApiProxyController::class);
    return $controller->proxy($request, 'api/part/orderitemdo');
})->middleware('web');

// Proxy SPG item endpoint so frontend can call local /api/part/goodPartDetail/getpartspg
Route::get('/part/goodPartDetail/getpartspg', function (Request $request) {
    $controller = app(\App\Http\Controllers\ApiProxyController::class);
    return $controller->proxy($request, 'api/part/goodPartDetail/getpartspg');
})->middleware('web');

// Proxy ComparePartReceive endpoint (PUT) for SPG compare action
Route::put('/part/ComparePartReceive', function (Request $request) {
    $controller = app(\App\Http\Controllers\ApiProxyController::class);
    return $controller->proxy($request, 'api/part/ComparePartReceive');
})->middleware('web');

// Proxy ShipmentReceipt endpoint (submit SPG)
Route::post('/part/ShipmentReceipt', function (Request $request) {
    $controller = app(\App\Http\Controllers\ApiProxyController::class);
    return $controller->proxy($request, 'api/part/ShipmentReceipt');
})->middleware('web');

// SPG local endpoints (no proxy, direct local processing)
Route::post('/spg/sparepart', [\App\Http\Controllers\Apps\SDMSAuthController::class, 'storeSparepartFromSPG'])->middleware(['web', 'auth']);
Route::post('/spg/part-purchase', [\App\Http\Controllers\Apps\SDMSAuthController::class, 'storePartPurchaseFromSPG'])->middleware(['web', 'auth']);

// Generic proxy: /api/docs-proxy/{path} -> forwards to {SDMS_API_BASE}/{path}
Route::any('/docs-proxy/{path}', [ApiProxyController::class, 'proxy'])->where('path', '.*');
