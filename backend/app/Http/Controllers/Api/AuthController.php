<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Resources\UserResource;
use App\Models\ApiToken;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use Illuminate\Validation\Rules\Password;
use Illuminate\Validation\ValidationException;

class AuthController extends Controller
{
    /** POST /api/auth/register */
    public function register(Request $request): JsonResponse
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'min:2', 'max:80'],
            'email' => ['required', 'string', 'email', 'max:120', 'unique:users,email'],
            'password' => ['required', 'string', 'confirmed', Password::min(8)->letters()->numbers()],
        ]);

        $user = User::create([
            'name' => trim($data['name']),
            'email' => strtolower(trim($data['email'])),
            'password' => $data['password'],
            'avatar_url' => 'https://api.dicebear.com/9.x/initials/svg?seed='.urlencode(trim($data['name'])),
            'status' => 'online',
            'last_seen_at' => now(),
        ]);

        return $this->withToken($user, 201);
    }

    /**
     * POST /api/auth/guest: cuenta temporal para probar el chat sin registrarse.
     * Nombre "Invitado 1234", correo y contraseña aleatorios que nadie conoce: solo sirve el token,
     * que vence en unas horas. Comparte el límite de velocidad del registro.
     */
    public function guest(): JsonResponse
    {
        $name = 'Invitado '.random_int(1000, 9999);

        $user = User::create([
            'name' => $name,
            'email' => 'invitado-'.Str::lower(Str::random(24)).'@invitado.local',
            'password' => Str::random(64),
            'avatar_url' => 'https://api.dicebear.com/9.x/initials/svg?seed='.urlencode($name),
            'is_guest' => true,
            'status' => 'online',
            'last_seen_at' => now(),
        ]);

        $user->touchPresence();

        return response()->json([
            'user' => new UserResource($user),
            'token' => ApiToken::issue($user, 'invitado', (int) config('chat.guest_session_hours')),
        ], 201);
    }

    /** POST /api/auth/login */
    public function login(Request $request): JsonResponse
    {
        $data = $request->validate([
            'email' => ['required', 'string', 'email'],
            'password' => ['required', 'string'],
        ]);

        $user = User::where('email', strtolower(trim($data['email'])))->first();

        // Mismo mensaje si el correo no existe o la contraseña es incorrecta (no revela qué cuentas existen)
        if (! $user || ! Hash::check($data['password'], $user->password)) {
            throw ValidationException::withMessages(['email' => 'Correo o contraseña incorrectos.']);
        }

        return $this->withToken($user, 200);
    }

    /** POST /api/auth/logout: revoca solo el token usado en la petición */
    public function logout(Request $request): JsonResponse
    {
        $token = $request->attributes->get('api_token');
        if ($token instanceof ApiToken) {
            $token->delete();
        }

        return response()->json(['message' => 'Sesión cerrada.']);
    }

    /** GET /api/me */
    public function me(Request $request): UserResource
    {
        return new UserResource($request->user());
    }

    private function withToken(User $user, int $status): JsonResponse
    {
        $user->touchPresence();

        return response()->json([
            'user' => new UserResource($user),
            'token' => ApiToken::issue($user),
        ], $status);
    }
}
