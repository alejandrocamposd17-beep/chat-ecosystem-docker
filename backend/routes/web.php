<?php

use App\Http\Controllers\StatusController;
use Illuminate\Support\Facades\Route;

// Servicio solo API: la raiz responde JSON en lugar de una vista
Route::get('/', StatusController::class);
