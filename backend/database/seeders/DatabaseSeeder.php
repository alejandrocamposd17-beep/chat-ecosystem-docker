<?php

namespace Database\Seeders;

use App\Models\Conversation;
use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Str;

class DatabaseSeeder extends Seeder
{
    /** Contraseña de las cuentas de demostración (todas iguales para probar fácil) */
    public const DEMO_PASSWORD = 'password';

    public function run(): void
    {
        // Idempotente: si ya hay datos, no vuelve a sembrar
        if (User::query()->exists()) {
            $this->command?->info('La base ya tiene datos, se omite el seeder.');

            return;
        }

        $me = $this->user('Alejandro Campos');

        $chats = [
            ['Andrea Martínez', [
                ['them', '¡Hola! ¿Ya viste el deploy de hoy?'],
                ['me', 'Sí, las imágenes bajaron muchísimo de tamaño.'],
                ['them', 'El multi-stage hizo magia 🚀'],
            ], true],
            ['Carlos Rivera', [
                ['me', '¿Revisaste el docker-compose?'],
                ['them', 'Sí, solo falta documentar las variables.'],
            ], true],
            ['Sofía Hernández', [
                ['them', 'Mañana revisamos la base de datos.'],
                ['me', 'Perfecto, ya quedó el volumen persistente.'],
            ], true],
            ['Diego López', [
                ['them', '¿Cuánto pesa ahora la imagen del frontend?'],
                ['them', '¿Y ya funciona el chat en tiempo real?'],
            ], false],
        ];

        $contacts = [];
        foreach ($chats as $i => [$name, $messages, $readByMe]) {
            $contact = $contacts[$name] = $this->user($name);

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

            // El contacto leyó todo; "yo" dejo sin leer el último chat para mostrar el contador
            $conversation->participants()->attach([
                $me->id => ['last_read_at' => $readByMe ? $time : $time->copy()->subMinutes(10)],
                $contact->id => ['last_read_at' => $time],
            ]);

            $conversation->timestamps = false;
            $conversation->forceFill(['created_at' => $time, 'updated_at' => $time])->save();
        }

        // Grupo de ejemplo con tres integrantes (Alejandro es el administrador)
        $group = Conversation::createGroup($me, 'Equipo Docker', [$contacts['Andrea Martínez'], $contacts['Carlos Rivera']]);
        $group->messages()->create([
            'sender_id' => $contacts['Carlos Rivera']->id,
            'content' => '¿Quién revisa el pipeline de CI hoy?',
        ]);
        $group->participants()->updateExistingPivot($me->id, ['last_read_at' => now()]);
    }

    private function user(string $name): User
    {
        $first = Str::slug(Str::before($name, ' '));

        return User::create([
            'name' => $name,
            'email' => $first.'@chat.test',
            'password' => self::DEMO_PASSWORD,
            'avatar_url' => 'https://api.dicebear.com/9.x/initials/svg?seed='.urlencode($name),
            'status' => 'offline',
        ]);
    }
}
