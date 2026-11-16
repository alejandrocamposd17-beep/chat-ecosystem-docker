<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Resources\ConversationResource;
use App\Models\Conversation;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Support\Facades\Cache;

class ConversationController extends Controller
{
    /** GET /api/conversations */
    public function index(Request $request): AnonymousResourceCollection
    {
        $conversations = Conversation::query()
            ->forUser($request->user())
            ->with(['participants', 'latestMessage'])
            ->withUnreadCountFor($request->user())
            ->orderByDesc('updated_at')
            ->get();

        return ConversationResource::collection($conversations);
    }

    /** POST /api/conversations: abre (o reutiliza) el chat con otro usuario */
    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'userId' => ['required', 'integer', 'exists:users,id', 'not_in:'.$request->user()->id],
        ], [
            'userId.not_in' => 'No puedes iniciar un chat contigo mismo.',
        ]);

        $other = User::findOrFail($data['userId']);
        $conversation = Conversation::between($request->user(), $other);

        return (new ConversationResource($this->loadFor($conversation, $request->user())))
            ->response()
            ->setStatusCode($conversation->wasRecentlyCreated ? 201 : 200);
    }

    /** GET /api/conversations/{conversation} */
    public function show(Request $request, Conversation $conversation): ConversationResource
    {
        $this->authorizeParticipant($request, $conversation);

        return new ConversationResource($this->loadFor($conversation, $request->user()));
    }

    /** POST /api/conversations/{conversation}/read */
    public function read(Request $request, Conversation $conversation): JsonResponse
    {
        $this->authorizeParticipant($request, $conversation);
        $conversation->markReadBy($request->user());

        return response()->json(['readAt' => now()->toIso8601String()]);
    }

    /** POST /api/conversations/{conversation}/typing: aviso temporal de "escribiendo..." */
    public function typing(Request $request, Conversation $conversation): JsonResponse
    {
        $this->authorizeParticipant($request, $conversation);

        Cache::put(
            self::typingKey($conversation->id, $request->user()->id),
            now()->getTimestamp(),
            (int) config('chat.typing_ttl_seconds'),
        );

        return response()->json(['ok' => true]);
    }

    public static function typingKey(int $conversationId, int $userId): string
    {
        return "chat:typing:{$conversationId}:{$userId}";
    }

    private function loadFor(Conversation $conversation, User $user): Conversation
    {
        return Conversation::query()
            ->whereKey($conversation->id)
            ->with(['participants', 'latestMessage'])
            ->withUnreadCountFor($user)
            ->firstOrFail();
    }

    private function authorizeParticipant(Request $request, Conversation $conversation): void
    {
        // 404 en lugar de 403: no se revela que la conversación existe
        abort_unless($conversation->hasParticipant($request->user()), 404);
    }
}
