<?php

use App\Http\Controllers\Apps\SyncController;
use Illuminate\Support\Facades\Route;

Route::prefix('sync')->controller(SyncController::class)->group(function () {
    Route::post('/batches', 'receiveBatch');
    Route::get('/status', 'status');
});