<?php

namespace App\Http\Controllers\Concerns;

use App\Models\Conversation;
use App\Models\User;

trait AuthorizesParticipant
{
    /** 404 en lugar de 403: no se revela que la conversación existe */
    protected function authorizeParticipant(User $user, Conversation $conversation): void
    {
        abort_unless($conversation->hasParticipant($user), 404);
    }
}
