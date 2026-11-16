<?php

namespace Tests\Feature;

use App\Models\ApiToken;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class AuthTest extends TestCase
{
    use RefreshDatabase;

    public function test_user_can_register_and_receives_a_token(): void
    {
        $response = $this->postJson('/api/auth/register', [
            'name' => 'Ana Pérez',
            'email' => 'Ana@Example.com',
            'password' => 'secreto123',
            'password_confirmation' => 'secreto123',
        ])->assertCreated()
            ->assertJsonPath('user.name', 'Ana Pérez')
            ->assertJsonStructure(['user' => ['id', 'name', 'avatarUrl', 'status'], 'token']);

        $this->assertDatabaseHas('users', ['email' => 'ana@example.com']);
        $this->assertSame(64, strlen($response->json('token')));
    }

    public function test_register_requires_a_strong_password_and_unique_email(): void
    {
        User::factory()->create(['email' => 'ya@existe.com']);

        $this->postJson('/api/auth/register', [
            'name' => 'X',
            'email' => 'ya@existe.com',
            'password' => 'corta',
            'password_confirmation' => 'otra',
        ])->assertUnprocessable()->assertJsonValidationErrors(['name', 'email', 'password']);
    }

    public function test_token_is_stored_hashed(): void
    {
        $user = User::factory()->create();
        $plain = ApiToken::issue($user);

        $this->assertDatabaseMissing('api_tokens', ['token_hash' => $plain]);
        $this->assertDatabaseHas('api_tokens', ['token_hash' => hash('sha256', $plain)]);
    }

    public function test_login_with_valid_and_invalid_credentials(): void
    {
        User::factory()->create(['email' => 'ale@chat.test', 'password' => 'password']);

        $this->postJson('/api/auth/login', ['email' => 'ale@chat.test', 'password' => 'password'])
            ->assertOk()
            ->assertJsonStructure(['user', 'token']);

        // Mismo mensaje para contraseña incorrecta y correo inexistente
        $wrong = $this->postJson('/api/auth/login', ['email' => 'ale@chat.test', 'password' => 'mala'])
            ->assertUnprocessable();
        $missing = $this->postJson('/api/auth/login', ['email' => 'nadie@chat.test', 'password' => 'mala'])
            ->assertUnprocessable();

        $this->assertSame($wrong->json('errors.email'), $missing->json('errors.email'));
    }

    public function test_protected_routes_require_a_valid_token(): void
    {
        $this->getJson('/api/me')->assertUnauthorized();
        $this->getJson('/api/me', ['Authorization' => 'Bearer token-inventado'])->assertUnauthorized();

        $user = User::factory()->create();
        $token = ApiToken::issue($user);

        $this->getJson('/api/me', ['Authorization' => "Bearer {$token}"])
            ->assertOk()
            ->assertJsonPath('id', (string) $user->id)
            ->assertJsonPath('status', 'online');
    }

    public function test_expired_token_is_rejected(): void
    {
        $user = User::factory()->create();
        $token = ApiToken::issue($user);
        ApiToken::query()->update(['expires_at' => now()->subMinute()]);

        $this->getJson('/api/me', ['Authorization' => "Bearer {$token}"])->assertUnauthorized();
    }

    public function test_logout_revokes_only_the_current_token(): void
    {
        $user = User::factory()->create();
        $current = ApiToken::issue($user);
        $other = ApiToken::issue($user, 'otro-dispositivo');

        $this->postJson('/api/auth/logout', [], ['Authorization' => "Bearer {$current}"])->assertOk();

        $this->assertNull(ApiToken::findValid($current));
        $this->assertNotNull(ApiToken::findValid($other));
    }

    public function test_login_is_rate_limited(): void
    {
        User::factory()->create(['email' => 'ale@chat.test']);

        for ($i = 0; $i < 10; $i++) {
            $this->postJson('/api/auth/login', ['email' => 'ale@chat.test', 'password' => 'mala'])->assertUnprocessable();
        }

        $this->postJson('/api/auth/login', ['email' => 'ale@chat.test', 'password' => 'mala'])->assertStatus(429);
    }
}
