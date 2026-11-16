import type { NextRequest } from "next/server";
import { API_URL, SESSION_COOKIE } from "@/lib/config";

/**
 * GET /api/stream: reenvía al navegador el stream de eventos (SSE) de Laravel.
 * El navegador usa EventSource contra el mismo dominio, así la cookie httpOnly viaja sola
 * y el token nunca se expone en la URL ni en JavaScript.
 */
export async function GET(request: NextRequest) {
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  if (!token) return new Response("No autenticado", { status: 401 });

  const headers: Record<string, string> = {
    Accept: "text/event-stream",
    Authorization: `Bearer ${token}`,
  };
  // Al reconectar, EventSource envía el último ID recibido para no perder mensajes
  const lastEventId = request.headers.get("last-event-id");
  if (lastEventId && /^\d+$/.test(lastEventId)) headers["Last-Event-ID"] = lastEventId;

  let upstream: Response;
  try {
    upstream = await fetch(`${API_URL}/stream`, { headers, signal: request.signal, cache: "no-store" });
  } catch {
    return new Response("La API no está disponible", { status: 502 });
  }

  if (!upstream.ok || !upstream.body) {
    return new Response(null, { status: upstream.status === 401 ? 401 : 502 });
  }

  return new Response(upstream.body, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      // no-transform: evita que la compresión acumule los eventos antes de enviarlos
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
