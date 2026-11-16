<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Resources\UserResource;
use App\Models\ApiToken;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\Rules\Password;
use Illuminate\Validation\ValidationException;

class ProfileController extends Controller
{
    /** PATCH /api/me { "name": "..." } */
    public function update(Request $request): UserResource
    {
        $data = $request->validate(['name' => ['required', 'string', 'min:2', 'max:80']]);
        $user = $request->user();
        $user->update(['name' => trim($data['name'])]);

        return new UserResource($user->fresh());
    }

    /** POST /api/me/avatar (multipart: avatar = JPG, PNG o WebP de hasta 2 MB) */
    public function avatar(Request $request): UserResource
    {
        $request->validate([
            'avatar' => ['required', 'file', 'max:2048', 'mimes:jpg,jpeg,png,webp'],
        ], [
            'avatar.mimes' => 'La foto debe ser JPG, PNG o WebP.',
            'avatar.max' => 'La foto no puede pesar más de 2 MB.',
        ]);

        $user = $request->user();
        $old = $user->avatar_path;

        $user->forceFill(['avatar_path' => $request->file('avatar')->store('avatars', 'local')])->save();
        if ($old) {
            Storage::disk('local')->delete($old);
        }

        return new UserResource($user->fresh());
    }

    /** DELETE /api/me/avatar: vuelve al avatar con iniciales */
    public function removeAvatar(Request $request): UserResource
    {
        $user = $request->user();
        if ($user->avatar_path) {
            Storage::disk('local')->delete($user->avatar_path);
            $user->forceFill(['avatar_path' => null])->save();
        }

        return new UserResource($user->fresh());
    }

    /** PUT /api/me/password: exige la contraseña actual y cierra las demás sesiones */
    public function password(Request $request): JsonResponse
    {
        abort_if($request->user()->is_guest, 403, 'Las cuentas de invitado no tienen contraseña. Crea una cuenta para conservar tus chats.');

        $data = $request->validate([
            'current_password' => ['required', 'string'],
            'password' => ['required', 'string', 'confirmed', Password::min(8)->letters()->numbers()],
        ]);

        $user = $request->user();
        if (! Hash::check($data['current_password'], $user->password)) {
            throw ValidationException::withMessages(['current_password' => 'La contraseña actual no es correcta.']);
        }

        $user->update(['password' => $data['password']]);

        // La sesión actual se conserva; el resto (otros dispositivos) se cierra
        $current = $request->attributes->get('api_token') ?? ApiToken::findValid((string) $request->bearerToken());
        $user->apiTokens()
            ->when($current instanceof ApiToken, fn ($q) => $q->whereKeyNot($current->id))
            ->delete();

        return response()->json(['message' => 'Contraseña actualizada. Se cerraron las demás sesiones.']);
    }

    /** GET /api/users/{user}/avatar: foto de perfil (requiere sesión) */
    public function showAvatar(User $user)
    {
        abort_unless($user->avatar_path && Storage::disk('local')->exists($user->avatar_path), 404);

        return Storage::disk('local')->response($user->avatar_path, 'avatar', [
            'X-Content-Type-Options' => 'nosniff',
            'Content-Security-Policy' => "default-src 'none'; sandbox",
            'Cache-Control' => 'private, max-age=86400',
        ]);
    }
}
