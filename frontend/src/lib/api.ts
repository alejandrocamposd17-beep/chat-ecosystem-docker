import type { Conversation, Message } from "@/types/chat";

/**
 * URL de la API segun donde corre el codigo:
 * - Servidor (Server Components, dentro de Docker): API_INTERNAL_URL -> http://api:8000/api
 * - Navegador: NEXT_PUBLIC_API_URL -> http://localhost:8000/api (incrustada en el build)
 */
export function apiUrl(): string {
  if (typeof window === "undefined") {
    return process.env.API_INTERNAL_URL ?? process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000/api";
  }
  return process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000/api";
}

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${apiUrl()}${path}`, {
    headers: { Accept: "application/json" },
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`La API respondio ${res.status} en ${path}`);
  }
  return res.json() as Promise<T>;
}

export const getConversations = () => get<Conversation[]>("/conversations");
export const getConversation = (id: string) => get<Conversation>(`/conversations/${id}`);
export const getMessages = (id: string) => get<Message[]>(`/conversations/${id}/messages`);

export async function sendMessage(chatId: string, content: string): Promise<Message> {
  const res = await fetch(`${apiUrl()}/conversations/${chatId}/messages`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ content }),
  });
  if (!res.ok) {
    throw new Error(`No se pudo enviar el mensaje (${res.status})`);
  }
  return res.json() as Promise<Message>;
}
