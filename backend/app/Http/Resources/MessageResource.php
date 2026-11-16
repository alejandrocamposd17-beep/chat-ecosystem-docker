<?php

namespace App\Http\Resources;

use App\Models\Message;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * Forma: interface Message del frontend
 *
 * @mixin Message
 */
class MessageResource extends JsonResource
{
    /** Usuario para el que se calcula isSelf (por defecto, el autenticado) */
    public ?int $viewerId = null;

    public function forViewer(int $userId): static
    {
        $this->viewerId = $userId;

        return $this;
    }

    public function toArray(Request $request): array
    {
        $viewerId = $this->viewerId ?? $request->user()?->id;

        return [
            'id' => (string) $this->id,
            'chatId' => (string) $this->conversation_id,
            'senderId' => (string) $this->sender_id,
            'content' => $this->content,
            'createdAt' => $this->created_at?->toIso8601String(),
            'isSelf' => $viewerId !== null && (int) $this->sender_id === (int) $viewerId,
        ];
    }
}
