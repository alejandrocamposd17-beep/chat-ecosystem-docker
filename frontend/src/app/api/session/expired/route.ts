import { NextResponse } from "next/server";
import { clearSessionCookie } from "@/lib/route-guards";

/**
 * GET /api/session/expired: la API rechazó el token; se borra la cookie y se vuelve al login.
 * La redirección es relativa: detrás de un proxy (Render), request.url trae el host interno
 * del contenedor (0.0.0.0:3000) y una URL absoluta mandaría al navegador a una dirección inválida.
 */
export function GET() {
  const response = new NextResponse(null, { status: 307, headers: { Location: "/login?expired=1" } });
  clearSessionCookie(response);
  return response;
}
