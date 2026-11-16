<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Concerns\AuthorizesParticipant;
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
    use AuthorizesParticipant;

    /** GET /api/conversations */
    public function index(Request $request): AnonymousResourceCollection
    {
        $conversations = Conversation::query()
            ->forUser($request->user())
            ->with(['participants', 'latestMessage.sender'])
            ->withUnreadCountFor($request->user())
            ->orderByDesc('updated_at')
            ->get();

        return ConversationResource::collection($conversations);
    }

    /**
     * POST /api/conversations
     * - Chat directo: { "userId": 2 } (abre o reutiliza el existente)
     * - Grupo: { "name": "Equipo", "userIds": [2, 3] }
     */
    public function store(Request $request): JsonResponse
    {
        $me = $request->user();

        if ($request->has('userIds') || $request->has('name')) {
            $data = $request->validate([
                'name' => ['required', 'string', 'min:2', 'max:80'],
                'userIds' => ['required', 'array', 'min:1', 'max:'.config('chat.max_group_members')],
                'userIds.*' => ['integer', 'distinct', 'exists:users,id'],
            ]);

            $members = User::whereKey($data['userIds'])->whereKeyNot($me->id)->get();
            abort_if($members->isEmpty(), 422, 'Agrega al menos a otra persona al grupo.');

            $group = Conversation::createGroup($me, trim($data['name']), $members);

            return (new ConversationResource($this->loadFor($group, $me)))->response()->setStatusCode(201);
        }

        $data = $request->validate([
            'userId' => ['required', 'integer', 'exists:users,id', 'not_in:'.$me->id],
        ], [
            'userId.not_in' => 'No puedes iniciar un chat contigo mismo.',
        ]);

        $conversation = Conversation::between($me, User::findOrFail($data['userId']));

        return (new ConversationResource($this->loadFor($conversation, $me)))
            ->response()
            ->setStatusCode($conversation->wasRecentlyCreated ? 201 : 200);
    }

    /** GET /api/conversations/{conversation} */
    public function show(Request $request, Conversation $conversation): ConversationResource
    {
        $this->authorizeParticipant($request->user(), $conversation);

        return new ConversationResource($this->loadFor($conversation, $request->user()));
    }

    /** PATCH /api/conversations/{conversation}: renombrar un grupo (solo administradores) */
    public function update(Request $request, Conversation $conversation): ConversationResource
    {
        $me = $request->user();
        $this->authorizeParticipant($me, $conversation);
        abort_unless($conversation->isGroup(), 422, 'Solo los grupos tienen nombre.');
        abort_unless($conversation->isAdmin($me), 403, 'Solo un administrador puede cambiar el nombre.');

        $data = $request->validate(['name' => ['required', 'string', 'min:2', 'max:80']]);
        $name = trim($data['name']);

        if ($name !== $conversation->name) {
            $conversation->update(['name' => $name]);
            $conversation->systemMessage($me, "{$me->name} cambió el nombre del grupo a «{$name}»");
        }

        return new ConversationResource($this->loadFor($conversation, $me));
    }

    /** POST /api/conversations/{conversation}/read */
    public function read(Request $request, Conversation $conversation): JsonResponse
    {
        $this->authorizeParticipant($request->user(), $conversation);
        $conversation->markReadBy($request->user());

        return response()->json(['readAt' => now()->toIso8601String()]);
    }

    /** POST /api/conversations/{conversation}/typing: aviso temporal de "escribiendo..." */
    public function typing(Request $request, Conversation $conversation): JsonResponse
    {
        $this->authorizeParticipant($request->user(), $conversation);

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

    public static function loadFor(Conversation $conversation, User $user): Conversation
    {
        return Conversation::query()
            ->whereKey($conversation->id)
            ->with(['participants', 'latestMessage.sender'])
            ->withUnreadCountFor($user)
            ->firstOrFail();
    }
}
