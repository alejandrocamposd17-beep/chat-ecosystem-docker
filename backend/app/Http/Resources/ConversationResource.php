<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** Forma: interface Conversation del frontend */
class ConversationResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => (string) $this->id,
            'user' => new UserResource($this->contact),
            'lastMessage' => $this->latestMessage?->content ?? '',
            'updatedAt' => $this->updated_at?->toIso8601String(),
        ];
    }
}
