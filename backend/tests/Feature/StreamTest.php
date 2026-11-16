<?php

namespace Tests\Feature;

use App\Models\Conversation;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class StreamTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        // Una sola vuelta del ciclo: la prueba no espera los 25 s de una conexión real
        config(['chat.stream_seconds' => 0]);
    }

    public function test_stream_requires_authentication(): void
    {
        $this->getJson('/api/stream')->assertUnauthorized();
    }

    public function test_stream_sends_new_messages_only_to_participants(): void
    {
        [$ana, $beto, $carla] = User::factory()->count(3)->create();
        $chat = Conversation::between($ana, $beto);
        $first = $chat->messages()->create(['sender_id' => $ana->id, 'content' => 'viejo']);
        $chat->messages()->create(['sender_id' => $ana->id, 'content' => 'nuevo para Beto']);

        $response = $this->actingAs($beto, 'api')
            ->get('/api/stream', ['Last-Event-ID' => (string) $first->id]);

        $response->assertOk();
        $this->assertStringContainsString('text/event-stream', $response->headers->get('Content-Type'));

        $body = $response->streamedContent();
        $this->assertStringContainsString("event: message\n", $body);
        $this->assertStringContainsString('nuevo para Beto', $body);
        $this->assertStringNotContainsString('viejo', $body);
        $this->assertStringContainsString('"isSelf":false', $body);

        // Carla no participa: no recibe nada de ese chat
        $other = $this->actingAs($carla, 'api')->get('/api/stream?lastEventId=0')->streamedContent();
        $this->assertStringNotContainsString('nuevo para Beto', $other);
    }

    public function test_first_connection_skips_old_messages(): void
    {
        [$ana, $beto] = User::factory()->count(2)->create();
        $chat = Conversation::between($ana, $beto);
        $chat->messages()->create(['sender_id' => $ana->id, 'content' => 'ya cargado por la página']);

        $body = $this->actingAs($beto, 'api')->get('/api/stream')->streamedContent();

        $this->assertStringNotContainsString("event: message\n", $body);
        $this->assertStringContainsString('retry: 2000', $body);
    }

    public function test_stream_reports_who_is_typing(): void
    {
        [$ana, $beto] = User::factory()->count(2)->create();
        $chat = Conversation::between($ana, $beto);

        $this->actingAs($ana, 'api')->postJson("/api/conversations/{$chat->id}/typing")->assertOk();

        $body = $this->actingAs($beto, 'api')->get('/api/stream')->streamedContent();

        $this->assertStringContainsString('event: typing', $body);
        $this->assertStringContainsString('"userId":"'.$ana->id.'"', $body);
        $this->assertStringContainsString('"typing":true', $body);
    }

    public function test_stream_reports_edits_and_reactions(): void
    {
        [$ana, $beto] = User::factory()->count(2)->create();
        $chat = Conversation::between($ana, $beto);
        $message = $chat->messages()->create(['sender_id' => $ana->id, 'content' => 'original']);

        $this->travel(2)->seconds();
        $this->actingAs($ana, 'api')->patchJson("/api/conversations/{$chat->id}/messages/{$message->id}", ['content' => 'editado'])->assertOk();

        $body = $this->actingAs($beto, 'api')->get('/api/stream')->streamedContent();

        $this->assertStringContainsString("event: message_updated\n", $body);
        $this->assertStringContainsString('editado', $body);
    }
}
