<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Resources\MessageResource;
use App\Models\Conversation;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

class MessageController extends Controller
{
    /** GET /api/conversations/{conversation}/messages */
    public function index(Conversation $conversation): AnonymousResourceCollection
    {
        $this->authorizeOwner($conversation);

        $messages = $conversation->messages()
            ->latest()
            ->limit(100)
            ->get()
            ->reverse()
            ->values();

        return MessageResource::collection($messages);
    }

    /** POST /api/conversations/{conversation}/messages */
    public function store(Request $request, Conversation $conversation): JsonResponse
    {
        $this->authorizeOwner($conversation);

        $data = $request->validate([
            'content' => ['required', 'string', 'max:2000'],
        ]);

        $message = $conversation->messages()->create([
            'sender_id' => config('chat.self_user_id'),
            'content' => trim($data['content']),
        ]);

        return (new MessageResource($message))->response()->setStatusCode(201);
    }

    private function authorizeOwner(Conversation $conversation): void
    {
        abort_unless((int) $conversation->owner_id === (int) config('chat.self_user_id'), 404);
    }
}
