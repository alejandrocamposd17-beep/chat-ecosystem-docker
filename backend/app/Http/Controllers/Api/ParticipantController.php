<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Concerns\AuthorizesParticipant;
use App\Http\Controllers\Controller;
use App\Http\Resources\ConversationResource;
use App\Models\Conversation;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;

/** Miembros de un grupo: agregar, quitar y salir. */
class ParticipantController extends Controller
{
    use AuthorizesParticipant;

    /** POST /api/conversations/{conversation}/participants { "userId": 5 } (solo administradores) */
    public function store(Request $request, Conversation $conversation): ConversationResource
    {
        $me = $request->user();
        $this->authorizeGroupAdmin($me, $conversation);

        $data = $request->validate(['userId' => ['required', 'integer', 'exists:users,id']]);
        $user = User::findOrFail($data['userId']);

        abort_if($conversation->hasParticipant($user), 422, "{$user->name} ya está en el grupo.");
        abort_if(
            $conversation->participants()->count() >= (int) config('chat.max_group_members'),
            422,
            'El grupo alcanzó el máximo de integrantes.',
        );

        $conversation->participants()->attach($user->id, ['role' => Conversation::ROLE_MEMBER, 'last_read_at' => null]);
        $conversation->systemMessage($me, "{$me->name} agregó a {$user->name}");

        return new ConversationResource(ConversationController::loadFor($conversation, $me));
    }

    /**
     * DELETE /api/conversations/{conversation}/participants/{user}
     * Un administrador puede quitar a otros; cualquiera puede salir quitándose a sí mismo.
     */
    public function destroy(Request $request, Conversation $conversation, User $user): JsonResponse
    {
        $me = $request->user();
        $this->authorizeParticipant($me, $conversation);
        abort_unless($conversation->isGroup(), 422, 'Solo se puede salir de un grupo.');

        $leaving = (int) $user->id === (int) $me->id;
        abort_unless($leaving || $conversation->isAdmin($me), 403, 'Solo un administrador puede quitar integrantes.');
        abort_unless($conversation->hasParticipant($user), 404);

        DB::transaction(function () use ($conversation, $me, $user, $leaving) {
            $conversation->systemMessage($me, $leaving ? "{$me->name} salió del grupo" : "{$me->name} quitó a {$user->name}");
            $conversation->participants()->detach($user->id);

            $remaining = $conversation->participants()->orderBy('conversation_participants.created_at')->get();

            // Sin integrantes el grupo se elimina; sin administradores, el integrante más antiguo pasa a serlo
            if ($remaining->isEmpty()) {
                Storage::disk('local')->deleteDirectory("attachments/{$conversation->id}");
                $conversation->delete();
            } elseif (! $remaining->contains(fn (User $p) => $p->pivot->role === Conversation::ROLE_ADMIN)) {
                $conversation->participants()->updateExistingPivot($remaining->first()->id, ['role' => Conversation::ROLE_ADMIN]);
            }
        });

        return response()->json(['ok' => true]);
    }

    private function authorizeGroupAdmin(User $me, Conversation $conversation): void
    {
        $this->authorizeParticipant($me, $conversation);
        abort_unless($conversation->isGroup(), 422, 'Solo los grupos tienen integrantes que se puedan administrar.');
        abort_unless($conversation->isAdmin($me), 403, 'Solo un administrador puede agregar integrantes.');
    }
}
