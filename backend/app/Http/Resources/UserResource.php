<?php

namespace App\Http\Resources;

use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * Forma: interface User del frontend
 *
 * @mixin User
 */
class UserResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => (string) $this->id,
            'name' => $this->name,
            'avatarUrl' => $this->avatar_url ?? '',
            // Con foto subida, el frontend la pide a /api/avatar?id=...&v=... (la versión evita la caché vieja)
            'avatarVersion' => $this->avatar_path ? $this->updated_at?->getTimestamp() : null,
            'isGuest' => (bool) $this->is_guest,
            'status' => $this->presence(),
            'lastSeenAt' => $this->last_seen_at?->toIso8601String(),
        ];
    }
}
