<?php

namespace App\Http\Resources;

use App\Models\Conversation;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;
use Illuminate\Support\Carbon;

/**
 * Forma: interface Conversation del frontend
 *
 * @mixin Conversation
 */
class ConversationResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        $viewerId = (int) $request->user()?->id;
        $other = $this->otherParticipant($viewerId);
        $otherReadAt = $other?->pivot?->last_read_at;

        return [
            'id' => (string) $this->id,
            'user' => $other ? new UserResource($other) : null,
            'lastMessage' => $this->latestMessage?->content ?? '',
            'lastMessageIsSelf' => $this->latestMessage ? (int) $this->latestMessage->sender_id === $viewerId : false,
            'updatedAt' => $this->updated_at?->toIso8601String(),
            'unreadCount' => (int) ($this->unread_count ?? 0),
            // Hasta cuándo leyó el otro participante: el frontend marca "Visto" en los mensajes anteriores
            'otherLastReadAt' => $otherReadAt ? Carbon::parse($otherReadAt)->toIso8601String() : null,
        ];
    }
}
