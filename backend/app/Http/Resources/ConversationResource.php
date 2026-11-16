<?php

namespace App\Http\Resources;

use App\Models\Conversation;
use App\Models\Message;
use App\Models\User;
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
        $isGroup = $this->isGroup();
        $other = $isGroup ? null : $this->otherParticipant($viewerId);
        $me = $this->participants->first(fn (User $p) => (int) $p->id === $viewerId);
        $last = $this->latestMessage;

        return [
            'id' => (string) $this->id,
            'type' => $isGroup ? Conversation::TYPE_GROUP : Conversation::TYPE_DIRECT,
            'name' => $isGroup ? $this->name : ($other?->name ?? 'Usuario'),
            'user' => $other ? new UserResource($other) : null,
            'participants' => UserResource::collection($this->participants->values()),
            'myRole' => $me?->pivot?->role ?? Conversation::ROLE_MEMBER,
            'lastMessage' => $this->preview($last),
            'lastMessageIsSelf' => $last ? (int) $last->sender_id === $viewerId && $last->kind !== Message::KIND_SYSTEM : false,
            'lastMessageSender' => $last && $isGroup && $last->kind !== Message::KIND_SYSTEM ? $last->sender?->name : null,
            'updatedAt' => $this->updated_at?->toIso8601String(),
            'unreadCount' => (int) ($this->unread_count ?? 0),
            // Hasta cuándo leyó cada otro participante: el frontend marca "Visto" cuando todos leyeron
            'readStates' => $this->participants
                ->filter(fn (User $p) => (int) $p->id !== $viewerId)
                ->map(fn (User $p) => [
                    'userId' => (string) $p->id,
                    'lastReadAt' => $p->pivot?->last_read_at ? Carbon::parse($p->pivot->last_read_at)->toIso8601String() : null,
                ])
                ->values()
                ->all(),
        ];
    }

    private function preview(?Message $message): string
    {
        if (! $message) {
            return '';
        }
        if ($message->trashed()) {
            return 'Mensaje eliminado';
        }
        if ($message->content) {
            return $message->content;
        }

        return $message->attachment_path ? ($message->isImage() ? '📷 Foto' : '📎 '.$message->attachment_name) : '';
    }
}
