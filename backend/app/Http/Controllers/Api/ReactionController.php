<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Concerns\AuthorizesParticipant;
use App\Http\Controllers\Controller;
use App\Http\Resources\MessageResource;
use App\Models\Conversation;
use App\Models\Message;
use App\Models\MessageReaction;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class ReactionController extends Controller
{
    use AuthorizesParticipant;

    /** POST /api/conversations/{conversation}/messages/{message}/reactions { "emoji": "👍" }: pone o quita la reacción */
    public function toggle(Request $request, Conversation $conversation, Message $message): MessageResource
    {
        $me = $request->user();
        $this->authorizeParticipant($me, $conversation);
        abort_unless((int) $message->conversation_id === (int) $conversation->id, 404);
        abort_if($message->kind === Message::KIND_SYSTEM, 422, 'No se puede reaccionar a este mensaje.');

        // Solo emojis de una lista fija: evita guardar texto arbitrario
        $data = $request->validate(['emoji' => ['required', 'string', Rule::in(config('chat.reactions'))]]);

        $existing = $message->reactions()->where('user_id', $me->id)->where('emoji', $data['emoji'])->first();
        if ($existing) {
            $existing->delete();
        } else {
            MessageReaction::create(['message_id' => $message->id, 'user_id' => $me->id, 'emoji' => $data['emoji']]);
        }

        return new MessageResource($message->fresh());
    }
}
