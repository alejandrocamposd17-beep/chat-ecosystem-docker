<?php

use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\ConversationController;
use App\Http\Controllers\Api\MessageController;
use App\Http\Controllers\Api\ParticipantController;
use App\Http\Controllers\Api\ProfileController;
use App\Http\Controllers\Api\ReactionController;
use App\Http\Controllers\Api\StreamController;
use App\Http\Controllers\Api\UserController;
use Illuminate\Support\Facades\Route;

// Autenticación (pública)
Route::post('/auth/register', [AuthController::class, 'register'])->middleware('throttle:register');
Route::post('/auth/login', [AuthController::class, 'login'])->middleware('throttle:login');

// Todo lo demás requiere un token Bearer válido
Route::middleware('auth:api')->group(function () {
    Route::post('/auth/logout', [AuthController::class, 'logout']);

    // Perfil
    Route::get('/me', [AuthController::class, 'me']);
    Route::patch('/me', [ProfileController::class, 'update']);
    Route::post('/me/avatar', [ProfileController::class, 'avatar'])->middleware('throttle:uploads');
    Route::delete('/me/avatar', [ProfileController::class, 'removeAvatar']);
    Route::put('/me/password', [ProfileController::class, 'password'])->middleware('throttle:login');

    Route::get('/users', [UserController::class, 'index']);
    Route::get('/users/{user}/avatar', [ProfileController::class, 'showAvatar']);

    // Conversaciones y grupos
    Route::get('/conversations', [ConversationController::class, 'index']);
    Route::post('/conversations', [ConversationController::class, 'store'])->middleware('throttle:messages');
    Route::get('/conversations/{conversation}', [ConversationController::class, 'show']);
    Route::patch('/conversations/{conversation}', [ConversationController::class, 'update']);
    Route::post('/conversations/{conversation}/read', [ConversationController::class, 'read']);
    Route::post('/conversations/{conversation}/typing', [ConversationController::class, 'typing'])
        ->middleware('throttle:typing');
    Route::post('/conversations/{conversation}/participants', [ParticipantController::class, 'store']);
    Route::delete('/conversations/{conversation}/participants/{user}', [ParticipantController::class, 'destroy']);

    // Mensajes
    Route::get('/conversations/{conversation}/messages', [MessageController::class, 'index']);
    Route::post('/conversations/{conversation}/messages', [MessageController::class, 'store'])
        ->middleware(['throttle:messages', 'throttle:uploads']);
    Route::patch('/conversations/{conversation}/messages/{message}', [MessageController::class, 'update'])
        ->middleware('throttle:messages');
    Route::delete('/conversations/{conversation}/messages/{message}', [MessageController::class, 'destroy']);
    Route::post('/conversations/{conversation}/messages/{message}/reactions', [ReactionController::class, 'toggle'])
        ->middleware('throttle:typing');
    Route::get('/attachments/{message}', [MessageController::class, 'attachment']);

    // Eventos en tiempo real (Server-Sent Events)
    Route::get('/stream', StreamController::class);
});
