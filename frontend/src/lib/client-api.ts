import type { Conversation, Message, User } from "@/types/chat";

/**
 * Cliente del navegador: llama a /api/proxy (Route Handler de Next.js), que agrega el token
 * desde la cookie httpOnly y reenvía la petición a Laravel.
 */
async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`/api/proxy/${path}`, {
    ...init,
    headers: { Accept: "application/json", "Content-Type": "application/json", ...init?.headers },
    cache: "no-store",
  });

  if (res.status === 401) {
    window.location.assign("/api/session/expired");
    throw new Error("La sesión expiró.");
  }

  const body = await res.json().catch(() => null);
  if (!res.ok) {
    const message =
      (body && typeof body.message === "string" && body.message) ||
      (res.status === 429 ? "Vas muy rápido, espera unos segundos." : `Error ${res.status}`);
    throw new Error(message);
  }
  return body as T;
}

export const fetchConversations = () => request<Conversation[]>("conversations");
export const fetchMessages = (chatId: string, before?: string) =>
  request<Message[]>(`conversations/${chatId}/messages${before ? `?before=${encodeURIComponent(before)}` : ""}`);
export const searchUsers = (search: string) => request<User[]>(`users?search=${encodeURIComponent(search)}`);

export const startConversation = (userId: string) =>
  request<Conversation>("conversations", { method: "POST", body: JSON.stringify({ userId: Number(userId) }) });

export const sendMessage = (chatId: string, content: string) =>
  request<Message>(`conversations/${chatId}/messages`, { method: "POST", body: JSON.stringify({ content }) });

export const markRead = (chatId: string) =>
  request<{ readAt: string }>(`conversations/${chatId}/read`, { method: "POST", body: "{}" });

export const notifyTyping = (chatId: string) =>
  request<{ ok: boolean }>(`conversations/${chatId}/typing`, { method: "POST", body: "{}" });

export async function logout(): Promise<void> {
  await fetch("/api/session", { method: "DELETE" });
}
