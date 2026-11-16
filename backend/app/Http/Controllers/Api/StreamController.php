<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Resources\MessageResource;
use App\Models\Message;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Symfony\Component\HttpFoundation\StreamedResponse;

/**
 * GET /api/stream: eventos en tiempo real con Server-Sent Events (SSE).
 *
 * Cada conexión dura unos segundos (config chat.stream_seconds) y el navegador se
 * reconecta solo enviando Last-Event-ID, así no se pierde ningún mensaje.
 *
 * Eventos (solo de conversaciones en las que participa el usuario):
 * - message: mensaje nuevo
 * - message_updated: mensaje editado, eliminado o con reacciones nuevas
 * - typing: alguien está escribiendo
 * - read: alguien leyó la conversación
 * - presence: un contacto se conectó o se desconectó
 * - conversations: cambió la lista de chats (grupo nuevo, renombrado o con otros integrantes)
 */
class StreamController extends Controller
{
    public function __invoke(Request $request): StreamedResponse
    {
        /** @var User $user */
        $user = $request->user();
        $cursor = (int) ($request->header('Last-Event-ID') ?: $request->query('lastEventId', 0));

        // Primera conexión: solo interesan los mensajes que lleguen desde ahora
        if ($cursor <= 0) {
            $cursor = (int) Message::withTrashed()->whereIn('conversation_id', $this->conversationIds($user))->max('id');
        }

        $seconds = max(0, (int) config('chat.stream_seconds'));
        $pollMicros = max(200, (int) config('chat.stream_poll_ms')) * 1000;
        $presenceEvery = max(1, (int) config('chat.presence_interval_seconds'));

        return response()->stream(function () use ($user, $cursor, $seconds, $pollMicros, $presenceEvery) {
            @set_time_limit($seconds + 15);

            $deadline = microtime(true) + $seconds;
            $lastBeat = microtime(true);
            $lastPresence = 0.0;
            // Los cambios se buscan desde unos segundos antes de conectar, para no perder los que
            // ocurrieron mientras el navegador se reconectaba (las marcas de tiempo son por segundo)
            $updatesSince = now()->subSeconds(5)->format('Y-m-d H:i:s');
            $sentVersions = [];
            $reads = null;
            $typing = [];
            $presence = null;
            $signature = null;

            $this->send("retry: 2000\n\n");

            do {
                $user->touchPresence();
                $conversationIds = $this->conversationIds($user);

                // 1) Mensajes nuevos
                $messages = Message::withTrashed()
                    ->whereIn('conversation_id', $conversationIds)
                    ->where('id', '>', $cursor)
                    ->orderBy('id')
                    ->limit(100)
                    ->get();

                foreach ($messages as $message) {
                    $this->event('message', $this->payload($message, $user), (string) $message->id);
                    $sentVersions[$message->id] = (string) $message->updated_at;
                    $cursor = $message->id;
                }

                // 2) Mensajes ya enviados que cambiaron (edición, borrado o reacciones)
                $updated = Message::withTrashed()
                    ->whereIn('conversation_id', $conversationIds)
                    ->where('id', '<=', $cursor)
                    ->where('updated_at', '>=', $updatesSince)
                    ->orderBy('id')
                    ->limit(100)
                    ->get();

                foreach ($updated as $message) {
                    $version = (string) $message->updated_at;
                    // Un mensaje recién creado no cambió (updated_at = created_at): ya llegó como "message"
                    $modified = $message->updated_at && $message->created_at && $message->updated_at->ne($message->created_at);
                    if ($modified && ($sentVersions[$message->id] ?? null) !== $version) {
                        $sentVersions[$message->id] = $version;
                        $this->event('message_updated', $this->payload($message, $user));
                    }
                }

                // 3) Lecturas y "escribiendo..." de los demás participantes
                $others = DB::table('conversation_participants')
                    ->whereIn('conversation_id', $conversationIds)
                    ->where('user_id', '!=', $user->id)
                    ->get(['conversation_id', 'user_id', 'last_read_at']);

                $currentReads = [];
                foreach ($others as $row) {
                    $key = $row->conversation_id.':'.$row->user_id;
                    $currentReads[$key] = $row->last_read_at;

                    if ($reads !== null && $row->last_read_at && ($reads[$key] ?? null) !== $row->last_read_at) {
                        $this->event('read', [
                            'chatId' => (string) $row->conversation_id,
                            'userId' => (string) $row->user_id,
                            'readAt' => Carbon::parse($row->last_read_at)->toIso8601String(),
                        ]);
                    }

                    $isTyping = Cache::has(ConversationController::typingKey((int) $row->conversation_id, (int) $row->user_id));
                    if (($typing[$key] ?? false) !== $isTyping) {
                        // El primer ciclo solo informa a quienes ya están escribiendo
                        if ($isTyping || isset($typing[$key])) {
                            $this->event('typing', [
                                'chatId' => (string) $row->conversation_id,
                                'userId' => (string) $row->user_id,
                                'typing' => $isTyping,
                            ]);
                        }
                        $typing[$key] = $isTyping;
                    }
                }
                $reads = $currentReads;

                // 4) Cambios en la lista de chats (grupos nuevos, renombrados o con otros integrantes)
                $currentSignature = $this->conversationsSignature($conversationIds);
                if ($signature !== null && $currentSignature !== $signature) {
                    $this->event('conversations', ['changed' => true]);
                }
                $signature = $currentSignature;

                // 5) Presencia de los contactos (cada pocos segundos)
                if (microtime(true) - $lastPresence >= $presenceEvery) {
                    $lastPresence = microtime(true);
                    $contactIds = $others->pluck('user_id')->unique()->all();
                    $current = [];
                    foreach (User::whereKey($contactIds)->get() as $contact) {
                        $current[$contact->id] = $contact->presence();
                        if ($presence !== null && ($presence[$contact->id] ?? null) !== $current[$contact->id]) {
                            $this->event('presence', [
                                'userId' => (string) $contact->id,
                                'status' => $current[$contact->id],
                                'lastSeenAt' => $contact->last_seen_at?->toIso8601String(),
                            ]);
                        }
                    }
                    $presence = $current;
                }

                // Comentario cada 15 s para que proxies y balanceadores no cierren la conexión
                if (microtime(true) - $lastBeat >= 15) {
                    $this->send(": ping\n\n");
                    $lastBeat = microtime(true);
                }

                if (connection_aborted() || microtime(true) >= $deadline) {
                    break;
                }

                usleep($pollMicros);
            } while (true);
        }, 200, [
            'Content-Type' => 'text/event-stream',
            'Cache-Control' => 'no-cache, no-transform',
            'Connection' => 'keep-alive',
            // Nginx no debe acumular la respuesta: cada evento sale de inmediato
            'X-Accel-Buffering' => 'no',
        ]);
    }

    /** @return array<string, mixed> */
    private function payload(Message $message, User $user): array
    {
        return (new MessageResource($message))->forViewer($user->id)->resolve();
    }

    /** @return list<int> */
    private function conversationIds(User $user): array
    {
        return DB::table('conversation_participants')
            ->where('user_id', $user->id)
            ->pluck('conversation_id')
            ->map(fn ($id) => (int) $id)
            ->all();
    }

    /** @param  list<int>  $conversationIds */
    private function conversationsSignature(array $conversationIds): string
    {
        $names = DB::table('conversations')->whereIn('id', $conversationIds)->orderBy('id')->pluck('name', 'id')->all();
        $members = DB::table('conversation_participants')
            ->whereIn('conversation_id', $conversationIds)
            ->selectRaw('conversation_id, COUNT(*) as total')
            ->groupBy('conversation_id')
            ->orderBy('conversation_id')
            ->pluck('total', 'conversation_id')
            ->all();

        return md5(json_encode([$names, $members]));
    }

    /** @param  array<string, mixed>  $data */
    private function event(string $name, array $data, ?string $id = null): void
    {
        $out = ($id !== null ? "id: {$id}\n" : '')."event: {$name}\ndata: ".json_encode($data, JSON_UNESCAPED_UNICODE)."\n\n";
        $this->send($out);
    }

    private function send(string $chunk): void
    {
        echo $chunk;

        // En las pruebas la salida se captura con un buffer: no se vacía hacia la consola
        if (! app()->runningUnitTests()) {
            if (ob_get_level() > 0) {
                @ob_flush();
            }
            flush();
        }
    }
}
