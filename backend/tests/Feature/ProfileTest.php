<?php

namespace Tests\Feature;

use App\Models\ApiToken;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

class ProfileTest extends TestCase
{
    use RefreshDatabase;

    public function test_user_can_change_name(): void
    {
        $user = User::factory()->create();

        $this->actingAs($user, 'api')->patchJson('/api/me', ['name' => '  Alejandro C.  '])
            ->assertOk()
            ->assertJsonPath('name', 'Alejandro C.');
    }

    public function test_avatar_upload_replaces_the_previous_photo(): void
    {
        Storage::fake('local');
        $user = User::factory()->create();

        $this->actingAs($user, 'api')->post('/api/me/avatar', ['avatar' => UploadedFile::fake()->image('yo.png')], ['Accept' => 'application/json'])
            ->assertOk()
            ->assertJsonPath('avatarVersion', fn ($v) => $v !== null);
        $first = $user->fresh()->avatar_path;
        Storage::disk('local')->assertExists($first);

        $this->actingAs($user, 'api')->post('/api/me/avatar', ['avatar' => UploadedFile::fake()->image('nueva.jpg')], ['Accept' => 'application/json'])
            ->assertOk();
        Storage::disk('local')->assertMissing($first);

        $this->actingAs(User::factory()->create(), 'api')->get("/api/users/{$user->id}/avatar")->assertOk();

        $this->actingAs($user, 'api')->post('/api/me/avatar', ['avatar' => UploadedFile::fake()->create('virus.exe', 10)], ['Accept' => 'application/json'])
            ->assertUnprocessable();

        $this->actingAs($user, 'api')->deleteJson('/api/me/avatar')->assertOk()->assertJsonPath('avatarVersion', null);
    }

    public function test_password_change_requires_current_password_and_closes_other_sessions(): void
    {
        $user = User::factory()->create(['password' => 'antigua123']);
        $current = ApiToken::issue($user);
        $other = ApiToken::issue($user, 'celular');
        $headers = ['Authorization' => "Bearer {$current}"];

        $this->putJson('/api/me/password', [
            'current_password' => 'incorrecta',
            'password' => 'nueva12345',
            'password_confirmation' => 'nueva12345',
        ], $headers)->assertUnprocessable()->assertJsonValidationErrors('current_password');

        $this->putJson('/api/me/password', [
            'current_password' => 'antigua123',
            'password' => 'nueva12345',
            'password_confirmation' => 'nueva12345',
        ], $headers)->assertOk();

        $this->assertNotNull(ApiToken::findValid($current));
        $this->assertNull(ApiToken::findValid($other));
        $this->postJson('/api/auth/login', ['email' => $user->email, 'password' => 'nueva12345'])->assertOk();
    }
}
