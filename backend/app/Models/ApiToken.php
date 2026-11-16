<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Attributes\Hidden;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Str;

#[Fillable(['user_id', 'name', 'token_hash', 'last_used_at', 'expires_at'])]
#[Hidden(['token_hash'])]
class ApiToken extends Model
{
    protected function casts(): array
    {
        return [
            'last_used_at' => 'datetime',
            'expires_at' => 'datetime',
        ];
    }

    /** @return BelongsTo<User, $this> */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public static function hash(string $plainToken): string
    {
        return hash('sha256', $plainToken);
    }

    /**
     * Crea un token para el usuario y devuelve el valor en texto plano.
     * Es la única vez que el valor existe sin hash: no se puede recuperar después.
     */
    public static function issue(User $user, string $name = 'web'): string
    {
        $plain = Str::random(64);
        $days = (int) config('chat.token_ttl_days');

        static::create([
            'user_id' => $user->id,
            'name' => $name,
            'token_hash' => static::hash($plain),
            'expires_at' => $days > 0 ? now()->addDays($days) : null,
        ]);

        return $plain;
    }

    /** Busca un token vigente a partir de su valor en texto plano. */
    public static function findValid(string $plainToken): ?self
    {
        return static::query()
            ->where('token_hash', static::hash($plainToken))
            ->where(fn ($q) => $q->whereNull('expires_at')->orWhere('expires_at', '>', now()))
            ->first();
    }
}
