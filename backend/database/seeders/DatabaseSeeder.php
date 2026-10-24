<?php

namespace Database\Seeders;

use App\Models\Conversation;
use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;

class DatabaseSeeder extends Seeder
{
    public function run(): void
    {
        // Idempotente: si ya hay datos, no vuelve a sembrar
        if (User::query()->exists()) {
            $this->command?->info('La base ya tiene datos, se omite el seeder.');

            return;
        }

        $me = $this->user('Yo', 'online');

        $chats = [
            ['Andrea Martínez', 'online', [
                ['them', '¡Hola! ¿Ya viste el deploy de hoy?'],
                ['me', 'Sí, las imágenes bajaron muchísimo de tamaño.'],
                ['them', 'El multi-stage hizo magia 🚀'],
            ]],
            ['Carlos Rivera', 'away', [
                ['me', '¿Revisaste el docker-compose?'],
                ['them', 'Sí, solo falta documentar las variables.'],
            ]],
            ['Sofía Hernández', 'offline', [
                ['them', 'Mañana revisamos la base de datos.'],
                ['me', 'Perfecto, ya quedó el volumen persistente.'],
            ]],
            ['Diego López', 'online', [
                ['them', '¿Cuánto pesa ahora la imagen del frontend?'],
            ]],
        ];

        foreach ($chats as $i => [$name, $status, $messages]) {
            $contact = $this->user($name, $status);

            $conversation = Conversation::create([
                'owner_id' => $me->id,
                'contact_id' => $contact->id,
            ]);

            $time = now()->subHours(count($chats) - $i)->subMinutes(30);
            foreach ($messages as [$who, $content]) {
                $time = $time->copy()->addMinutes(3);
                $message = $conversation->messages()->make([
                    'sender_id' => $who === 'me' ? $me->id : $contact->id,
                    'content' => $content,
                ]);
                $message->created_at = $time;
                $message->updated_at = $time;
                $message->save();
            }

            $conversation->timestamps = false;
            $conversation->forceFill(['created_at' => $time, 'updated_at' => $time])->save();
        }
    }

    private function user(string $name, string $status): User
    {
        return User::create([
            'name' => $name,
            'email' => Str::slug($name).'@chat.test',
            'password' => Hash::make(Str::random(32)),
            'avatar_url' => 'https://api.dicebear.com/9.x/initials/svg?seed='.urlencode($name),
            'status' => $status,
        ]);
    }
}
