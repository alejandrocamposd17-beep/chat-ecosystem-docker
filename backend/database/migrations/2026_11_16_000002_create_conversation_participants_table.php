<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Participantes de cada conversación: ahora ambos usuarios ven el mismo chat
 * (antes la conversación solo existía en la bandeja de "owner").
 * last_read_at permite calcular mensajes no leídos y confirmaciones de lectura.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('conversation_participants', function (Blueprint $table) {
            $table->id();
            $table->foreignId('conversation_id')->constrained()->cascadeOnDelete();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->timestamp('last_read_at')->nullable();
            $table->timestamps();

            $table->unique(['conversation_id', 'user_id']);
            $table->index(['user_id', 'conversation_id']);
        });

        // Las conversaciones existentes pasan a tener a sus dos usuarios como participantes
        $now = now();
        foreach (DB::table('conversations')->get(['id', 'owner_id', 'contact_id']) as $conversation) {
            foreach ([$conversation->owner_id, $conversation->contact_id] as $userId) {
                DB::table('conversation_participants')->insertOrIgnore([
                    'conversation_id' => $conversation->id,
                    'user_id' => $userId,
                    'last_read_at' => $now,
                    'created_at' => $now,
                    'updated_at' => $now,
                ]);
            }
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('conversation_participants');
    }
};
