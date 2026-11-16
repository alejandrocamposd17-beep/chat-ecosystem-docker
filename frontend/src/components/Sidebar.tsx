"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import type { Conversation, User } from "@/types/chat";
import { createGroup, fetchConversations, logout, searchUsers, startConversation } from "@/lib/client-api";
import { formatTime } from "@/lib/format";
import Avatar, { GroupAvatar } from "./Avatar";
import { useRealtime, useRealtimeStatus } from "./RealtimeProvider";

type NotifyPermission = "default" | "granted" | "denied" | "unsupported";

function currentPermission(): NotifyPermission {
  if (typeof window === "undefined" || !("Notification" in window)) return "unsupported";
  return Notification.permission;
}

// El permiso se lee del navegador; en el servidor no existe (evita diferencias al hidratar)
const subscribeNoop = () => () => {};
const serverPermission = (): NotifyPermission => "unsupported";

export default function Sidebar({ me, initialConversations }: { me: User; initialConversations: Conversation[] }) {
  const pathname = usePathname();
  const router = useRouter();
  const status = useRealtimeStatus();
  const [conversations, setConversations] = useState(initialConversations);
  const [typing, setTyping] = useState<Record<string, string[]>>({});
  const [showNew, setShowNew] = useState(false);
  const [, refreshPermission] = useState(0);
  const permission = useSyncExternalStore(subscribeNoop, currentPermission, serverPermission);
  const activeId = pathname.startsWith("/chat/") ? pathname.split("/")[2] : null;

  const totalUnread = conversations.reduce((sum, c) => sum + (c.id === activeId ? 0 : c.unreadCount), 0);

  // Contador de no leídos en el título de la pestaña: "(3) Chat"
  useEffect(() => {
    document.title = totalUnread > 0 ? `(${totalUnread}) Chat en tiempo real` : "Chat en tiempo real";
  }, [totalUnread]);

  const reload = () => fetchConversations().then(setConversations).catch(() => {});

  useRealtime((event) => {
    switch (event.type) {
      case "message": {
        const m = event.data;
        const current = conversations.find((c) => c.id === m.chatId);
        if (!current) {
          reload(); // Alguien inició un chat o un grupo conmigo
          return;
        }
        const preview = m.content ?? (m.attachment ? (m.attachment.isImage ? "📷 Foto" : `📎 ${m.attachment.name}`) : "");
        setConversations((list) => {
          const updated: Conversation = {
            ...current,
            lastMessage: preview,
            lastMessageIsSelf: m.isSelf && m.kind === "user",
            lastMessageSender: current.type === "group" && m.kind === "user" ? m.senderName : null,
            updatedAt: m.createdAt,
            unreadCount: m.isSelf || m.chatId === activeId ? 0 : current.unreadCount + 1,
          };
          return [updated, ...list.filter((c) => c.id !== m.chatId)];
        });
        setTyping((t) => ({ ...t, [m.chatId]: (t[m.chatId] ?? []).filter((id) => id !== m.senderId) }));
        notify(m.isSelf, m.chatId, current.type === "group" ? `${m.senderName} · ${current.name}` : m.senderName, preview);
        break;
      }
      case "typing": {
        const { chatId, userId, typing: isTyping } = event.data;
        setTyping((t) => {
          const others = (t[chatId] ?? []).filter((id) => id !== userId);
          return { ...t, [chatId]: isTyping ? [...others, userId] : others };
        });
        break;
      }
      case "presence": {
        const { userId, status: s, lastSeenAt } = event.data;
        setConversations((list) =>
          list.map((c) => ({
            ...c,
            user: c.user?.id === userId ? { ...c.user, status: s, lastSeenAt } : c.user,
            participants: c.participants.map((p) => (p.id === userId ? { ...p, status: s, lastSeenAt } : p)),
          })),
        );
        break;
      }
      case "message_updated":
      case "conversations":
        // Edición o borrado del último mensaje, grupo nuevo o renombrado: se recarga la lista
        reload();
        break;
    }
  });

  /** Notificación del navegador cuando llega un mensaje y no se está viendo ese chat. */
  function notify(isSelf: boolean, chatId: string, title: string, body: string) {
    if (isSelf || permission !== "granted") return;
    if (document.visibilityState === "visible" && chatId === activeId) return;
    const notification = new Notification(title, { body: body.slice(0, 120), tag: `chat-${chatId}` });
    notification.onclick = () => {
      window.focus();
      router.push(`/chat/${chatId}`);
      notification.close();
    };
  }

  async function enableNotifications() {
    if (!("Notification" in window)) return;
    await Notification.requestPermission();
    refreshPermission((n) => n + 1);
  }

  function openChat(id: string) {
    setConversations((list) => list.map((c) => (c.id === id ? { ...c, unreadCount: 0 } : c)));
  }

  async function handleLogout() {
    await logout();
    router.replace("/login");
    router.refresh();
  }

  function typingLabel(c: Conversation): string | null {
    const ids = typing[c.id] ?? [];
    if (ids.length === 0) return null;
    if (c.type === "direct") return "escribiendo...";
    const names = ids.map((id) => c.participants.find((p) => p.id === id)?.name.split(" ")[0] ?? "Alguien");
    return `${names.join(", ")} ${names.length > 1 ? "están" : "está"} escribiendo...`;
  }

  return (
    <aside
      className={`${activeId || pathname === "/profile" ? "hidden md:flex" : "flex"} w-full shrink-0 flex-col border-r border-neutral-200 md:w-80 dark:border-neutral-800`}
    >
      <header className="flex items-center gap-3 border-b border-neutral-200 px-4 py-3 dark:border-neutral-800">
        <Link href="/profile" className="flex min-w-0 flex-1 items-center gap-3 rounded-lg hover:opacity-80" title="Mi perfil">
          <Avatar user={{ ...me, status: status === "open" ? "online" : "away" }} size={36} />
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">{me.name}</p>
            <p className="text-xs text-neutral-500">{status === "open" ? "Conectado en tiempo real" : "Conectando..."}</p>
          </div>
        </Link>
        <button
          onClick={() => setShowNew((v) => !v)}
          className="rounded-lg bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-700"
          aria-expanded={showNew}
        >
          Nuevo
        </button>
        <button onClick={handleLogout} className="rounded-lg px-2 py-1.5 text-sm text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-800">
          Salir
        </button>
      </header>

      {permission === "default" && (
        <button
          onClick={enableNotifications}
          className="border-b border-neutral-200 bg-indigo-50 px-4 py-2 text-left text-xs text-indigo-700 hover:bg-indigo-100 dark:border-neutral-800 dark:bg-indigo-950/40 dark:text-indigo-300"
        >
          🔔 Activa las notificaciones para enterarte de los mensajes nuevos
        </button>
      )}

      {showNew && (
        <NewChat
          onClose={() => setShowNew(false)}
          onStarted={(conversation) => {
            setConversations((list) => [conversation, ...list.filter((c) => c.id !== conversation.id)]);
            setShowNew(false);
            router.push(`/chat/${conversation.id}`);
          }}
        />
      )}

      <nav className="min-h-0 flex-1 overflow-y-auto" aria-label="Conversaciones">
        {conversations.length === 0 ? (
          <p className="p-6 text-sm text-neutral-500">Aún no tienes conversaciones. Pulsa “Nuevo” para empezar una.</p>
        ) : (
          <ul>
            {conversations.map((c) => {
              const active = c.id === activeId;
              const unread = active ? 0 : c.unreadCount;
              const typingText = typingLabel(c);
              const preview = c.lastMessage
                ? `${c.lastMessageIsSelf ? "Tú: " : c.lastMessageSender ? `${c.lastMessageSender.split(" ")[0]}: ` : ""}${c.lastMessage}`
                : "Sin mensajes";
              return (
                <li key={c.id}>
                  <Link
                    href={`/chat/${c.id}`}
                    onClick={() => openChat(c.id)}
                    className={`flex items-center gap-3 px-4 py-3 transition-colors ${
                      active ? "bg-indigo-50 dark:bg-indigo-950/40" : "hover:bg-neutral-100 dark:hover:bg-neutral-800/60"
                    }`}
                  >
                    {c.type === "group" || !c.user ? <GroupAvatar name={c.name} /> : <Avatar user={c.user} />}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline justify-between gap-2">
                        <span className={`truncate ${unread ? "font-semibold" : "font-medium"}`}>{c.name}</span>
                        {c.updatedAt && <span className="shrink-0 text-xs text-neutral-500">{formatTime(c.updatedAt)}</span>}
                      </div>
                      <div className="flex items-center gap-2">
                        <p className={`min-w-0 flex-1 truncate text-sm ${typingText ? "text-indigo-600" : "text-neutral-500"}`}>
                          {typingText ?? preview}
                        </p>
                        {unread > 0 && (
                          <span className="rounded-full bg-indigo-600 px-2 py-0.5 text-xs font-semibold text-white" aria-label={`${unread} sin leer`}>
                            {unread}
                          </span>
                        )}
                      </div>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </nav>
    </aside>
  );
}

function NewChat({ onClose, onStarted }: { onClose: () => void; onStarted: (c: Conversation) => void }) {
  const [mode, setMode] = useState<"direct" | "group">("direct");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<User[] | null>(null);
  const [selected, setSelected] = useState<User[]>([]);
  const [groupName, setGroupName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  function search(value: string) {
    setQuery(value);
    clearTimeout(timer.current);
    // Espera a que el usuario deje de escribir antes de consultar la API
    timer.current = setTimeout(() => {
      searchUsers(value)
        .then((users) => {
          setResults(users);
          setError(null);
        })
        .catch((e: unknown) => setError(e instanceof Error ? e.message : "Error al buscar"));
    }, 300);
  }

  async function pick(user: User) {
    if (mode === "group") {
      setSelected((list) => (list.some((u) => u.id === user.id) ? list.filter((u) => u.id !== user.id) : [...list, user]));
      return;
    }
    try {
      setBusy(true);
      onStarted(await startConversation(user.id));
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo iniciar el chat");
    } finally {
      setBusy(false);
    }
  }

  async function create() {
    try {
      setBusy(true);
      onStarted(await createGroup(groupName.trim(), selected.map((u) => u.id)));
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo crear el grupo");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="border-b border-neutral-200 p-3 dark:border-neutral-800">
      <div className="mb-2 flex gap-1 rounded-lg bg-neutral-100 p-1 text-sm dark:bg-neutral-800" role="tablist">
        {(["direct", "group"] as const).map((m) => (
          <button
            key={m}
            role="tab"
            aria-selected={mode === m}
            onClick={() => setMode(m)}
            className={`flex-1 rounded-md py-1 ${mode === m ? "bg-white font-medium shadow-sm dark:bg-neutral-700" : "text-neutral-500"}`}
          >
            {m === "direct" ? "Chat" : "Grupo"}
          </button>
        ))}
      </div>

      {mode === "group" && (
        <input
          value={groupName}
          onChange={(e) => setGroupName(e.target.value)}
          maxLength={80}
          placeholder="Nombre del grupo"
          aria-label="Nombre del grupo"
          className="mb-2 w-full rounded-lg border border-neutral-300 bg-white px-3 py-1.5 text-sm outline-none focus:border-indigo-500 dark:border-neutral-700 dark:bg-neutral-900"
        />
      )}

      <div className="flex gap-2">
        <input
          value={query}
          onChange={(e) => search(e.target.value)}
          onFocus={() => results === null && search("")}
          placeholder="Buscar personas..."
          aria-label="Buscar personas"
          className="flex-1 rounded-lg border border-neutral-300 bg-white px-3 py-1.5 text-sm outline-none focus:border-indigo-500 dark:border-neutral-700 dark:bg-neutral-900"
        />
        <button onClick={onClose} className="text-sm text-neutral-500 hover:underline">
          Cerrar
        </button>
      </div>

      {mode === "group" && selected.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {selected.map((u) => (
            <button key={u.id} onClick={() => pick(u)} className="rounded-full bg-indigo-100 px-2 py-0.5 text-xs text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300">
              {u.name} ✕
            </button>
          ))}
        </div>
      )}

      {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
      {results && (
        <ul className="mt-2 max-h-56 overflow-y-auto">
          {results.length === 0 && <li className="p-2 text-sm text-neutral-500">Sin resultados.</li>}
          {results.map((u) => {
            const isSelected = selected.some((s) => s.id === u.id);
            return (
              <li key={u.id}>
                <button
                  onClick={() => pick(u)}
                  disabled={busy}
                  className="flex w-full items-center gap-3 rounded-lg p-2 text-left hover:bg-neutral-100 dark:hover:bg-neutral-800"
                >
                  <Avatar user={u} size={32} />
                  <span className="flex-1 text-sm">{u.name}</span>
                  {mode === "group" && <span className="text-sm text-indigo-600">{isSelected ? "✓" : "+"}</span>}
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {mode === "group" && (
        <button
          onClick={create}
          disabled={busy || groupName.trim().length < 2 || selected.length === 0}
          className="mt-2 w-full rounded-lg bg-indigo-600 py-1.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
        >
          Crear grupo ({selected.length + 1} integrantes)
        </button>
      )}
    </div>
  );
}
