import type { Conversation, Message, User } from "@/types/chat";

/**
 * Cliente del navegador: llama a /api/proxy?path=... (Route Handler de Next.js), que agrega el token
 * desde la cookie httpOnly y reenvía la petición a Laravel.
 */
async function request<T>(
  path: string,
  init?: RequestInit,
  query: Record<string, string> = {},
): Promise<T> {
  const params = new URLSearchParams({ path, ...query });
  const res = await fetch(`/api/proxy?${params}`, {
    ...init,
    headers: { Accept: "application/json", "Content-Type": "application/json", ...init?.headers },
    cache: "no-store",
  });
  return handle<T>(res);
}

async function handle<T>(res: Response): Promise<T> {
  if (res.status === 401) {
    window.location.assign("/api/session/expired");
    throw new Error("La sesión expiró.");
  }

  const body = await res.json().catch(() => null);
  if (!res.ok) {
    const firstError =
      body?.errors && typeof body.errors === "object"
        ? (Object.values(body.errors as Record<string, string[]>)[0]?.[0] ?? null)
        : null;
    const message =
      firstError ||
      (body && typeof body.message === "string" && body.message) ||
      (res.status === 429 ? "Vas muy rápido, espera unos segundos." : `Error ${res.status}`);
    throw new Error(message);
  }
  return body as T;
}

const json = (method: string, data: unknown = {}): RequestInit => ({ method, body: JSON.stringify(data) });

// Conversaciones y grupos
export const fetchConversations = () => request<Conversation[]>("conversations");
export const fetchConversation = (chatId: string) => request<Conversation>(`conversations/${chatId}`);
export const startConversation = (userId: string) =>
  request<Conversation>("conversations", json("POST", { userId: Number(userId) }));
export const createGroup = (name: string, userIds: string[]) =>
  request<Conversation>("conversations", json("POST", { name, userIds: userIds.map(Number) }));
export const renameGroup = (chatId: string, name: string) =>
  request<Conversation>(`conversations/${chatId}`, json("PATCH", { name }));
export const addMember = (chatId: string, userId: string) =>
  request<Conversation>(`conversations/${chatId}/participants`, json("POST", { userId: Number(userId) }));
export const removeMember = (chatId: string, userId: string) =>
  request<{ ok: boolean }>(`conversations/${chatId}/participants/${userId}`, { method: "DELETE" });
export const markRead = (chatId: string) => request<{ readAt: string }>(`conversations/${chatId}/read`, json("POST"));
export const notifyTyping = (chatId: string) => request<{ ok: boolean }>(`conversations/${chatId}/typing`, json("POST"));

// Mensajes
export const fetchMessages = (chatId: string, before?: string) =>
  request<Message[]>(`conversations/${chatId}/messages`, undefined, before ? { before } : {});
export const searchMessages = (chatId: string, search: string) =>
  request<Message[]>(`conversations/${chatId}/messages`, undefined, { search });
export const editMessage = (chatId: string, messageId: string, content: string) =>
  request<Message>(`conversations/${chatId}/messages/${messageId}`, json("PATCH", { content }));
export const deleteMessage = (chatId: string, messageId: string) =>
  request<Message>(`conversations/${chatId}/messages/${messageId}`, { method: "DELETE" });
export const toggleReaction = (chatId: string, messageId: string, emoji: string) =>
  request<Message>(`conversations/${chatId}/messages/${messageId}/reactions`, json("POST", { emoji }));

/** Envía un mensaje (texto, archivo o ambos). Con archivo va como multipart a /api/upload. */
export async function sendMessage(
  chatId: string,
  content: string,
  options: { file?: File | null; replyToId?: string | null } = {},
): Promise<Message> {
  const form = new FormData();
  if (content) form.append("content", content);
  if (options.file) form.append("attachment", options.file);
  if (options.replyToId) form.append("replyToId", options.replyToId);

  const res = await fetch(`/api/upload?target=message&chat=${encodeURIComponent(chatId)}`, {
    method: "POST",
    headers: { Accept: "application/json" },
    body: form,
  });
  return handle<Message>(res);
}

// Usuarios y perfil
export const searchUsers = (search: string) => request<User[]>("users", undefined, { search });
export const updateProfile = (name: string) => request<User>("me", json("PATCH", { name }));
export const removeAvatar = () => request<User>("me/avatar", { method: "DELETE" });
export const changePassword = (current_password: string, password: string, password_confirmation: string) =>
  request<{ message: string }>("me/password", json("PUT", { current_password, password, password_confirmation }));

export async function uploadAvatar(file: File): Promise<User> {
  const form = new FormData();
  form.append("avatar", file);
  const res = await fetch("/api/upload?target=avatar", { method: "POST", headers: { Accept: "application/json" }, body: form });
  return handle<User>(res);
}

export async function logout(): Promise<void> {
  await fetch("/api/session", { method: "DELETE" });
}
