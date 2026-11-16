<?php

namespace App\Providers;

use App\Models\ApiToken;
use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        //
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        JsonResource::withoutWrapping();

        // Guard "api": token Bearer opaco; en la base solo existe su hash SHA-256
        Auth::viaRequest('chat-token', function (Request $request) {
            $plain = $request->bearerToken();
            if (! $plain || strlen($plain) > 128) {
                return null;
            }

            $token = ApiToken::findValid($plain);
            if (! $token) {
                return null;
            }

            $request->attributes->set('api_token', $token);

            if (! $token->last_used_at || $token->last_used_at->lt(now()->subMinute())) {
                $token->forceFill(['last_used_at' => now()])->saveQuietly();
            }

            $user = $token->user;
            $user?->touchPresence();

            return $user;
        });

        // Login: 10 intentos por minuto por cuenta e IP (frena fuerza bruta)
        RateLimiter::for('login', fn (Request $request) => Limit::perMinute(10)
            ->by(strtolower((string) $request->input('email')).'|'.$request->ip()));

        RateLimiter::for('register', fn (Request $request) => Limit::perMinute(10)->by($request->ip()));

        // Mensajes y avisos de escritura por usuario
        RateLimiter::for('messages', fn (Request $request) => Limit::perMinute(30)
            ->by((string) ($request->user()?->id ?: $request->ip())));
        RateLimiter::for('typing', fn (Request $request) => Limit::perMinute(40)
            ->by((string) ($request->user()?->id ?: $request->ip())));
    }
}
