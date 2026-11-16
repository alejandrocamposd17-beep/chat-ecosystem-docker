// Modelos compartidos con la API Laravel (mismas claves que los API Resources)

export interface User {
  id: string;
  name: string;
  avatarUrl: string;
  avatarVersion?: number | null;
  isGuest?: boolean;
  status: "online" | "offline" | "away";
  lastSeenAt?: string | null;
}

export interface Reaction {
  emoji: string;
  count: number;
  mine: boolean;
}

export interface Attachment {
  name: string;
  mime: string;
  size: number;
  isImage: boolean;
}

export interface Message {
  id: string;
  chatId: string;
  senderId: string;
  senderName: string;
  kind: "user" | "system";
  content: string | null;
  createdAt: string;
  editedAt: string | null;
  deleted: boolean;
  isSelf: boolean;
  replyTo: {
    id: string;
    senderName: string;
    content: string | null;
    hasAttachment: boolean;
    deleted: boolean;
  } | null;
  attachment: Attachment | null;
  reactions: Reaction[];
}

export interface ReadState {
  userId: string;
  lastReadAt: string | null;
}

export interface Conversation {
  id: string;
  type: "direct" | "group";
  name: string;
  user: User | null;
  participants: User[];
  myRole: "admin" | "member";
  lastMessage: string;
  lastMessageIsSelf: boolean;
  lastMessageSender: string | null;
  updatedAt: string;
  unreadCount: number;
  readStates: ReadState[];
}

// Eventos en tiempo real que llegan por /api/stream (Server-Sent Events)
export type RealtimeEvent =
  | { type: "message"; data: Message }
  | { type: "message_updated"; data: Message }
  | { type: "typing"; data: { chatId: string; userId: string; typing: boolean } }
  | { type: "read"; data: { chatId: string; userId: string; readAt: string } }
  | { type: "presence"; data: { userId: string; status: User["status"]; lastSeenAt: string | null } }
  | { type: "conversations"; data: { changed: boolean } };

export const REACTIONS = ["👍", "❤️", "😂", "😮", "😢", "🙏"] as const;
