<?php

use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\ConversationController;
use App\Http\Controllers\Api\MessageController;
use App\Http\Controllers\Api\StreamController;
use App\Http\Controllers\Api\UserController;
use Illuminate\Support\Facades\Route;

// Autenticación (pública)
Route::post('/auth/register', [AuthController::class, 'register'])->middleware('throttle:register');
Route::post('/auth/login', [AuthController::class, 'login'])->middleware('throttle:login');

// Todo lo demás requiere un token Bearer válido
Route::middleware('auth:api')->group(function () {
    Route::post('/auth/logout', [AuthController::class, 'logout']);
    Route::get('/me', [AuthController::class, 'me']);
    Route::get('/users', [UserController::class, 'index']);

    Route::get('/conversations', [ConversationController::class, 'index']);
    Route::post('/conversations', [ConversationController::class, 'store'])->middleware('throttle:messages');
    Route::get('/conversations/{conversation}', [ConversationController::class, 'show']);
    Route::post('/conversations/{conversation}/read', [ConversationController::class, 'read']);
    Route::post('/conversations/{conversation}/typing', [ConversationController::class, 'typing'])
        ->middleware('throttle:typing');

    Route::get('/conversations/{conversation}/messages', [MessageController::class, 'index']);
    Route::post('/conversations/{conversation}/messages', [MessageController::class, 'store'])
        ->middleware('throttle:messages');

    // Eventos en tiempo real (Server-Sent Events)
    Route::get('/stream', StreamController::class);
});
