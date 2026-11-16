import { NextResponse, type NextRequest } from "next/server";
import { API_URL, SESSION_COOKIE } from "@/lib/config";
import { clearSessionCookie, forbidden, isSameOrigin } from "@/lib/route-guards";

// Solo se reenvían estas rutas de la API (evita usar el proxy para llegar a otros endpoints)
const ALLOWED = new RegExp(
  "^(" +
    [
      "me",
      "me/avatar",
      "me/password",
      "users",
      "conversations",
      "conversations/\\d+",
      "conversations/\\d+/(read|typing|participants|messages)",
      "conversations/\\d+/participants/\\d+",
      "conversations/\\d+/messages/\\d+",
      "conversations/\\d+/messages/\\d+/reactions",
    ].join("|") +
    ")$",
);

type Method = "GET" | "POST" | "PATCH" | "PUT" | "DELETE";

/**
 * /api/proxy?path=conversations/1/messages&before=10
 * Reenvía la petición JSON a Laravel agregando el token de la cookie httpOnly.
 */
async function forward(request: NextRequest, method: Method) {
  if (method !== "GET" && !isSameOrigin(request)) return forbidden();

  const params = new URLSearchParams(request.nextUrl.searchParams);
  const path = params.get("path") ?? "";
  params.delete("path");
  if (!ALLOWED.test(path)) {
    return NextResponse.json({ message: "Ruta no permitida." }, { status: 404 });
  }

  const token = request.cookies.get(SESSION_COOKIE)?.value;
  if (!token) return NextResponse.json({ message: "No autenticado." }, { status: 401 });

  const query = params.toString();
  const res = await fetch(`${API_URL}/${path}${query ? `?${query}` : ""}`, {
    method,
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: method === "GET" ? undefined : await request.text(),
    cache: "no-store",
  });

  const response = new NextResponse(await res.text(), {
    status: res.status,
    headers: { "Content-Type": res.headers.get("Content-Type") ?? "application/json" },
  });
  if (res.status === 401) clearSessionCookie(response);
  return response;
}

export function GET(request: NextRequest) {
  return forward(request, "GET");
}

export function POST(request: NextRequest) {
  return forward(request, "POST");
}

export function PATCH(request: NextRequest) {
  return forward(request, "PATCH");
}

export function PUT(request: NextRequest) {
  return forward(request, "PUT");
}

export function DELETE(request: NextRequest) {
  return forward(request, "DELETE");
}
