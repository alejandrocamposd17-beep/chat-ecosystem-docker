<?php

namespace Tests\Feature;

use App\Models\Conversation;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class ChatTest extends TestCase
{
    use RefreshDatabase;

    public function test_starting_a_chat_creates_it_once_for_both_users(): void
    {
        [$ana, $beto] = User::factory()->count(2)->create();

        $id = $this->actingAs($ana, 'api')->postJson('/api/conversations', ['userId' => $beto->id])
            ->assertCreated()
            ->assertJsonPath('user.id', (string) $beto->id)
            ->json('id');

        // Si Beto abre el chat con Ana, recibe la misma conversación
        $this->actingAs($beto, 'api')->postJson('/api/conversations', ['userId' => $ana->id])
            ->assertOk()
            ->assertJsonPath('id', $id)
            ->assertJsonPath('user.id', (string) $ana->id);

        $this->assertSame(1, Conversation::count());
    }

    public function test_cannot_start_a_chat_with_yourself_or_unknown_users(): void
    {
        $ana = User::factory()->create();

        $this->actingAs($ana, 'api')->postJson('/api/conversations', ['userId' => $ana->id])->assertUnprocessable();
        $this->actingAs($ana, 'api')->postJson('/api/conversations', ['userId' => 9999])->assertUnprocessable();
    }

    public function test_users_only_see_their_own_conversations(): void
    {
        [$ana, $beto, $carla] = User::factory()->count(3)->create();
        $mine = Conversation::between($ana, $beto);
        $foreign = Conversation::between($beto, $carla);

        $this->actingAs($ana, 'api')->getJson('/api/conversations')
            ->assertOk()
            ->assertJsonCount(1)
            ->assertJsonPath('0.id', (string) $mine->id);

        // Una conversación ajena responde 404 (no se revela que existe)
        $this->actingAs($ana, 'api')->getJson("/api/conversations/{$foreign->id}")->assertNotFound();
        $this->actingAs($ana, 'api')->getJson("/api/conversations/{$foreign->id}/messages")->assertNotFound();
        $this->actingAs($ana, 'api')->postJson("/api/conversations/{$foreign->id}/messages", ['content' => 'hola'])->assertNotFound();
        $this->actingAs($ana, 'api')->postJson("/api/conversations/{$foreign->id}/typing")->assertNotFound();
    }

    public function test_sending_messages_and_is_self_flag_per_user(): void
    {
        [$ana, $beto] = User::factory()->count(2)->create();
        $chat = Conversation::between($ana, $beto);

        $this->actingAs($ana, 'api')->postJson("/api/conversations/{$chat->id}/messages", ['content' => '  Hola Beto  '])
            ->assertCreated()
            ->assertJsonPath('content', 'Hola Beto')
            ->assertJsonPath('isSelf', true);

        $this->actingAs($beto, 'api')->getJson("/api/conversations/{$chat->id}/messages")
            ->assertOk()
            ->assertJsonCount(1)
            ->assertJsonPath('0.isSelf', false);
    }

    public function test_message_validation(): void
    {
        [$ana, $beto] = User::factory()->count(2)->create();
        $chat = Conversation::between($ana, $beto);

        $this->actingAs($ana, 'api')->postJson("/api/conversations/{$chat->id}/messages", ['content' => '   '])->assertUnprocessable();
        $this->actingAs($ana, 'api')->postJson("/api/conversations/{$chat->id}/messages", ['content' => str_repeat('a', 2001)])->assertUnprocessable();
    }

    public function test_unread_count_and_mark_as_read(): void
    {
        [$ana, $beto] = User::factory()->count(2)->create();

        // El chat se creó hace un minuto (Ana lo tenía leído desde entonces)
        $this->travel(-1)->minutes();
        $chat = Conversation::between($ana, $beto);
        $this->travelBack();

        $this->actingAs($beto, 'api')->postJson("/api/conversations/{$chat->id}/messages", ['content' => 'uno'])->assertCreated();
        $this->actingAs($beto, 'api')->postJson("/api/conversations/{$chat->id}/messages", ['content' => 'dos'])->assertCreated();

        $this->actingAs($ana, 'api')->getJson('/api/conversations')->assertJsonPath('0.unreadCount', 2);

        $this->actingAs($ana, 'api')->postJson("/api/conversations/{$chat->id}/read")->assertOk();

        $this->actingAs($ana, 'api')->getJson('/api/conversations')->assertJsonPath('0.unreadCount', 0);
        // Beto ve hasta cuándo leyó Ana (para mostrar "Visto")
        $this->actingAs($beto, 'api')->getJson("/api/conversations/{$chat->id}")
            ->assertJsonPath('readStates.0.userId', (string) $ana->id)
            ->assertJsonPath('readStates.0.lastReadAt', fn ($value) => $value !== null);
    }

    public function test_messages_are_paginated_with_before(): void
    {
        [$ana, $beto] = User::factory()->count(2)->create();
        $chat = Conversation::between($ana, $beto);
        for ($i = 1; $i <= 60; $i++) {
            $chat->messages()->create(['sender_id' => $ana->id, 'content' => "m{$i}"]);
        }

        $page = $this->actingAs($ana, 'api')->getJson("/api/conversations/{$chat->id}/messages")
            ->assertJsonCount(50)
            ->assertJsonPath('49.content', 'm60');

        $this->actingAs($ana, 'api')->getJson("/api/conversations/{$chat->id}/messages?before=".$page->json('0.id'))
            ->assertJsonCount(10)
            ->assertJsonPath('0.content', 'm1');
    }

    public function test_user_search_excludes_yourself(): void
    {
        $ana = User::factory()->create(['name' => 'Ana López']);
        User::factory()->create(['name' => 'Beto López']);
        User::factory()->create(['name' => 'Carla Ruiz']);

        $this->actingAs($ana, 'api')->getJson('/api/users?search=López')
            ->assertOk()
            ->assertJsonCount(1)
            ->assertJsonPath('0.name', 'Beto López');
    }

    public function test_sending_messages_is_rate_limited(): void
    {
        [$ana, $beto] = User::factory()->count(2)->create();
        $chat = Conversation::between($ana, $beto);

        for ($i = 0; $i < 30; $i++) {
            $this->actingAs($ana, 'api')->postJson("/api/conversations/{$chat->id}/messages", ['content' => "m{$i}"])->assertCreated();
        }

        $this->actingAs($ana, 'api')->postJson("/api/conversations/{$chat->id}/messages", ['content' => 'otro'])->assertStatus(429);
    }

    public function test_demo_seeder_creates_accounts_that_can_log_in(): void
    {
        $this->seed();

        $this->postJson('/api/auth/login', ['email' => 'alejandro@chat.test', 'password' => 'password'])->assertOk();
        $token = $this->postJson('/api/auth/login', ['email' => 'andrea@chat.test', 'password' => 'password'])->json('token');

        // Andrea ve su chat con Alejandro y el grupo de ejemplo
        $chats = $this->getJson('/api/conversations', ['Authorization' => "Bearer {$token}"])
            ->assertOk()
            ->assertJsonCount(2)
            ->json();

        $this->assertContains('Alejandro Campos', array_column($chats, 'name'));
        $this->assertContains('Equipo Docker', array_column($chats, 'name'));
    }
}
