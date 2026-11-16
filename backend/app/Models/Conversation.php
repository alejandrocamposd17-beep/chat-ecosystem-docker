<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Support\Facades\DB;

#[Fillable(['type', 'name', 'owner_id', 'contact_id'])]
class Conversation extends Model
{
    public const TYPE_DIRECT = 'direct';

    public const TYPE_GROUP = 'group';

    public const ROLE_ADMIN = 'admin';

    public const ROLE_MEMBER = 'member';

    /** @return BelongsTo<User, $this> */
    public function owner(): BelongsTo
    {
        return $this->belongsTo(User::class, 'owner_id');
    }

    /** @return BelongsTo<User, $this> */
    public function contact(): BelongsTo
    {
        return $this->belongsTo(User::class, 'contact_id');
    }

    /** @return BelongsToMany<User, $this> */
    public function participants(): BelongsToMany
    {
        return $this->belongsToMany(User::class, 'conversation_participants')
            ->withPivot(['role', 'last_read_at'])
            ->withTimestamps();
    }

    /** @return HasMany<Message, $this> */
    public function messages(): HasMany
    {
        return $this->hasMany(Message::class);
    }

    /**
     * Último mensaje (incluye borrados, para mostrar "Mensaje eliminado" en la lista).
     *
     * @return HasOne<Message, $this>
     */
    public function latestMessage(): HasOne
    {
        return $this->hasOne(Message::class)->withTrashed()->latestOfMany();
    }

    public function isGroup(): bool
    {
        return $this->type === self::TYPE_GROUP;
    }

    /**
     * Conversaciones en las que participa el usuario.
     *
     * @param  Builder<Conversation>  $query
     */
    public function scopeForUser(Builder $query, User|int $user): void
    {
        $userId = $user instanceof User ? $user->id : $user;

        $query->whereHas('participants', fn ($q) => $q->whereKey($userId));
    }

    /**
     * Agrega unread_count: mensajes de otros posteriores a la última lectura del usuario.
     *
     * @param  Builder<Conversation>  $query
     */
    public function scopeWithUnreadCountFor(Builder $query, User $user): void
    {
        $query->withCount(['messages as unread_count' => function ($q) use ($user) {
            $q->where('sender_id', '!=', $user->id)
                ->whereRaw(
                    'messages.created_at > COALESCE((SELECT cp.last_read_at FROM conversation_participants cp '
                    .'WHERE cp.conversation_id = messages.conversation_id AND cp.user_id = ?), ?)',
                    [$user->id, '1970-01-01 00:00:00'],
                );
        }]);
    }

    public function hasParticipant(User|int $user): bool
    {
        $userId = $user instanceof User ? $user->id : $user;

        return $this->participants()->whereKey($userId)->exists();
    }

    public function isAdmin(User $user): bool
    {
        return $this->participants()
            ->whereKey($user->id)
            ->wherePivot('role', self::ROLE_ADMIN)
            ->exists();
    }

    /** El otro participante de un chat 1 a 1 (requiere participants cargados). */
    public function otherParticipant(User|int $user): ?User
    {
        $userId = $user instanceof User ? $user->id : $user;

        return $this->participants->first(fn (User $p) => (int) $p->id !== (int) $userId);
    }

    /** Busca el chat directo entre dos usuarios o lo crea (con ambos como participantes). */
    public static function between(User $a, User $b): self
    {
        return DB::transaction(function () use ($a, $b) {
            $existing = static::query()
                ->where('type', self::TYPE_DIRECT)
                ->forUser($a)
                ->whereHas('participants', fn ($q) => $q->whereKey($b->id))
                ->lockForUpdate()
                ->first();

            if ($existing) {
                return $existing;
            }

            $conversation = static::create([
                'type' => self::TYPE_DIRECT,
                'owner_id' => $a->id,
                'contact_id' => $b->id,
            ]);
            $conversation->participants()->attach([
                $a->id => ['role' => self::ROLE_MEMBER, 'last_read_at' => now()],
                $b->id => ['role' => self::ROLE_MEMBER, 'last_read_at' => null],
            ]);

            return $conversation;
        });
    }

    /**
     * Crea un grupo: quien lo crea queda como administrador.
     *
     * @param  iterable<User>  $members
     */
    public static function createGroup(User $creator, string $name, iterable $members): self
    {
        return DB::transaction(function () use ($creator, $name, $members) {
            $group = static::create([
                'type' => self::TYPE_GROUP,
                'name' => $name,
                'owner_id' => $creator->id,
                'contact_id' => null,
            ]);

            $attach = [$creator->id => ['role' => self::ROLE_ADMIN, 'last_read_at' => now()]];
            foreach ($members as $member) {
                if ((int) $member->id !== (int) $creator->id) {
                    $attach[$member->id] = ['role' => self::ROLE_MEMBER, 'last_read_at' => null];
                }
            }
            $group->participants()->attach($attach);
            $group->systemMessage($creator, "{$creator->name} creó el grupo «{$name}»");

            return $group;
        });
    }

    /** Mensaje del sistema (ej. "Ana agregó a Beto"), visible para todos los participantes. */
    public function systemMessage(User $actor, string $text): Message
    {
        return $this->messages()->create([
            'sender_id' => $actor->id,
            'kind' => Message::KIND_SYSTEM,
            'content' => $text,
        ]);
    }

    /** Marca la conversación como leída por el usuario. */
    public function markReadBy(User $user): void
    {
        $this->participants()->updateExistingPivot($user->id, ['last_read_at' => now()]);
    }
}
