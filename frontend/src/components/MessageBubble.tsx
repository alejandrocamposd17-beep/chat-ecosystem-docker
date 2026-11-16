"use client";

import { useState } from "react";
import type { Message } from "@/types/chat";
import { REACTIONS } from "@/types/chat";
import { attachmentSrc, formatBytes } from "@/lib/files";
import { formatTime } from "@/lib/format";

type Props = {
  message: Message;
  isGroup: boolean;
  status?: "Visto" | "Enviado" | null;
  highlighted?: boolean;
  onReply: (m: Message) => void;
  onEdit: (m: Message) => void;
  onDelete: (m: Message) => void;
  onReact: (m: Message, emoji: string) => void;
};

export default function MessageBubble({ message: m, isGroup, status, highlighted, onReply, onEdit, onDelete, onReact }: Props) {
  const [showActions, setShowActions] = useState(false);
  const [showPicker, setShowPicker] = useState(false);

  if (m.kind === "system") {
    return (
      <p id={`msg-${m.id}`} className="py-1 text-center text-xs text-neutral-500">
        {m.content}
      </p>
    );
  }

  const canModify = m.isSelf && !m.deleted;

  return (
    <div
      id={`msg-${m.id}`}
      className={`group flex ${m.isSelf ? "justify-end" : "justify-start"}`}
      onMouseLeave={() => {
        setShowActions(false);
        setShowPicker(false);
      }}
    >
      <div className={`relative max-w-[75%] ${m.isSelf ? "items-end" : "items-start"} flex flex-col`}>
        <div
          className={`rounded-2xl px-4 py-2 shadow-sm transition ${highlighted ? "ring-2 ring-amber-400" : ""} ${
            m.isSelf
              ? "rounded-br-sm bg-indigo-600 text-white"
              : "rounded-bl-sm bg-white text-neutral-900 dark:bg-neutral-800 dark:text-neutral-100"
          }`}
        >
          {isGroup && !m.isSelf && <p className="mb-0.5 text-xs font-semibold text-indigo-500">{m.senderName}</p>}

          {m.replyTo && (
            <button
              onClick={() => document.getElementById(`msg-${m.replyTo?.id}`)?.scrollIntoView({ behavior: "smooth", block: "center" })}
              className={`mb-1 block w-full rounded-lg border-l-4 px-2 py-1 text-left text-xs ${
                m.isSelf ? "border-indigo-300 bg-indigo-500/60" : "border-indigo-400 bg-neutral-100 dark:bg-neutral-700"
              }`}
            >
              <span className="font-semibold">{m.replyTo.senderName}</span>
              <span className="block truncate opacity-80">
                {m.replyTo.deleted ? "Mensaje eliminado" : m.replyTo.content || (m.replyTo.hasAttachment ? "📎 Archivo" : "")}
              </span>
            </button>
          )}

          {m.deleted ? (
            <p className="italic opacity-70">🚫 Mensaje eliminado</p>
          ) : (
            <>
              {m.attachment &&
                (m.attachment.isImage ? (
                  <a href={attachmentSrc(m.id)} target="_blank" rel="noopener noreferrer" className="mb-1 block">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={attachmentSrc(m.id)}
                      alt={m.attachment.name}
                      loading="lazy"
                      className="max-h-64 rounded-lg object-contain"
                    />
                  </a>
                ) : (
                  <a
                    href={attachmentSrc(m.id)}
                    download={m.attachment.name}
                    className={`mb-1 flex items-center gap-2 rounded-lg px-3 py-2 text-sm ${
                      m.isSelf ? "bg-indigo-500/60 hover:bg-indigo-500" : "bg-neutral-100 hover:bg-neutral-200 dark:bg-neutral-700"
                    }`}
                  >
                    <span aria-hidden>📎</span>
                    <span className="min-w-0 flex-1 truncate">{m.attachment.name}</span>
                    <span className="shrink-0 text-xs opacity-70">{formatBytes(m.attachment.size)}</span>
                  </a>
                ))}
              {m.content && <p className="break-words whitespace-pre-wrap">{m.content}</p>}
            </>
          )}

          <p className={`mt-1 text-right text-[11px] ${m.isSelf ? "text-indigo-200" : "text-neutral-500"}`}>
            {m.editedAt && !m.deleted && <span className="mr-1">editado ·</span>}
            {formatTime(m.createdAt)}
            {status && <span className="ml-1">· {status}</span>}
          </p>
        </div>

        {m.reactions.length > 0 && !m.deleted && (
          <div className="-mt-1 flex flex-wrap gap-1">
            {m.reactions.map((r) => (
              <button
                key={r.emoji}
                onClick={() => onReact(m, r.emoji)}
                className={`rounded-full border px-1.5 text-xs ${
                  r.mine
                    ? "border-indigo-400 bg-indigo-50 dark:bg-indigo-950"
                    : "border-neutral-200 bg-white dark:border-neutral-700 dark:bg-neutral-800"
                }`}
                aria-label={`${r.emoji} ${r.count}${r.mine ? ", tu reacción" : ""}`}
              >
                {r.emoji} {r.count}
              </button>
            ))}
          </div>
        )}

        {!m.deleted && (
          <div
            className={`absolute top-0 z-10 ${m.isSelf ? "right-full mr-1" : "left-full ml-1"} ${
              showActions || showPicker ? "flex" : "hidden group-hover:flex"
            } items-center gap-0.5 rounded-full border border-neutral-200 bg-white px-1 py-0.5 text-sm shadow-sm dark:border-neutral-700 dark:bg-neutral-800`}
          >
            {showPicker ? (
              REACTIONS.map((emoji) => (
                <button
                  key={emoji}
                  onClick={() => {
                    onReact(m, emoji);
                    setShowPicker(false);
                  }}
                  className="rounded-full px-1 hover:bg-neutral-100 dark:hover:bg-neutral-700"
                  aria-label={`Reaccionar con ${emoji}`}
                >
                  {emoji}
                </button>
              ))
            ) : (
              <>
                <ActionButton label="Reaccionar" onClick={() => setShowPicker(true)}>
                  🙂
                </ActionButton>
                <ActionButton label="Responder" onClick={() => onReply(m)}>
                  ↩
                </ActionButton>
                {canModify && (
                  <>
                    {m.content !== null && (
                      <ActionButton label="Editar" onClick={() => onEdit(m)}>
                        ✏️
                      </ActionButton>
                    )}
                    <ActionButton label="Eliminar" onClick={() => onDelete(m)}>
                      🗑
                    </ActionButton>
                  </>
                )}
              </>
            )}
          </div>
        )}

        {/* En pantallas táctiles no hay "hover": este botón muestra las acciones */}
        {!m.deleted && (
          <button
            onClick={() => setShowActions((v) => !v)}
            className="mt-0.5 text-xs text-neutral-400 md:hidden"
            aria-label="Acciones del mensaje"
          >
            ⋯
          </button>
        )}
      </div>
    </div>
  );
}

function ActionButton({ label, onClick, children }: { label: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick} title={label} aria-label={label} className="rounded-full px-1.5 hover:bg-neutral-100 dark:hover:bg-neutral-700">
      {children}
    </button>
  );
}
