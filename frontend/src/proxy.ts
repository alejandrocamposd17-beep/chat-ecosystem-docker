import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE } from "@/lib/config";

const PUBLIC_PATHS = ["/login", "/register"];

/** Redirige al login si no hay sesión, y fuera del login si ya hay una. */
export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const hasSession = Boolean(request.cookies.get(SESSION_COOKIE)?.value);
  const isPublic = PUBLIC_PATHS.includes(pathname);

  if (!hasSession && !isPublic) {
    return NextResponse.redirect(new URL("/login", request.url));
  }
  if (hasSession && isPublic) {
    return NextResponse.redirect(new URL("/", request.url));
  }
  return NextResponse.next();
}

export const config = {
  // Páginas de la app (no Route Handlers, archivos estáticos ni assets de Next.js)
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|robots.txt).*)"],
};
