<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Resources\ConversationResource;
use App\Models\Conversation;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

class ConversationController extends Controller
{
    /** GET /api/conversations */
    public function index(): AnonymousResourceCollection
    {
        $conversations = Conversation::query()
            ->where('owner_id', config('chat.self_user_id'))
            ->with(['contact', 'latestMessage'])
            ->orderByDesc('updated_at')
            ->get();

        return ConversationResource::collection($conversations);
    }

    /** GET /api/conversations/{conversation} */
    public function show(Conversation $conversation): ConversationResource
    {
        abort_unless((int) $conversation->owner_id === (int) config('chat.self_user_id'), 404);

        return new ConversationResource($conversation->load(['contact', 'latestMessage']));
    }
}
