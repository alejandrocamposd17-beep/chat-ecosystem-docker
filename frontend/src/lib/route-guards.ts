import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, SESSION_MAX_AGE } from "./config";

/**
 * Protección CSRF para los Route Handlers que cambian datos: el navegador siempre envía Origin
 * en peticiones POST/DELETE; si viene de otro sitio se rechaza. Además la cookie es SameSite=Lax.
 */
export function isSameOrigin(request: NextRequest): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return true; // peticiones del mismo sitio sin Origin (algunos navegadores en GET)
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

function isHttps(request: NextRequest): boolean {
  return request.headers.get("x-forwarded-proto") === "https" || request.nextUrl.protocol === "https:";
}

export function setSessionCookie(response: NextResponse, request: NextRequest, token: string) {
  response.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: isHttps(request),
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE,
  });
}

export function clearSessionCookie(response: NextResponse) {
  response.cookies.set(SESSION_COOKIE, "", { httpOnly: true, sameSite: "lax", path: "/", maxAge: 0 });
}

export function forbidden() {
  return NextResponse.json({ message: "Origen no permitido." }, { status: 403 });
}
