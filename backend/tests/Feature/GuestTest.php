<?php

namespace Tests\Feature;

use App\Models\ApiToken;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class GuestTest extends TestCase
{
    use RefreshDatabase;

    public function test_guest_gets_a_temporary_account_and_can_chat(): void
    {
        $response = $this->postJson('/api/auth/guest')
            ->assertCreated()
            ->assertJsonPath('user.isGuest', true)
            ->assertJsonPath('user.name', fn ($name) => str_starts_with($name, 'Invitado '));

        $token = $response->json('token');
        $stored = ApiToken::findValid($token);
        $this->assertNotNull($stored);
        $this->assertTrue($stored->expires_at->lte(now()->addHours(24)));

        $friend = User::factory()->create();
        $this->postJson('/api/conversations', ['userId' => $friend->id], ['Authorization' => "Bearer {$token}"])
            ->assertCreated();

        // El token vence: después de un día ya no sirve
        $this->travel(25)->hours();
        $this->assertNull(ApiToken::findValid($token));
    }

    public function test_each_guest_is_a_different_user_found_by_others(): void
    {
        $a = $this->postJson('/api/auth/guest')->json('user.id');
        $b = $this->postJson('/api/auth/guest')->json('user.id');
        $this->assertNotSame($a, $b);

        $this->actingAs(User::findOrFail($a), 'api')->getJson('/api/users?search=Invitado')
            ->assertOk()
            ->assertJsonFragment(['id' => $b]);
    }

    public function test_guest_cannot_set_a_password(): void
    {
        $guest = User::findOrFail($this->postJson('/api/auth/guest')->json('user.id'));

        $this->actingAs($guest, 'api')->putJson('/api/me/password', [
            'current_password' => 'x',
            'password' => 'nueva12345',
            'password_confirmation' => 'nueva12345',
        ])->assertForbidden();
    }

    public function test_guest_creation_is_rate_limited(): void
    {
        for ($i = 0; $i < 10; $i++) {
            $this->postJson('/api/auth/guest')->assertCreated();
        }
        $this->postJson('/api/auth/guest')->assertTooManyRequests();
    }
}
