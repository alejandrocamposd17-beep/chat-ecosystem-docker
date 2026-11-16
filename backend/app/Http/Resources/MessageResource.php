<?php

namespace App\Http\Resources;

use App\Models\Message;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;
use Illuminate\Support\Str;

/**
 * Forma: interface Message del frontend
 *
 * @mixin Message
 */
class MessageResource extends JsonResource
{
    /** Usuario para el que se calcula isSelf y "mine" (por defecto, el autenticado) */
    public ?int $viewerId = null;

    public function forViewer(int $userId): static
    {
        $this->viewerId = $userId;

        return $this;
    }

    public function toArray(Request $request): array
    {
        $viewerId = $this->viewerId ?? $request->user()?->id;
        $this->resource->loadMissing(['sender', 'reactions', 'replyTo.sender']);
        $deleted = $this->trashed();

        return [
            'id' => (string) $this->id,
            'chatId' => (string) $this->conversation_id,
            'senderId' => (string) $this->sender_id,
            'senderName' => $this->sender?->name ?? 'Usuario',
            'kind' => $this->kind ?? Message::KIND_USER,
            'content' => $deleted ? null : $this->content,
            'createdAt' => $this->created_at?->toIso8601String(),
            'editedAt' => $this->edited_at?->toIso8601String(),
            'deleted' => $deleted,
            'isSelf' => $viewerId !== null && (int) $this->sender_id === (int) $viewerId,
            'replyTo' => $this->replyTo ? [
                'id' => (string) $this->replyTo->id,
                'senderName' => $this->replyTo->sender?->name ?? 'Usuario',
                'content' => $this->replyTo->trashed() ? null : Str::limit((string) $this->replyTo->content, 120),
                'hasAttachment' => ! $this->replyTo->trashed() && $this->replyTo->attachment_path !== null,
                'deleted' => $this->replyTo->trashed(),
            ] : null,
            'attachment' => ! $deleted && $this->attachment_path ? [
                'name' => $this->attachment_name,
                'mime' => $this->attachment_mime,
                'size' => $this->attachment_size,
                'isImage' => $this->isImage(),
            ] : null,
            'reactions' => $this->reactions
                ->groupBy('emoji')
                ->map(fn ($group, $emoji) => [
                    'emoji' => (string) $emoji,
                    'count' => $group->count(),
                    'mine' => $viewerId !== null && $group->contains(fn ($r) => (int) $r->user_id === (int) $viewerId),
                ])
                ->values()
                ->all(),
        ];
    }
}
