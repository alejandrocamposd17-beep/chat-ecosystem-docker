<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** Forma: interface Message del frontend */
class MessageResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => (string) $this->id,
            'chatId' => (string) $this->conversation_id,
            'senderId' => (string) $this->sender_id,
            'content' => $this->content,
            'createdAt' => $this->created_at?->toIso8601String(),
            'isSelf' => (int) $this->sender_id === (int) config('chat.self_user_id'),
        ];
    }
}
