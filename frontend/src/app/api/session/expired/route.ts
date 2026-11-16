import { NextResponse, type NextRequest } from "next/server";
import { clearSessionCookie } from "@/lib/route-guards";

/** GET /api/session/expired: la API rechazó el token; se borra la cookie y se vuelve al login. */
export function GET(request: NextRequest) {
  const response = NextResponse.redirect(new URL("/login?expired=1", request.url));
  clearSessionCookie(response);
  return response;
}
