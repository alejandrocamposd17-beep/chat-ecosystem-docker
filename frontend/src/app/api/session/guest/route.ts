import { NextResponse, type NextRequest } from "next/server";
import { API_URL } from "@/lib/config";
import { forbidden, isSameOrigin, setSessionCookie } from "@/lib/route-guards";

/** POST /api/session/guest: crea una cuenta de invitado temporal e inicia sesión. */
export async function POST(request: NextRequest) {
  if (!isSameOrigin(request)) return forbidden();

  const res = await fetch(`${API_URL}/auth/guest`, {
    method: "POST",
    headers: { Accept: "application/json" },
    cache: "no-store",
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok || typeof data?.token !== "string") {
    return NextResponse.json(data, { status: res.status === 201 ? 502 : res.status });
  }

  const response = NextResponse.json({ user: data.user }, { status: 201 });
  setSessionCookie(response, request, data.token);
  return response;
}
