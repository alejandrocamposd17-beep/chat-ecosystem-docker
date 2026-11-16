<?php

namespace Tests\Feature;

use App\Http\Controllers\Api\MessageController;
use App\Models\Conversation;
use App\Models\Message;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

class MessageFeaturesTest extends TestCase
{
    use RefreshDatabase;

    private User $ana;

    private User $beto;

    private Conversation $chat;

    protected function setUp(): void
    {
        parent::setUp();
        Storage::fake('local');
        [$this->ana, $this->beto] = User::factory()->count(2)->create();
        $this->chat = Conversation::between($this->ana, $this->beto);
    }

    private function send(User $user, array $data)
    {
        return $this->actingAs($user, 'api')->post("/api/conversations/{$this->chat->id}/messages", $data, ['Accept' => 'application/json']);
    }

    public function test_image_attachment_is_stored_privately_and_served_to_participants_only(): void
    {
        $response = $this->send($this->ana, ['attachment' => UploadedFile::fake()->image('foto.png', 40, 40)])
            ->assertCreated()
            ->assertJsonPath('attachment.name', 'foto.png')
            ->assertJsonPath('attachment.isImage', true)
            ->assertJsonPath('content', null);

        $message = Message::findOrFail($response->json('id'));
        Storage::disk('local')->assertExists($message->attachment_path);
        $this->assertStringStartsWith("attachments/{$this->chat->id}/", $message->attachment_path);
        $this->assertNotSame('foto.png', basename($message->attachment_path));

        $this->actingAs($this->beto, 'api')->get("/api/attachments/{$message->id}")
            ->assertOk()
            ->assertHeader('X-Content-Type-Options', 'nosniff');

        $outsider = User::factory()->create();
        $this->actingAs($outsider, 'api')->getJson("/api/attachments/{$message->id}")->assertNotFound();
    }

    public function test_documents_are_downloaded_and_dangerous_files_are_rejected(): void
    {
        $doc = $this->send($this->ana, [
            'content' => 'El informe',
            'attachment' => UploadedFile::fake()->create('informe.pdf', 100, 'application/pdf'),
        ])->assertCreated()->assertJsonPath('attachment.isImage', false);

        $download = $this->actingAs($this->beto, 'api')->get('/api/attachments/'.$doc->json('id'))->assertOk();
        $this->assertStringStartsWith('attachment', (string) $download->headers->get('Content-Disposition'));

        $svg = UploadedFile::fake()->createWithContent('logo.svg', '<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>');
        $this->send($this->ana, ['attachment' => $svg])->assertUnprocessable();

        $html = UploadedFile::fake()->createWithContent('pagina.html', '<html><script>alert(1)</script></html>');
        $this->send($this->ana, ['attachment' => $html])->assertUnprocessable();

        $big = UploadedFile::fake()->create('grande.pdf', 6000, 'application/pdf');
        $this->send($this->ana, ['attachment' => $big])->assertUnprocessable();
    }

    public function test_reply_to_a_message_of_the_same_conversation_only(): void
    {
        $original = $this->chat->messages()->create(['sender_id' => $this->beto->id, 'content' => '¿Nos vemos mañana?']);
        $other = Conversation::between($this->beto, User::factory()->create());
        $foreign = $other->messages()->create(['sender_id' => $this->beto->id, 'content' => 'secreto']);

        $this->send($this->ana, ['content' => 'Sí, a las 8', 'replyToId' => $original->id])
            ->assertCreated()
            ->assertJsonPath('replyTo.id', (string) $original->id)
            ->assertJsonPath('replyTo.content', '¿Nos vemos mañana?')
            ->assertJsonPath('replyTo.senderName', $this->beto->name);

        $this->send($this->ana, ['content' => 'curioso', 'replyToId' => $foreign->id])->assertUnprocessable();
    }

    public function test_only_the_author_can_edit_or_delete_a_message(): void
    {
        $id = $this->send($this->ana, ['content' => 'Hola Beto'])->json('id');

        $this->actingAs($this->beto, 'api')->patchJson("/api/conversations/{$this->chat->id}/messages/{$id}", ['content' => 'hackeado'])
            ->assertForbidden();
        $this->actingAs($this->beto, 'api')->deleteJson("/api/conversations/{$this->chat->id}/messages/{$id}")
            ->assertForbidden();

        $this->actingAs($this->ana, 'api')->patchJson("/api/conversations/{$this->chat->id}/messages/{$id}", ['content' => 'Hola Beto!'])
            ->assertOk()
            ->assertJsonPath('content', 'Hola Beto!')
            ->assertJsonPath('editedAt', fn ($value) => $value !== null);
    }

    public function test_deleting_a_message_erases_its_content_and_file(): void
    {
        $response = $this->send($this->ana, [
            'content' => 'mira esto',
            'attachment' => UploadedFile::fake()->image('privada.jpg'),
        ]);
        $message = Message::findOrFail($response->json('id'));
        $path = $message->attachment_path;

        $this->actingAs($this->ana, 'api')->deleteJson("/api/conversations/{$this->chat->id}/messages/{$message->id}")
            ->assertOk()
            ->assertJsonPath('deleted', true)
            ->assertJsonPath('content', null)
            ->assertJsonPath('attachment', null);

        Storage::disk('local')->assertMissing($path);
        $this->assertNull(Message::withTrashed()->find($message->id)->content);

        // En la conversación queda el aviso "Mensaje eliminado"
        $this->actingAs($this->beto, 'api')->getJson("/api/conversations/{$this->chat->id}/messages")
            ->assertJsonPath('0.deleted', true);
        $this->actingAs($this->beto, 'api')->getJson('/api/conversations')
            ->assertJsonPath('0.lastMessage', 'Mensaje eliminado');
    }

    public function test_reactions_toggle_and_only_allow_listed_emojis(): void
    {
        $id = $this->send($this->ana, ['content' => 'Lo logramos'])->json('id');
        $url = "/api/conversations/{$this->chat->id}/messages/{$id}/reactions";

        $this->actingAs($this->beto, 'api')->postJson($url, ['emoji' => '👍'])
            ->assertOk()
            ->assertJsonPath('reactions.0.emoji', '👍')
            ->assertJsonPath('reactions.0.count', 1)
            ->assertJsonPath('reactions.0.mine', true);

        $this->actingAs($this->ana, 'api')->postJson($url, ['emoji' => '👍'])->assertJsonPath('reactions.0.count', 2);

        // Volver a reaccionar con el mismo emoji lo quita
        $this->actingAs($this->beto, 'api')->postJson($url, ['emoji' => '👍'])
            ->assertJsonPath('reactions.0.count', 1)
            ->assertJsonPath('reactions.0.mine', false);

        $this->actingAs($this->beto, 'api')->postJson($url, ['emoji' => '<script>'])->assertUnprocessable();
    }

    public function test_search_inside_a_conversation(): void
    {
        $this->send($this->ana, ['content' => 'El deploy salió bien']);
        $this->send($this->beto, ['content' => 'Perfecto']);
        $this->send($this->ana, ['content' => 'Mañana otro deploy']);

        $this->actingAs($this->beto, 'api')->getJson("/api/conversations/{$this->chat->id}/messages?search=deploy")
            ->assertOk()
            ->assertJsonCount(2)
            ->assertJsonPath('1.content', 'Mañana otro deploy');

        // Los comodines de SQL se buscan como texto
        $this->actingAs($this->beto, 'api')->getJson("/api/conversations/{$this->chat->id}/messages?search=%25")
            ->assertJsonCount(0);
    }

    public function test_file_names_are_sanitized(): void
    {
        $this->assertSame('reporte.pdf', MessageController::safeFileName('../../etc/reporte.pdf'));
        $this->assertSame('archivo', MessageController::safeFileName(''));
        $this->assertSame('ab.txt', MessageController::safeFileName("a\"<b>\x01.txt"));
    }
}
