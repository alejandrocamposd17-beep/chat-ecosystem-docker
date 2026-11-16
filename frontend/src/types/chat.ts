// Modelos compartidos con la API Laravel (mismas claves que los API Resources)

export interface User {
  id: string;
  name: string;
  avatarUrl: string;
  status: "online" | "offline" | "away";
  lastSeenAt?: string | null;
}

export interface Message {
  id: string;
  chatId: string;
  senderId: string;
  content: string;
  createdAt: string;
  isSelf: boolean;
}

export interface Conversation {
  id: string;
  user: User | null;
  lastMessage: string;
  lastMessageIsSelf: boolean;
  updatedAt: string;
  unreadCount: number;
  otherLastReadAt: string | null;
}

// Eventos en tiempo real que llegan por /api/stream (Server-Sent Events)
export type RealtimeEvent =
  | { type: "message"; data: Message }
  | { type: "typing"; data: { chatId: string; userId: string; typing: boolean } }
  | { type: "read"; data: { chatId: string; userId: string; readAt: string } };
