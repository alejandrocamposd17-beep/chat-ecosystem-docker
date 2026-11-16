"use client";

import { useRef, useState, useTransition } from "react";
import type { Message } from "@/types/chat";
import { editMessage, notifyTyping, sendMessage } from "@/lib/client-api";
import { ATTACHMENT_ACCEPT, MAX_ATTACHMENT_BYTES, formatBytes } from "@/lib/files";

const TYPING_SEND_EVERY_MS = 3000;

type Props = {
  chatId: string;
  replyTo: Message | null;
  editing: Message | null;
  onCancel: () => void;
  onSent: (m: Message) => void;
  onEdited: (m: Message) => void;
};

/** Caja de texto: enviar, adjuntar archivo, responder y editar. */
export default function Composer({ chatId, replyTo, editing, onCancel, onSent, onEdited }: Props) {
  const [draft, setDraft] = useState(editing?.content ?? "");
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sending, startSending] = useTransition();
  const lastTypingSent = useRef(0);
  const fileInput = useRef<HTMLInputElement>(null);

  function handleDraft(value: string) {
    setDraft(value);
    const now = Date.now();
    if (!editing && value.trim() && now - lastTypingSent.current > TYPING_SEND_EVERY_MS) {
      lastTypingSent.current = now;
      notifyTyping(chatId).catch(() => {});
    }
  }

  function pickFile(selected: File | undefined) {
    setError(null);
    if (!selected) return;
    if (selected.size > MAX_ATTACHMENT_BYTES) {
      setError(`El archivo pesa ${formatBytes(selected.size)}; el máximo es 5 MB.`);
      return;
    }
    setFile(selected);
  }

  function submit() {
    const content = draft.trim();
    if (sending || (!content && !file && !editing)) return;
    setError(null);

    startSending(async () => {
      try {
        if (editing) {
          onEdited(await editMessage(chatId, editing.id, content));
        } else {
          onSent(await sendMessage(chatId, content, { file, replyToId: replyTo?.id ?? null }));
          setFile(null);
          if (fileInput.current) fileInput.current.value = "";
        }
        setDraft("");
        lastTypingSent.current = 0;
      } catch (e) {
        setError(e instanceof Error ? e.message : "No se pudo enviar el mensaje");
      }
    });
  }

  const banner = editing
    ? { title: "Editando mensaje", text: editing.content ?? "" }
    : replyTo
      ? { title: `Respondiendo a ${replyTo.isSelf ? "ti" : replyTo.senderName}`, text: replyTo.content ?? (replyTo.attachment ? `📎 ${replyTo.attachment.name}` : "") }
      : null;

  return (
    <footer className="border-t border-neutral-200 p-3 dark:border-neutral-800">
      {banner && (
        <div className="mb-2 flex items-center gap-2 rounded-lg border-l-4 border-indigo-500 bg-neutral-100 px-3 py-1.5 text-sm dark:bg-neutral-800">
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold text-indigo-600">{banner.title}</p>
            <p className="truncate text-neutral-600 dark:text-neutral-300">{banner.text}</p>
          </div>
          <button onClick={onCancel} className="text-neutral-500 hover:text-neutral-800" aria-label="Cancelar">
            ✕
          </button>
        </div>
      )}

      {file && (
        <div className="mb-2 flex items-center gap-2 rounded-lg bg-neutral-100 px-3 py-1.5 text-sm dark:bg-neutral-800">
          <span aria-hidden>📎</span>
          <span className="min-w-0 flex-1 truncate">{file.name}</span>
          <span className="text-xs text-neutral-500">{formatBytes(file.size)}</span>
          <button
            onClick={() => {
              setFile(null);
              if (fileInput.current) fileInput.current.value = "";
            }}
            className="text-neutral-500 hover:text-neutral-800"
            aria-label="Quitar archivo"
          >
            ✕
          </button>
        </div>
      )}

      {error && (
        <p role="alert" className="mb-2 text-sm text-red-600">
          {error}
        </p>
      )}

      <div className="flex gap-2">
        {!editing && (
          <>
            <input
              ref={fileInput}
              type="file"
              accept={ATTACHMENT_ACCEPT}
              className="hidden"
              onChange={(e) => pickFile(e.target.files?.[0])}
              aria-label="Adjuntar archivo"
            />
            <button
              onClick={() => fileInput.current?.click()}
              className="rounded-xl px-3 text-lg text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-800"
              title="Adjuntar imagen o archivo (máx. 5 MB)"
              aria-label="Adjuntar imagen o archivo"
            >
              📎
            </button>
          </>
        )}
        <textarea
          value={draft}
          onChange={(e) => handleDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              submit();
            }
            if (e.key === "Escape" && (editing || replyTo)) onCancel();
          }}
          rows={1}
          maxLength={2000}
          placeholder={editing ? "Edita tu mensaje..." : "Escribe un mensaje..."}
          aria-label="Mensaje"
          className="max-h-32 flex-1 resize-none rounded-xl border border-neutral-300 bg-white px-4 py-2 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 dark:border-neutral-700 dark:bg-neutral-900"
        />
        <button
          onClick={submit}
          disabled={sending || (!draft.trim() && !file && !editing)}
          className="rounded-xl bg-indigo-600 px-5 font-medium text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {sending ? "Enviando..." : editing ? "Guardar" : "Enviar"}
        </button>
      </div>
    </footer>
  );
}
