<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Chat completo:
 * - Conversaciones grupales (tipo, nombre y rol de cada participante).
 * - Mensajes con adjunto, respuesta a otro mensaje, edición y borrado lógico.
 * - Reacciones con emoji.
 * - Foto de perfil subida por el usuario.
 */
return new class extends Migration
{
    public function up(): void
    {
        // Un grupo no tiene "contacto": la columna pasa a ser opcional y deja de ser única por par.
        // Primero un índice propio para owner_id (MySQL lo exige para su llave foránea).
        Schema::table('conversations', function (Blueprint $table) {
            $table->index('owner_id');
        });

        Schema::table('conversations', function (Blueprint $table) {
            $table->dropUnique(['owner_id', 'contact_id']);
        });

        Schema::table('conversations', function (Blueprint $table) {
            $table->foreignId('contact_id')->nullable()->change();
            $table->string('type', 10)->default('direct')->after('id');
            $table->string('name', 80)->nullable()->after('type');
        });

        Schema::table('conversation_participants', function (Blueprint $table) {
            $table->string('role', 10)->default('member')->after('user_id');
        });

        Schema::table('messages', function (Blueprint $table) {
            $table->text('content')->nullable()->change();
            $table->string('kind', 10)->default('user')->after('sender_id');
            $table->foreignId('reply_to_id')->nullable()->after('kind')->constrained('messages')->nullOnDelete();
            $table->string('attachment_path')->nullable()->after('content');
            $table->string('attachment_name')->nullable()->after('attachment_path');
            $table->string('attachment_mime', 100)->nullable()->after('attachment_name');
            $table->unsignedInteger('attachment_size')->nullable()->after('attachment_mime');
            $table->timestamp('edited_at')->nullable();
            $table->softDeletes();

            $table->index(['conversation_id', 'updated_at']);
        });

        Schema::create('message_reactions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('message_id')->constrained()->cascadeOnDelete();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('emoji', 16);
            $table->timestamps();

            $table->unique(['message_id', 'user_id', 'emoji']);
        });

        Schema::table('users', function (Blueprint $table) {
            $table->string('avatar_path')->nullable()->after('avatar_url');
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn('avatar_path');
        });

        Schema::dropIfExists('message_reactions');

        Schema::table('messages', function (Blueprint $table) {
            $table->dropIndex(['conversation_id', 'updated_at']);
            $table->dropConstrainedForeignId('reply_to_id');
            $table->dropSoftDeletes();
            $table->dropColumn(['kind', 'attachment_path', 'attachment_name', 'attachment_mime', 'attachment_size', 'edited_at']);
        });

        Schema::table('conversation_participants', function (Blueprint $table) {
            $table->dropColumn('role');
        });

        Schema::table('conversations', function (Blueprint $table) {
            $table->dropColumn(['type', 'name']);
        });
    }
};
