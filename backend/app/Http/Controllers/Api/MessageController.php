<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Concerns\AuthorizesParticipant;
use App\Http\Controllers\Controller;
use App\Http\Resources\MessageResource;
use App\Models\Conversation;
use App\Models\Message;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

class MessageController extends Controller
{
    use AuthorizesParticipant;

    /**
     * GET /api/conversations/{conversation}/messages
     * - ?before={id}: página anterior (de 50 en 50)
     * - ?search=texto: búsqueda dentro de la conversación (hasta 50 resultados, del más reciente)
     */
    public function index(Request $request, Conversation $conversation): AnonymousResourceCollection
    {
        $this->authorizeParticipant($request->user(), $conversation);

        $search = mb_substr(trim((string) $request->query('search', '')), 0, 100);
        $before = (int) $request->query('before', 0);

        $messages = $conversation->messages()
            ->withTrashed()
            ->with(['sender', 'reactions', 'replyTo.sender'])
            ->when($search !== '', function ($q) use ($search) {
                $like = '%'.str_replace(['\\', '%', '_'], ['\\\\', '\\%', '\\_'], $search).'%';
                $q->whereNull('deleted_at')
                    ->where('kind', Message::KIND_USER)
                    ->where(fn ($w) => $w->where('content', 'like', $like)->orWhere('attachment_name', 'like', $like));
            })
            ->when($before > 0, fn ($q) => $q->where('id', '<', $before))
            ->orderByDesc('id')
            ->limit(50)
            ->get()
            ->reverse()
            ->values();

        return MessageResource::collection($messages);
    }

    /**
     * POST /api/conversations/{conversation}/messages (JSON o multipart)
     * content (texto), attachment (archivo opcional) y replyToId (opcional).
     */
    public function store(Request $request, Conversation $conversation): JsonResponse
    {
        $me = $request->user();
        $this->authorizeParticipant($me, $conversation);

        $data = $request->validate([
            'content' => ['nullable', 'string', 'max:2000', 'required_without:attachment'],
            'attachment' => [
                'nullable', 'file', 'max:'.config('chat.max_attachment_kb'),
                // Se valida el tipo real del archivo (no solo la extensión). Sin SVG ni HTML: podrían ejecutar código
                'mimes:'.implode(',', config('chat.attachment_extensions')),
            ],
            'replyToId' => ['nullable', 'integer'],
        ], [
            'content.required_without' => 'Escribe un mensaje o adjunta un archivo.',
            'attachment.max' => 'El archivo no puede pesar más de '.(int) (config('chat.max_attachment_kb') / 1024).' MB.',
            'attachment.mimes' => 'Tipo de archivo no permitido.',
        ]);

        $content = isset($data['content']) ? trim($data['content']) : null;
        $file = $request->file('attachment');
        abort_if(($content === null || $content === '') && ! $file, 422, 'El mensaje no puede estar vacío.');

        $replyToId = null;
        if (! empty($data['replyToId'])) {
            // Solo se puede responder a mensajes de la misma conversación
            $replyToId = $conversation->messages()->withTrashed()->whereKey($data['replyToId'])->value('id');
            abort_if($replyToId === null, 422, 'El mensaje al que respondes no existe en esta conversación.');
        }

        $attachment = [];
        if ($file) {
            $attachment = [
                // Nombre aleatorio en disco privado: no se puede adivinar ni acceder sin permiso
                'attachment_path' => $file->store("attachments/{$conversation->id}", 'local'),
                'attachment_name' => self::safeFileName($file->getClientOriginalName()),
                'attachment_mime' => $file->getMimeType(),
                'attachment_size' => $file->getSize(),
            ];
        }

        $message = $conversation->messages()->create([
            'sender_id' => $me->id,
            'kind' => Message::KIND_USER,
            'reply_to_id' => $replyToId,
            'content' => $content !== '' ? $content : null,
            ...$attachment,
        ]);

        // Quien envía ya leyó la conversación y deja de estar "escribiendo"
        $conversation->markReadBy($me);
        Cache::forget(ConversationController::typingKey($conversation->id, $me->id));

        return (new MessageResource($message))->response()->setStatusCode(201);
    }

    /** PATCH /api/conversations/{conversation}/messages/{message}: editar un mensaje propio */
    public function update(Request $request, Conversation $conversation, Message $message): MessageResource
    {
        $this->authorizeOwnMessage($request, $conversation, $message);

        $data = $request->validate(['content' => ['present', 'nullable', 'string', 'max:2000']]);
        $content = trim((string) $data['content']);
        abort_if($content === '' && ! $message->attachment_path, 422, 'El mensaje no puede quedar vacío.');

        if ($content !== (string) $message->content) {
            $message->update(['content' => $content !== '' ? $content : null, 'edited_at' => now()]);
        }

        return new MessageResource($message->fresh());
    }

    /** DELETE /api/conversations/{conversation}/messages/{message}: eliminar un mensaje propio */
    public function destroy(Request $request, Conversation $conversation, Message $message): MessageResource
    {
        $this->authorizeOwnMessage($request, $conversation, $message);
        $message->eraseAndDelete();

        return new MessageResource(Message::withTrashed()->findOrFail($message->id));
    }

    private function authorizeOwnMessage(Request $request, Conversation $conversation, Message $message): void
    {
        $this->authorizeParticipant($request->user(), $conversation);
        abort_unless((int) $message->conversation_id === (int) $conversation->id, 404);
        abort_unless(
            (int) $message->sender_id === (int) $request->user()->id && $message->kind === Message::KIND_USER,
            403,
            'Solo puedes modificar tus propios mensajes.',
        );
    }

    /** Nombre seguro para mostrar: sin rutas ni caracteres de control, máximo 120 caracteres. */
    public static function safeFileName(string $name): string
    {
        $name = basename(str_replace('\\', '/', $name));
        $name = (string) preg_replace('/[\x00-\x1F\x7F"<>]/u', '', $name);

        return Str::limit($name !== '' ? $name : 'archivo', 120, '');
    }

    /** GET /api/attachments/{message}: descarga el adjunto (solo participantes) */
    public function attachment(Request $request, Message $message)
    {
        $this->authorizeParticipant($request->user(), $message->conversation);
        abort_unless($message->attachment_path && Storage::disk('local')->exists($message->attachment_path), 404);

        $inline = $message->isImage();

        return Storage::disk('local')->response($message->attachment_path, $message->attachment_name, [
            'Content-Type' => $message->attachment_mime,
            'Content-Disposition' => ($inline ? 'inline' : 'attachment').'; filename="'.addcslashes((string) $message->attachment_name, '"\\').'"',
            // El archivo nunca se interpreta como HTML ni ejecuta scripts
            'X-Content-Type-Options' => 'nosniff',
            'Content-Security-Policy' => "default-src 'none'; img-src 'self'; style-src 'unsafe-inline'; sandbox",
            'Cache-Control' => 'private, max-age=3600',
        ]);
    }
}
