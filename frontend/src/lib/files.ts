import type { User } from "@/types/chat";

/** Foto de perfil: la subida por el usuario (vía Next.js) o el avatar con iniciales. */
export function avatarSrc(user: Pick<User, "id" | "avatarUrl" | "avatarVersion">): string {
  if (user.avatarVersion) return `/api/file?type=avatar&id=${encodeURIComponent(user.id)}&v=${user.avatarVersion}`;
  return user.avatarUrl;
}

/** URL del adjunto de un mensaje (Next.js lo pide a la API con el token de la sesión). */
export function attachmentSrc(messageId: string): string {
  return `/api/file?type=attachment&id=${encodeURIComponent(messageId)}`;
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export const MAX_ATTACHMENT_BYTES = 5 * 1024 * 1024;
export const ATTACHMENT_ACCEPT = ".jpg,.jpeg,.png,.gif,.webp,.pdf,.txt,.doc,.docx,.xls,.xlsx,.zip";
