import { NextResponse, type NextRequest } from "next/server";
import { API_URL, SESSION_COOKIE } from "@/lib/config";
import { clearSessionCookie, forbidden, isSameOrigin, setSessionCookie } from "@/lib/route-guards";

/** POST /api/session: inicia sesión en Laravel y guarda el token en una cookie httpOnly. */
export async function POST(request: NextRequest) {
  if (!isSameOrigin(request)) return forbidden();

  const body = await request.json().catch(() => ({}));
  const res = await fetch(`${API_URL}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ email: body?.email, password: body?.password }),
    cache: "no-store",
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok || typeof data?.token !== "string") {
    return NextResponse.json(data, { status: res.status === 200 ? 502 : res.status });
  }

  // El token no se devuelve al navegador: solo viaja en la cookie httpOnly
  const response = NextResponse.json({ user: data.user });
  setSessionCookie(response, request, data.token);
  return response;
}

/** DELETE /api/session: revoca el token en Laravel y borra la cookie. */
export async function DELETE(request: NextRequest) {
  if (!isSameOrigin(request)) return forbidden();

  const token = request.cookies.get(SESSION_COOKIE)?.value;
  if (token) {
    await fetch(`${API_URL}/auth/logout`, {
      method: "POST",
      headers: { Accept: "application/json", Authorization: `Bearer ${token}` },
      cache: "no-store",
    }).catch(() => null);
  }

  const response = NextResponse.json({ ok: true });
  clearSessionCookie(response);
  return response;
}
