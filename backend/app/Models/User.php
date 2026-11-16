<?php

namespace App\Models;

use Database\Factories\UserFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Attributes\Hidden;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;

#[Fillable(['name', 'email', 'password', 'avatar_url', 'status', 'last_seen_at'])]
#[Hidden(['password', 'remember_token'])]
class User extends Authenticatable
{
    /** @use HasFactory<UserFactory> */
    use HasFactory, Notifiable;

    protected function casts(): array
    {
        return [
            'email_verified_at' => 'datetime',
            'last_seen_at' => 'datetime',
            'password' => 'hashed',
        ];
    }

    /** @return BelongsToMany<Conversation, $this> */
    public function conversations(): BelongsToMany
    {
        return $this->belongsToMany(Conversation::class, 'conversation_participants')
            ->withPivot('last_read_at')
            ->withTimestamps();
    }

    /** @return HasMany<ApiToken, $this> */
    public function apiTokens(): HasMany
    {
        return $this->hasMany(ApiToken::class);
    }

    /** En línea si tuvo actividad en los últimos minutos (configurable). */
    public function presence(): string
    {
        $window = (int) config('chat.online_window_seconds');

        return $this->last_seen_at && $this->last_seen_at->gt(now()->subSeconds($window))
            ? 'online'
            : 'offline';
    }

    /** Registra actividad sin escribir en la base en cada petición. */
    public function touchPresence(): void
    {
        if (! $this->last_seen_at || $this->last_seen_at->lt(now()->subSeconds(30))) {
            $this->forceFill(['last_seen_at' => now()])->saveQuietly();
        }
    }
}
