"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { Conversation, Message } from "@/types/chat";
import { getMessages, sendMessage } from "@/lib/api";
import { formatTime } from "@/lib/format";
import Avatar, { statusLabel } from "./Avatar";

const POLL_MS = 4000;

export default function ChatWindow({
  conversation,
  initialMessages,
}: {
  conversation: Conversation;
  initialMessages: Message[];
}) {
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sending, startSending] = useTransition();
  const bottomRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  // Polling: trae mensajes nuevos desde el navegador (NEXT_PUBLIC_API_URL)
  useEffect(() => {
    const id = setInterval(async () => {
      try {
        setMessages(await getMessages(conversation.id));
      } catch {
        // Silencioso: el siguiente ciclo lo intenta de nuevo
      }
    }, POLL_MS);
    return () => clearInterval(id);
  }, [conversation.id]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  function handleSend() {
    const content = draft.trim();
    if (!content || sending) return;
    setError(null);
    startSending(async () => {
      try {
        const message = await sendMessage(conversation.id, content);
        setMessages((prev) => [...prev, message]);
        setDraft("");
        router.refresh(); // actualiza el ultimo mensaje en la barra lateral
      } catch (e) {
        setError(e instanceof Error ? e.message : "No se pudo enviar el mensaje");
      }
    });
  }

  return (
    <section className="flex h-full min-h-0 flex-1 flex-col">
      <header className="flex items-center gap-3 border-b border-neutral-200 px-5 py-3 dark:border-neutral-800">
        <Avatar user={conversation.user} size={40} />
        <div>
          <h2 className="font-semibold">{conversation.user.name}</h2>
          <p className="text-xs text-neutral-500">{statusLabel(conversation.user.status)}</p>
        </div>
      </header>

      <div className="min-h-0 flex-1 space-y-2 overflow-y-auto bg-neutral-50 px-5 py-4 dark:bg-neutral-950">
        {messages.length === 0 && (
          <p className="mt-10 text-center text-sm text-neutral-500">Escribe el primer mensaje.</p>
        )}
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
              </p>
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      <footer className="border-t border-neutral-200 p-3 dark:border-neutral-800">
        {error && <p role="alert" className="mb-2 text-sm text-red-600">{error}</p>}
        <div className="flex gap-2">
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
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
