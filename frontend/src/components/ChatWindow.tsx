"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import type { Conversation, Message } from "@/types/chat";
import { deleteMessage, fetchConversation, fetchMessages, markRead, searchMessages, toggleReaction } from "@/lib/client-api";
import { formatTime } from "@/lib/format";
import Avatar, { GroupAvatar, statusLabel } from "./Avatar";
import Composer from "./Composer";
import GroupPanel from "./GroupPanel";
import MessageBubble from "./MessageBubble";
import { useRealtime } from "./RealtimeProvider";

const PAGE_SIZE = 50;
const TYPING_HIDE_AFTER_MS = 6000;

export default function ChatWindow({
  conversation: initialConversation,
  initialMessages,
  meId,
}: {
  conversation: Conversation;
  initialMessages: Message[];
  meId: string;
}) {
  const router = useRouter();
  const [conversation, setConversation] = useState(initialConversation);
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [hasOlder, setHasOlder] = useState(initialMessages.length === PAGE_SIZE);
  const [reads, setReads] = useState<Record<string, string | null>>(() =>
    Object.fromEntries(initialConversation.readStates.map((r) => [r.userId, r.lastReadAt])),
  );
  const [typingIds, setTypingIds] = useState<string[]>([]);
  const [replyTo, setReplyTo] = useState<Message | null>(null);
  const [editing, setEditing] = useState<Message | null>(null);
  const [panel, setPanel] = useState<"none" | "group" | "search">("none");
  const [highlight, setHighlight] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const typingTimers = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  const chatId = conversation.id;
  const isGroup = conversation.type === "group";

  // Al abrir el chat (y al volver a la pestaña) se marca como leído: los demás verán "Visto"
  useEffect(() => {
    const read = () => {
      if (document.visibilityState === "visible") markRead(chatId).catch(() => {});
    };
    read();
    document.addEventListener("visibilitychange", read);
    const timers = typingTimers.current;
    return () => {
      document.removeEventListener("visibilitychange", read);
      timers.forEach(clearTimeout);
    };
  }, [chatId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length, typingIds.length]);

  function stopTyping(userId: string) {
    clearTimeout(typingTimers.current.get(userId));
    typingTimers.current.delete(userId);
    setTypingIds((ids) => ids.filter((id) => id !== userId));
  }

  function refreshConversation() {
    fetchConversation(chatId)
      .then(setConversation)
      // Ya no participo (me quitaron del grupo): vuelvo a la lista
      .catch(() => router.replace("/"));
  }

  useRealtime((event) => {
    switch (event.type) {
      case "message": {
        const m = event.data;
        if (m.chatId !== chatId) return;
        setMessages((list) => (list.some((x) => x.id === m.id) ? list : [...list, m]));
        if (!m.isSelf) {
          stopTyping(m.senderId);
          if (document.visibilityState === "visible") markRead(chatId).catch(() => {});
        }
        // Mensajes del sistema (alguien entró o salió del grupo): se actualizan los integrantes
        if (m.kind === "system") refreshConversation();
        break;
      }
      case "message_updated": {
        const m = event.data;
        if (m.chatId !== chatId) return;
        setMessages((list) => list.map((x) => (x.id === m.id ? m : x)));
        break;
      }
      case "read":
        if (event.data.chatId === chatId) setReads((r) => ({ ...r, [event.data.userId]: event.data.readAt }));
        break;
      case "typing": {
        const { chatId: id, userId, typing } = event.data;
        if (id !== chatId) return;
        if (!typing) {
          stopTyping(userId);
          return;
        }
        setTypingIds((ids) => (ids.includes(userId) ? ids : [...ids, userId]));
        clearTimeout(typingTimers.current.get(userId));
        typingTimers.current.set(userId, setTimeout(() => stopTyping(userId), TYPING_HIDE_AFTER_MS));
        break;
      }
      case "presence": {
        const { userId, status, lastSeenAt } = event.data;
        setConversation((c) => ({
          ...c,
          user: c.user?.id === userId ? { ...c.user, status, lastSeenAt } : c.user,
          participants: c.participants.map((p) => (p.id === userId ? { ...p, status, lastSeenAt } : p)),
        }));
        break;
      }
      case "conversations":
        refreshConversation();
        break;
    }
  });

  function replace(m: Message) {
    setMessages((list) => list.map((x) => (x.id === m.id ? m : x)));
  }

  async function act(action: () => Promise<Message>) {
    setError(null);
    try {
      replace(await action());
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo completar la acción");
    }
  }

  async function loadOlder() {
    const first = messages[0];
    if (!first) return;
    try {
      const older = await fetchMessages(chatId, first.id);
      setMessages((list) => [...older.filter((o) => !list.some((x) => x.id === o.id)), ...list]);
      setHasOlder(older.length === PAGE_SIZE);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudieron cargar los mensajes anteriores");
    }
  }

  function jumpTo(messageId: string) {
    const element = document.getElementById(`msg-${messageId}`);
    if (!element) {
      setError("Ese mensaje es más antiguo: usa “Cargar mensajes anteriores” y vuelve a buscar.");
      return;
    }
    element.scrollIntoView({ behavior: "smooth", block: "center" });
    setHighlight(messageId);
    setTimeout(() => setHighlight((h) => (h === messageId ? null : h)), 2000);
  }

  // "Visto": el último mensaje propio lo leyeron todos los demás participantes
  const lastSelf = [...messages].reverse().find((m) => m.isSelf && m.kind === "user" && !m.deleted);
  const others = conversation.participants.filter((p) => p.id !== meId);
  const lastSelfSeen =
    lastSelf !== undefined &&
    others.length > 0 &&
    others.every((p) => {
      const readAt = reads[p.id];
      return readAt ? new Date(readAt).getTime() >= new Date(lastSelf.createdAt).getTime() : false;
    });

  const typingNames = typingIds.map((id) => conversation.participants.find((p) => p.id === id)?.name.split(" ")[0] ?? "Alguien");
  const typingText =
    typingNames.length === 0 ? null : isGroup ? `${typingNames.join(", ")} ${typingNames.length > 1 ? "están" : "está"} escribiendo...` : "escribiendo...";
  const subtitle = typingText ?? (isGroup ? `${conversation.participants.length} integrantes` : conversation.user ? statusLabel(conversation.user.status, conversation.user.lastSeenAt) : "");

  return (
    <div className="flex h-full min-h-0 flex-1">
      <section className={`${panel === "group" ? "hidden md:flex" : "flex"} h-full min-h-0 flex-1 flex-col`}>
        <header className="flex items-center gap-3 border-b border-neutral-200 px-4 py-3 dark:border-neutral-800">
          <Link href="/" className="rounded-lg px-2 py-1 text-sm text-neutral-500 hover:bg-neutral-100 md:hidden dark:hover:bg-neutral-800" aria-label="Volver a la lista">
            ←
          </Link>
          <button
            onClick={() => isGroup && setPanel((p) => (p === "group" ? "none" : "group"))}
            className={`flex min-w-0 flex-1 items-center gap-3 text-left ${isGroup ? "cursor-pointer" : "cursor-default"}`}
            aria-label={isGroup ? "Ver información del grupo" : undefined}
          >
            {isGroup || !conversation.user ? <GroupAvatar name={conversation.name} size={40} /> : <Avatar user={conversation.user} size={40} />}
            <div className="min-w-0">
              <h2 className="truncate font-semibold">{conversation.name}</h2>
              <p className={`truncate text-xs ${typingText ? "text-indigo-600" : "text-neutral-500"}`}>{subtitle}</p>
            </div>
          </button>
          <button
            onClick={() => setPanel((p) => (p === "search" ? "none" : "search"))}
            className="rounded-lg px-2 py-1 text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-800"
            aria-label="Buscar en la conversación"
            aria-expanded={panel === "search"}
          >
            🔍
          </button>
        </header>

        {panel === "search" && <SearchBar chatId={chatId} onPick={jumpTo} onClose={() => setPanel("none")} />}

        <div className="min-h-0 flex-1 space-y-2 overflow-y-auto bg-neutral-50 px-5 py-4 dark:bg-neutral-950" aria-live="polite">
          {hasOlder && (
            <div className="text-center">
              <button onClick={loadOlder} className="rounded-full bg-white px-3 py-1 text-xs text-neutral-600 shadow-sm hover:bg-neutral-100 dark:bg-neutral-800 dark:text-neutral-300">
                Cargar mensajes anteriores
              </button>
            </div>
          )}
          {messages.length === 0 && <p className="mt-10 text-center text-sm text-neutral-500">Escribe el primer mensaje.</p>}
          {messages.map((m) => (
            <MessageBubble
              key={m.id}
              message={m}
              isGroup={isGroup}
              highlighted={highlight === m.id}
              status={m.id === lastSelf?.id ? (lastSelfSeen ? "Visto" : "Enviado") : null}
              onReply={(msg) => {
                setEditing(null);
                setReplyTo(msg);
              }}
              onEdit={(msg) => {
                setReplyTo(null);
                setEditing(msg);
              }}
              onDelete={(msg) => {
                if (window.confirm("¿Eliminar este mensaje para todos?")) act(() => deleteMessage(chatId, msg.id));
              }}
              onReact={(msg, emoji) => act(() => toggleReaction(chatId, msg.id, emoji))}
            />
          ))}
          {typingText && (
            <div className="flex justify-start">
              <div className="rounded-2xl rounded-bl-sm bg-white px-4 py-2 text-sm text-neutral-500 shadow-sm dark:bg-neutral-800">{typingText}</div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        {error && (
          <p role="alert" className="border-t border-neutral-200 px-4 py-2 text-sm text-red-600 dark:border-neutral-800">
            {error}
          </p>
        )}

        <Composer
          key={editing ? `edit-${editing.id}` : "new"}
          chatId={chatId}
          replyTo={replyTo}
          editing={editing}
          onCancel={() => {
            setReplyTo(null);
            setEditing(null);
          }}
          onSent={(m) => {
            setMessages((list) => (list.some((x) => x.id === m.id) ? list : [...list, m]));
            setReplyTo(null);
          }}
          onEdited={(m) => {
            replace(m);
            setEditing(null);
          }}
        />
      </section>

      {panel === "group" && isGroup && (
        <GroupPanel conversation={conversation} meId={meId} onChange={setConversation} onClose={() => setPanel("none")} />
      )}
    </div>
  );
}

function SearchBar({ chatId, onPick, onClose }: { chatId: string; onPick: (id: string) => void; onClose: () => void }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Message[] | null>(null);
  const [loading, setLoading] = useState(false);

  async function search(e: React.FormEvent) {
    e.preventDefault();
    if (!query.trim()) return;
    setLoading(true);
    try {
      setResults(await searchMessages(chatId, query.trim()));
    } catch {
      setResults([]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="border-b border-neutral-200 p-3 dark:border-neutral-800">
      <form onSubmit={search} className="flex gap-2">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar en esta conversación..."
          aria-label="Buscar en esta conversación"
          maxLength={100}
          className="flex-1 rounded-lg border border-neutral-300 bg-white px-3 py-1.5 text-sm outline-none focus:border-indigo-500 dark:border-neutral-700 dark:bg-neutral-900"
        />
        <button className="rounded-lg bg-indigo-600 px-3 text-sm text-white">{loading ? "..." : "Buscar"}</button>
        <button type="button" onClick={onClose} className="text-sm text-neutral-500 hover:underline">
          Cerrar
        </button>
      </form>
      {results && (
        <ul className="mt-2 max-h-48 overflow-y-auto text-sm">
          {results.length === 0 && <li className="p-2 text-neutral-500">Sin resultados.</li>}
          {[...results].reverse().map((m) => (
            <li key={m.id}>
              <button onClick={() => onPick(m.id)} className="block w-full rounded-lg p-2 text-left hover:bg-neutral-100 dark:hover:bg-neutral-800">
                <span className="text-xs text-neutral-500">
                  {m.isSelf ? "Tú" : m.senderName} · {formatTime(m.createdAt)}
                </span>
                <span className="block truncate">{m.content ?? (m.attachment ? `📎 ${m.attachment.name}` : "")}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
