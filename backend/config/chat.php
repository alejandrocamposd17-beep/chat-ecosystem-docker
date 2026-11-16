<?php

return [
    // Días de vigencia de un token de sesión (0 = no expira)
    'token_ttl_days' => (int) env('CHAT_TOKEN_TTL_DAYS', 30),

    // Horas que dura la sesión de una cuenta de invitado (después hay que registrarse)
    'guest_session_hours' => (int) env('CHAT_GUEST_SESSION_HOURS', 24),

    // Segundos desde la última actividad para mostrar a un usuario "en línea"
    'online_window_seconds' => (int) env('CHAT_ONLINE_WINDOW_SECONDS', 90),

    // Duración de cada conexión del stream de eventos (el cliente se reconecta solo)
    'stream_seconds' => (int) env('CHAT_STREAM_SECONDS', 25),

    // Cada cuánto revisa el stream si hay eventos nuevos (milisegundos)
    'stream_poll_ms' => (int) env('CHAT_STREAM_POLL_MS', 1000),

    // Segundos que dura el aviso de "escribiendo..."
    'typing_ttl_seconds' => (int) env('CHAT_TYPING_TTL_SECONDS', 5),

    // Cada cuántos segundos el stream revisa quién está en línea
    'presence_interval_seconds' => (int) env('CHAT_PRESENCE_INTERVAL_SECONDS', 10),

    // Máximo de integrantes por grupo
    'max_group_members' => (int) env('CHAT_MAX_GROUP_MEMBERS', 50),

    // Adjuntos: tamaño máximo (KB) y tipos permitidos (se valida el contenido real del archivo).
    // Sin SVG ni HTML: podrían ejecutar scripts en el navegador.
    'max_attachment_kb' => (int) env('CHAT_MAX_ATTACHMENT_KB', 5120),
    'attachment_extensions' => ['jpg', 'jpeg', 'png', 'gif', 'webp', 'pdf', 'txt', 'doc', 'docx', 'xls', 'xlsx', 'zip'],

    // Reacciones permitidas
    'reactions' => ['👍', '❤️', '😂', '😮', '😢', '🙏'],
];
