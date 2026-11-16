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
 * Eventos: message (mensaje nuevo), typing (escribiendo...) y read (confirmación de lectura).
 * Solo se envían eventos de conversaciones en las que participa el usuario.
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
            $cursor = (int) Message::whereIn('conversation_id', $this->conversationIds($user))->max('id');
        }

        $seconds = max(0, (int) config('chat.stream_seconds'));
        $pollMicros = max(200, (int) config('chat.stream_poll_ms')) * 1000;

        return response()->stream(function () use ($user, $cursor, $seconds, $pollMicros) {
            @set_time_limit($seconds + 15);

            $deadline = microtime(true) + $seconds;
            $lastBeat = microtime(true);
            $reads = null;
            $typing = [];

            $this->send("retry: 2000\n\n");

            do {
                $user->touchPresence();
                $conversationIds = $this->conversationIds($user);

                // 1) Mensajes nuevos
                $messages = Message::whereIn('conversation_id', $conversationIds)
                    ->where('id', '>', $cursor)
                    ->orderBy('id')
                    ->limit(100)
                    ->get();

                foreach ($messages as $message) {
                    $payload = (new MessageResource($message))->forViewer($user->id)->resolve();
                    $this->event('message', $payload, (string) $message->id);
                    $cursor = $message->id;
                }

                // 2) Lecturas y "escribiendo..." de los otros participantes
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

    /** @return list<int> */
    private function conversationIds(User $user): array
    {
        return DB::table('conversation_participants')
            ->where('user_id', $user->id)
            ->pluck('conversation_id')
            ->map(fn ($id) => (int) $id)
            ->all();
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
