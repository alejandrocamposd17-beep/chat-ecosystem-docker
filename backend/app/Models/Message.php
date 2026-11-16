<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Support\Facades\Storage;

#[Fillable([
    'conversation_id', 'sender_id', 'kind', 'reply_to_id', 'content',
    'attachment_path', 'attachment_name', 'attachment_mime', 'attachment_size', 'edited_at',
])]
class Message extends Model
{
    use SoftDeletes;

    public const KIND_USER = 'user';

    public const KIND_SYSTEM = 'system';

    /** Tipos de imagen que se muestran en línea; el resto se descarga */
    public const INLINE_IMAGE_MIMES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];

    // Al crear un mensaje se actualiza updated_at de la conversacion
    protected $touches = ['conversation'];

    protected function casts(): array
    {
        return [
            'edited_at' => 'datetime',
            'attachment_size' => 'integer',
        ];
    }

    /** @return BelongsTo<Conversation, $this> */
    public function conversation(): BelongsTo
    {
        return $this->belongsTo(Conversation::class);
    }

    /** @return BelongsTo<User, $this> */
    public function sender(): BelongsTo
    {
        return $this->belongsTo(User::class, 'sender_id');
    }

    /** @return BelongsTo<Message, $this> */
    public function replyTo(): BelongsTo
    {
        return $this->belongsTo(Message::class, 'reply_to_id')->withTrashed();
    }

    /** @return HasMany<MessageReaction, $this> */
    public function reactions(): HasMany
    {
        return $this->hasMany(MessageReaction::class);
    }

    public function isImage(): bool
    {
        return in_array($this->attachment_mime, self::INLINE_IMAGE_MIMES, true);
    }

    /**
     * Borrado lógico: se elimina el contenido y el archivo (privacidad) y queda
     * el aviso "Mensaje eliminado" en la conversación.
     */
    public function eraseAndDelete(): void
    {
        if ($this->attachment_path) {
            Storage::disk('local')->delete($this->attachment_path);
        }

        $this->forceFill([
            'content' => null,
            'attachment_path' => null,
            'attachment_name' => null,
            'attachment_mime' => null,
            'attachment_size' => null,
        ])->save();

        $this->reactions()->delete();
        $this->delete();
    }
}
