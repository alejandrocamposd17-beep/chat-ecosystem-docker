import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { API_URL, SESSION_COOKIE } from "./config";
import type { Conversation, Message, User } from "@/types/chat";

export class ApiRequestError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}

/** Llama a la API desde el servidor con el token de la cookie de sesión. */
async function apiGet<T>(path: string): Promise<T> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) redirect("/login");

  const res = await fetch(`${API_URL}${path}`, {
    headers: { Accept: "application/json", Authorization: `Bearer ${token}` },
    cache: "no-store",
  });

  // Token vencido o revocado: se borra la cookie y se vuelve al login
  if (res.status === 401) redirect("/api/session/expired");
  if (!res.ok) throw new ApiRequestError(`La API respondió ${res.status} en ${path}`, res.status);

  return res.json() as Promise<T>;
}

export const getMe = () => apiGet<User>("/me");
export const getConversations = () => apiGet<Conversation[]>("/conversations");
export const getConversation = (id: string) => apiGet<Conversation>(`/conversations/${encodeURIComponent(id)}`);
export const getMessages = (id: string) => apiGet<Message[]>(`/conversations/${encodeURIComponent(id)}/messages`);
