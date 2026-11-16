import { NextResponse, type NextRequest } from "next/server";
import { API_URL, SESSION_COOKIE } from "@/lib/config";
import { clearSessionCookie, forbidden, isSameOrigin } from "@/lib/route-guards";

/**
 * POST /api/upload?target=message&chat=1  (mensaje con archivo, multipart)
 * POST /api/upload?target=avatar           (foto de perfil)
 * Reenvía el formulario a Laravel con el token de la cookie; la API valida tipo y tamaño.
 */
export async function POST(request: NextRequest) {
  if (!isSameOrigin(request)) return forbidden();

  const token = request.cookies.get(SESSION_COOKIE)?.value;
  if (!token) return NextResponse.json({ message: "No autenticado." }, { status: 401 });

  const target = request.nextUrl.searchParams.get("target");
  const chat = request.nextUrl.searchParams.get("chat") ?? "";

  let path: string;
  if (target === "message" && /^\d+$/.test(chat)) path = `conversations/${chat}/messages`;
  else if (target === "avatar") path = "me/avatar";
  else return NextResponse.json({ message: "Destino no permitido." }, { status: 404 });

  const form = await request.formData().catch(() => null);
  if (!form) return NextResponse.json({ message: "Formulario inválido." }, { status: 400 });

  const res = await fetch(`${API_URL}/${path}`, {
    method: "POST",
    headers: { Accept: "application/json", Authorization: `Bearer ${token}` },
    body: form,
    cache: "no-store",
  });

  const response = new NextResponse(await res.text(), {
    status: res.status,
    headers: { "Content-Type": res.headers.get("Content-Type") ?? "application/json" },
  });
  if (res.status === 401) clearSessionCookie(response);
  return response;
}
