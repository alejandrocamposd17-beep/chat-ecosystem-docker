<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Resources\MessageResource;
use App\Models\Conversation;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Support\Facades\Cache;

class MessageController extends Controller
{
    /** GET /api/conversations/{conversation}/messages?before={id} (de 50 en 50) */
    public function index(Request $request, Conversation $conversation): AnonymousResourceCollection
    {
        $this->authorizeParticipant($request, $conversation);

        $before = (int) $request->query('before', 0);

        $messages = $conversation->messages()
            ->when($before > 0, fn ($q) => $q->where('id', '<', $before))
            ->orderByDesc('id')
            ->limit(50)
            ->get()
            ->reverse()
            ->values();

        return MessageResource::collection($messages);
    }

    /** POST /api/conversations/{conversation}/messages */
    public function store(Request $request, Conversation $conversation): JsonResponse
    {
        $this->authorizeParticipant($request, $conversation);

        $data = $request->validate([
            'content' => ['required', 'string', 'max:2000'],
        ]);

        $content = trim($data['content']);
        abort_if($content === '', 422, 'El mensaje no puede estar vacío.');

        $message = $conversation->messages()->create([
            'sender_id' => $request->user()->id,
            'content' => $content,
        ]);

        // Quien envía ya leyó la conversación y deja de estar "escribiendo"
        $conversation->markReadBy($request->user());
        Cache::forget(ConversationController::typingKey($conversation->id, $request->user()->id));

        return (new MessageResource($message))->response()->setStatusCode(201);
    }

    private function authorizeParticipant(Request $request, Conversation $conversation): void
    {
        abort_unless($conversation->hasParticipant($request->user()), 404);
    }
}
