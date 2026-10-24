<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('conversations', function (Blueprint $table) {
            $table->id();
            // Usuario dueño de la bandeja (el usuario actual de la app)
            $table->foreignId('owner_id')->constrained('users')->cascadeOnDelete();
            // Contacto con el que se conversa
            $table->foreignId('contact_id')->constrained('users')->cascadeOnDelete();
            $table->timestamps();

            $table->unique(['owner_id', 'contact_id']);
            $table->index('updated_at');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('conversations');
    }
};
