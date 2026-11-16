"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useTransition } from "react";
import type { Conversation, Message } from "@/types/chat";
import { fetchMessages, markRead, notifyTyping, sendMessage } from "@/lib/client-api";
import { formatTime } from "@/lib/format";
import Avatar, { statusLabel } from "./Avatar";
import { useRealtime } from "./RealtimeProvider";

const PAGE_SIZE = 50;
const TYPING_SEND_EVERY_MS = 3000;
const TYPING_HIDE_AFTER_MS = 6000;

export default function ChatWindow({
  conversation,
  initialMessages,
}: {
  conversation: Conversation;
  initialMessages: Message[];
}) {
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [hasOlder, setHasOlder] = useState(initialMessages.length === PAGE_SIZE);
  const [otherLastReadAt, setOtherLastReadAt] = useState(conversation.otherLastReadAt);
  const [otherTyping, setOtherTyping] = useState(false);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sending, startSending] = useTransition();
  const bottomRef = useRef<HTMLDivElement>(null);
  const lastTypingSent = useRef(0);
  const typingTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const chatId = conversation.id;

  // Al abrir el chat se marca como leído (el otro usuario verá "Visto")
  useEffect(() => {
    markRead(chatId).catch(() => {});
    return () => clearTimeout(typingTimer.current);
  }, [chatId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length, otherTyping]);

  useRealtime((event) => {
    if (event.data.chatId !== chatId) return;

    if (event.type === "message") {
      const m = event.data;
      setMessages((list) => (list.some((x) => x.id === m.id) ? list : [...list, m]));
      if (!m.isSelf) {
        setOtherTyping(false);
        if (document.visibilityState === "visible") markRead(chatId).catch(() => {});
      }
    } else if (event.type === "read") {
      setOtherLastReadAt(event.data.readAt);
    } else if (event.type === "typing") {
      setOtherTyping(event.data.typing);
      clearTimeout(typingTimer.current);
      if (event.data.typing) {
        typingTimer.current = setTimeout(() => setOtherTyping(false), TYPING_HIDE_AFTER_MS);
      }
    }
  });

  function handleDraft(value: string) {
    setDraft(value);
    const now = Date.now();
    if (value.trim() && now - lastTypingSent.current > TYPING_SEND_EVERY_MS) {
      lastTypingSent.current = now;
      notifyTyping(chatId).catch(() => {});
    }
  }

  function handleSend() {
    const content = draft.trim();
    if (!content || sending) return;
    setError(null);
    startSending(async () => {
      try {
        const message = await sendMessage(chatId, content);
        // El mismo mensaje también llega por el stream: se evita duplicarlo
        setMessages((list) => (list.some((x) => x.id === message.id) ? list : [...list, message]));
        setDraft("");
        lastTypingSent.current = 0;
      } catch (e) {
        setError(e instanceof Error ? e.message : "No se pudo enviar el mensaje");
      }
    });
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

  const lastSelf = [...messages].reverse().find((m) => m.isSelf);
  const lastSelfSeen =
    lastSelf && otherLastReadAt ? new Date(otherLastReadAt).getTime() >= new Date(lastSelf.createdAt).getTime() : false;
  const user = conversation.user;

  return (
    <section className="flex h-full min-h-0 flex-1 flex-col">
      <header className="flex items-center gap-3 border-b border-neutral-200 px-4 py-3 dark:border-neutral-800">
        <Link href="/" className="rounded-lg px-2 py-1 text-sm text-neutral-500 hover:bg-neutral-100 md:hidden dark:hover:bg-neutral-800" aria-label="Volver a la lista">
          ←
        </Link>
        {user && <Avatar user={user} size={40} />}
        <div>
          <h2 className="font-semibold">{user?.name ?? "Usuario"}</h2>
          <p className={`text-xs ${otherTyping ? "text-indigo-600" : "text-neutral-500"}`}>
            {otherTyping ? "escribiendo..." : user ? statusLabel(user.status) : ""}
          </p>
        </div>
      </header>

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
          <div key={m.id} className={`flex ${m.isSelf ? "justify-end" : "justify-start"}`}>
            <div
              className={`max-w-[75%] rounded-2xl px-4 py-2 shadow-sm ${
                m.isSelf
                  ? "rounded-br-sm bg-indigo-600 text-white"
                  : "rounded-bl-sm bg-white text-neutral-900 dark:bg-neutral-800 dark:text-neutral-100"
              }`}
            >
              <p className="break-words whitespace-pre-wrap">{m.content}</p>
              <p className={`mt-1 text-right text-[11px] ${m.isSelf ? "text-indigo-200" : "text-neutral-500"}`}>
                {formatTime(m.createdAt)}
                {m.id === lastSelf?.id && <span className="ml-1">· {lastSelfSeen ? "Visto" : "Enviado"}</span>}
              </p>
            </div>
          </div>
        ))}
        {otherTyping && (
          <div className="flex justify-start">
            <div className="rounded-2xl rounded-bl-sm bg-white px-4 py-2 text-sm text-neutral-500 shadow-sm dark:bg-neutral-800">
              escribiendo...
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      <footer className="border-t border-neutral-200 p-3 dark:border-neutral-800">
        {error && (
          <p role="alert" className="mb-2 text-sm text-red-600">
            {error}
          </p>
        )}
        <div className="flex gap-2">
          <textarea
            value={draft}
            onChange={(e) => handleDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            rows={1}
            maxLength={2000}
            placeholder="Escribe un mensaje..."
            aria-label="Mensaje"
            className="max-h-32 flex-1 resize-none rounded-xl border border-neutral-300 bg-white px-4 py-2 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 dark:border-neutral-700 dark:bg-neutral-900"
          />
          <button
            onClick={handleSend}
            disabled={sending || !draft.trim()}
            className="rounded-xl bg-indigo-600 px-5 font-medium text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {sending ? "Enviando..." : "Enviar"}
          </button>
        </div>
      </footer>
    </section>
  );
}
