import type { NextRequest } from "next/server";
import { API_URL, SESSION_COOKIE } from "@/lib/config";

/**
 * GET /api/file?type=attachment&id=12  (adjunto de un mensaje)
 * GET /api/file?type=avatar&id=3       (foto de perfil)
 * Los archivos son privados en Laravel: Next.js los pide con el token de la cookie.
 */
export async function GET(request: NextRequest) {
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  if (!token) return new Response("No autenticado", { status: 401 });

  const type = request.nextUrl.searchParams.get("type");
  const id = request.nextUrl.searchParams.get("id") ?? "";
  if (!/^\d+$/.test(id) || (type !== "attachment" && type !== "avatar")) {
    return new Response("No encontrado", { status: 404 });
  }

  const path = type === "attachment" ? `attachments/${id}` : `users/${id}/avatar`;
  const upstream = await fetch(`${API_URL}/${path}`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });

  if (!upstream.ok || !upstream.body) {
    return new Response(null, { status: upstream.status === 401 ? 401 : 404 });
  }

  const headers = new Headers({
    "Content-Type": upstream.headers.get("Content-Type") ?? "application/octet-stream",
    "Cache-Control": upstream.headers.get("Cache-Control") ?? "private, max-age=3600",
    // El archivo nunca se interpreta como página: sin scripts aunque alguien suba algo malicioso
    "X-Content-Type-Options": "nosniff",
    "Content-Security-Policy": "default-src 'none'; img-src 'self'; style-src 'unsafe-inline'; sandbox",
  });
  const disposition = upstream.headers.get("Content-Disposition");
  if (disposition) headers.set("Content-Disposition", disposition);
  const length = upstream.headers.get("Content-Length");
  if (length) headers.set("Content-Length", length);

  return new Response(upstream.body, { headers });
}
