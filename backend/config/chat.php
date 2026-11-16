<?php

return [
    // Días de vigencia de un token de sesión (0 = no expira)
    'token_ttl_days' => (int) env('CHAT_TOKEN_TTL_DAYS', 30),

    // Segundos desde la última actividad para mostrar a un usuario "en línea"
    'online_window_seconds' => (int) env('CHAT_ONLINE_WINDOW_SECONDS', 90),

    // Duración de cada conexión del stream de eventos (el cliente se reconecta solo)
    'stream_seconds' => (int) env('CHAT_STREAM_SECONDS', 25),

    // Cada cuánto revisa el stream si hay eventos nuevos (milisegundos)
    'stream_poll_ms' => (int) env('CHAT_STREAM_POLL_MS', 1000),

    // Segundos que dura el aviso de "escribiendo..."
    'typing_ttl_seconds' => (int) env('CHAT_TYPING_TTL_SECONDS', 5),
];
