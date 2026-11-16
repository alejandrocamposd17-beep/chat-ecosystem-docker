"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useRef, useState } from "react";
import type { Conversation, User } from "@/types/chat";
import { fetchConversations, logout, searchUsers, startConversation } from "@/lib/client-api";
import { formatTime } from "@/lib/format";
import Avatar from "./Avatar";
import { useRealtime, useRealtimeStatus } from "./RealtimeProvider";

export default function Sidebar({ me, initialConversations }: { me: User; initialConversations: Conversation[] }) {
  const pathname = usePathname();
  const router = useRouter();
  const status = useRealtimeStatus();
  const [conversations, setConversations] = useState(initialConversations);
  const [typing, setTyping] = useState<Record<string, boolean>>({});
  const [showNew, setShowNew] = useState(false);
  const activeId = pathname.startsWith("/chat/") ? pathname.split("/")[2] : null;

  useRealtime((event) => {
    if (event.type === "message") {
      const m = event.data;
      const known = conversations.some((c) => c.id === m.chatId);
      if (!known) {
        // Alguien inició un chat nuevo conmigo: se recarga la lista
        fetchConversations().then(setConversations).catch(() => {});
        return;
      }
      setConversations((list) => {
        const current = list.find((c) => c.id === m.chatId);
        if (!current) return list;
        const updated: Conversation = {
          ...current,
          lastMessage: m.content,
          lastMessageIsSelf: m.isSelf,
          updatedAt: m.createdAt,
          unreadCount: m.isSelf || m.chatId === activeId ? 0 : current.unreadCount + 1,
        };
        return [updated, ...list.filter((c) => c.id !== m.chatId)];
      });
      setTyping((t) => ({ ...t, [m.chatId]: false }));
    }
    if (event.type === "typing") {
      setTyping((t) => ({ ...t, [event.data.chatId]: event.data.typing }));
    }
  });

  function openChat(id: string) {
    setConversations((list) => list.map((c) => (c.id === id ? { ...c, unreadCount: 0 } : c)));
  }

  async function handleLogout() {
    await logout();
    router.replace("/login");
    router.refresh();
  }

  return (
    <aside
      className={`${activeId ? "hidden md:flex" : "flex"} w-full shrink-0 flex-col border-r border-neutral-200 md:w-80 dark:border-neutral-800`}
    >
      <header className="flex items-center gap-3 border-b border-neutral-200 px-4 py-3 dark:border-neutral-800">
        <Avatar user={{ ...me, status: status === "open" ? "online" : "away" }} size={36} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">{me.name}</p>
          <p className="text-xs text-neutral-500">{status === "open" ? "Conectado en tiempo real" : "Conectando..."}</p>
        </div>
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
              return (
                <li key={c.id}>
                  <Link
                    href={`/chat/${c.id}`}
                    onClick={() => openChat(c.id)}
                    className={`flex items-center gap-3 px-4 py-3 transition-colors ${
                      active ? "bg-indigo-50 dark:bg-indigo-950/40" : "hover:bg-neutral-100 dark:hover:bg-neutral-800/60"
                    }`}
                  >
                    {c.user && <Avatar user={c.user} />}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline justify-between gap-2">
                        <span className={`truncate ${unread ? "font-semibold" : "font-medium"}`}>{c.user?.name ?? "Usuario"}</span>
                        {c.updatedAt && <span className="shrink-0 text-xs text-neutral-500">{formatTime(c.updatedAt)}</span>}
                      </div>
                      <div className="flex items-center gap-2">
                        <p className={`min-w-0 flex-1 truncate text-sm ${typing[c.id] ? "text-indigo-600" : "text-neutral-500"}`}>
                          {typing[c.id]
                            ? "escribiendo..."
                            : c.lastMessage
                              ? `${c.lastMessageIsSelf ? "Tú: " : ""}${c.lastMessage}`
                              : "Sin mensajes"}
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
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<User[] | null>(null);
  const [error, setError] = useState<string | null>(null);
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

  async function start(user: User) {
    try {
      onStarted(await startConversation(user.id));
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo iniciar el chat");
    }
  }

  return (
    <div className="border-b border-neutral-200 p-3 dark:border-neutral-800">
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
      {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
      {results && (
        <ul className="mt-2 max-h-56 overflow-y-auto">
          {results.length === 0 && <li className="p-2 text-sm text-neutral-500">Sin resultados.</li>}
          {results.map((u) => (
            <li key={u.id}>
              <button
                onClick={() => start(u)}
                className="flex w-full items-center gap-3 rounded-lg p-2 text-left hover:bg-neutral-100 dark:hover:bg-neutral-800"
              >
                <Avatar user={u} size={32} />
                <span className="text-sm">{u.name}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
