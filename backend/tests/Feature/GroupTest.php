<?php

namespace Tests\Feature;

use App\Models\Conversation;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class GroupTest extends TestCase
{
    use RefreshDatabase;

    public function test_creating_a_group_makes_the_creator_admin(): void
    {
        [$ana, $beto, $carla] = User::factory()->count(3)->create();

        $response = $this->actingAs($ana, 'api')->postJson('/api/conversations', [
            'name' => 'Proyecto final',
            'userIds' => [$beto->id, $carla->id],
        ])->assertCreated()
            ->assertJsonPath('type', 'group')
            ->assertJsonPath('name', 'Proyecto final')
            ->assertJsonPath('myRole', 'admin')
            ->assertJsonCount(3, 'participants');

        $id = $response->json('id');

        // Los demás integrantes ven el grupo y el mensaje del sistema
        $this->actingAs($beto, 'api')->getJson('/api/conversations')
            ->assertJsonPath('0.id', $id)
            ->assertJsonPath('0.myRole', 'member');
        $this->actingAs($carla, 'api')->getJson("/api/conversations/{$id}/messages")
            ->assertJsonPath('0.kind', 'system')
            ->assertJsonPath('0.content', fn ($text) => str_contains($text, 'creó el grupo'));
    }

    public function test_group_validation(): void
    {
        $ana = User::factory()->create();

        $this->actingAs($ana, 'api')->postJson('/api/conversations', ['name' => 'Solo yo', 'userIds' => [$ana->id]])
            ->assertUnprocessable();
        $this->actingAs($ana, 'api')->postJson('/api/conversations', ['name' => 'X', 'userIds' => []])
            ->assertUnprocessable();
    }

    public function test_messages_in_a_group_reach_every_member(): void
    {
        [$ana, $beto, $carla] = User::factory()->count(3)->create();
        $group = Conversation::createGroup($ana, 'Equipo', [$beto, $carla]);

        $this->actingAs($beto, 'api')->postJson("/api/conversations/{$group->id}/messages", ['content' => 'Hola equipo'])
            ->assertCreated()
            ->assertJsonPath('senderName', $beto->name);

        foreach ([$ana, $carla] as $member) {
            $this->actingAs($member, 'api')->getJson('/api/conversations')
                ->assertJsonPath('0.lastMessage', 'Hola equipo')
                ->assertJsonPath('0.lastMessageSender', $beto->name);
        }
    }

    public function test_only_admins_can_rename_and_add_members(): void
    {
        [$ana, $beto, $carla] = User::factory()->count(3)->create();
        $group = Conversation::createGroup($ana, 'Equipo', [$beto]);

        $this->actingAs($beto, 'api')->patchJson("/api/conversations/{$group->id}", ['name' => 'Nuevo'])->assertForbidden();
        $this->actingAs($beto, 'api')->postJson("/api/conversations/{$group->id}/participants", ['userId' => $carla->id])->assertForbidden();

        $this->actingAs($ana, 'api')->patchJson("/api/conversations/{$group->id}", ['name' => 'Equipo 2'])
            ->assertOk()
            ->assertJsonPath('name', 'Equipo 2');
        $this->actingAs($ana, 'api')->postJson("/api/conversations/{$group->id}/participants", ['userId' => $carla->id])
            ->assertOk()
            ->assertJsonCount(3, 'participants');
        $this->actingAs($ana, 'api')->postJson("/api/conversations/{$group->id}/participants", ['userId' => $carla->id])
            ->assertUnprocessable();

        // Carla ya ve el grupo
        $this->actingAs($carla, 'api')->getJson("/api/conversations/{$group->id}")->assertOk();
    }

    public function test_admin_can_remove_members_and_members_can_leave(): void
    {
        [$ana, $beto, $carla] = User::factory()->count(3)->create();
        $group = Conversation::createGroup($ana, 'Equipo', [$beto, $carla]);

        // Un integrante no puede quitar a otro
        $this->actingAs($beto, 'api')->deleteJson("/api/conversations/{$group->id}/participants/{$carla->id}")->assertForbidden();

        $this->actingAs($ana, 'api')->deleteJson("/api/conversations/{$group->id}/participants/{$carla->id}")->assertOk();
        $this->actingAs($carla, 'api')->getJson("/api/conversations/{$group->id}")->assertNotFound();

        // Si el único administrador sale, el integrante más antiguo pasa a serlo
        $this->actingAs($ana, 'api')->deleteJson("/api/conversations/{$group->id}/participants/{$ana->id}")->assertOk();
        $this->actingAs($beto, 'api')->getJson("/api/conversations/{$group->id}")->assertJsonPath('myRole', 'admin');

        // Cuando sale el último integrante, el grupo se elimina
        $this->actingAs($beto, 'api')->deleteJson("/api/conversations/{$group->id}/participants/{$beto->id}")->assertOk();
        $this->assertDatabaseMissing('conversations', ['id' => $group->id]);
    }

    public function test_direct_chats_do_not_mix_with_groups(): void
    {
        [$ana, $beto] = User::factory()->count(2)->create();
        Conversation::createGroup($ana, 'Dos personas', [$beto]);

        // Abrir un chat directo crea uno nuevo aunque ya compartan un grupo
        $this->actingAs($ana, 'api')->postJson('/api/conversations', ['userId' => $beto->id])
            ->assertCreated()
            ->assertJsonPath('type', 'direct');

        $direct = Conversation::where('type', 'direct')->firstOrFail();
        $this->actingAs($ana, 'api')->deleteJson("/api/conversations/{$direct->id}/participants/{$beto->id}")->assertUnprocessable();
    }
}
