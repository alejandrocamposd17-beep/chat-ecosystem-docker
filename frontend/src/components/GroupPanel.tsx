"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { Conversation, User } from "@/types/chat";
import { addMember, removeMember, renameGroup, searchUsers } from "@/lib/client-api";
import Avatar, { statusLabel } from "./Avatar";

/** Panel de un grupo: integrantes, cambiar nombre, agregar, quitar y salir. */
export default function GroupPanel({
  conversation,
  meId,
  onChange,
  onClose,
}: {
  conversation: Conversation;
  meId: string;
  onChange: (c: Conversation) => void;
  onClose: () => void;
}) {
  const router = useRouter();
  const isAdmin = conversation.myRole === "admin";
  const [name, setName] = useState(conversation.name);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<User[]>([]);
  const [error, setError] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  async function run(action: () => Promise<void>) {
    setError(null);
    try {
      await action();
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo completar la acción");
    }
  }

  function search(value: string) {
    setQuery(value);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      searchUsers(value)
        .then((users) => setResults(users.filter((u) => !conversation.participants.some((p) => p.id === u.id))))
        .catch(() => {});
    }, 300);
  }

  return (
    <aside className="flex w-full shrink-0 flex-col border-l border-neutral-200 bg-white md:w-72 dark:border-neutral-800 dark:bg-neutral-900">
      <header className="flex items-center justify-between border-b border-neutral-200 px-4 py-3 dark:border-neutral-800">
        <h3 className="font-semibold">Información del grupo</h3>
        <button onClick={onClose} className="text-neutral-500 hover:text-neutral-800" aria-label="Cerrar">
          ✕
        </button>
      </header>

      <div className="min-h-0 flex-1 space-y-5 overflow-y-auto p-4 text-sm">
        {isAdmin ? (
          <form
            className="flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              run(async () => onChange(await renameGroup(conversation.id, name.trim())));
            }}
          >
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={80}
              aria-label="Nombre del grupo"
              className="min-w-0 flex-1 rounded-lg border border-neutral-300 px-2 py-1 dark:border-neutral-700 dark:bg-neutral-900"
            />
            <button disabled={name.trim().length < 2 || name.trim() === conversation.name} className="rounded-lg bg-indigo-600 px-3 text-white disabled:opacity-50">
              Guardar
            </button>
          </form>
        ) : (
          <p className="text-lg font-semibold">{conversation.name}</p>
        )}

        <section>
          <h4 className="mb-2 text-xs font-semibold text-neutral-500 uppercase">{conversation.participants.length} integrantes</h4>
          <ul className="space-y-2">
            {conversation.participants.map((p) => (
              <li key={p.id} className="flex items-center gap-2">
                <Avatar user={p} size={32} />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{p.id === meId ? "Tú" : p.name}</p>
                  <p className="truncate text-xs text-neutral-500">{statusLabel(p.status, p.lastSeenAt)}</p>
                </div>
                {isAdmin && p.id !== meId && (
                  <button
                    onClick={() => run(async () => {
                      await removeMember(conversation.id, p.id);
                      onChange({ ...conversation, participants: conversation.participants.filter((x) => x.id !== p.id) });
                    })}
                    className="text-xs text-red-600 hover:underline"
                  >
                    Quitar
                  </button>
                )}
              </li>
            ))}
          </ul>
        </section>

        {isAdmin && (
          <section>
            <h4 className="mb-2 text-xs font-semibold text-neutral-500 uppercase">Agregar integrantes</h4>
            <input
              value={query}
              onChange={(e) => search(e.target.value)}
              onFocus={() => results.length === 0 && search("")}
              placeholder="Buscar personas..."
              aria-label="Buscar personas para agregar"
              className="w-full rounded-lg border border-neutral-300 px-2 py-1 dark:border-neutral-700 dark:bg-neutral-900"
            />
            <ul className="mt-2 space-y-1">
              {results.map((u) => (
                <li key={u.id}>
                  <button
                    onClick={() => run(async () => {
                      onChange(await addMember(conversation.id, u.id));
                      setResults((list) => list.filter((x) => x.id !== u.id));
                    })}
                    className="flex w-full items-center gap-2 rounded-lg p-1 text-left hover:bg-neutral-100 dark:hover:bg-neutral-800"
                  >
                    <Avatar user={u} size={28} showStatus={false} />
                    <span className="flex-1">{u.name}</span>
                    <span className="text-indigo-600">+</span>
                  </button>
                </li>
              ))}
            </ul>
          </section>
        )}

        {error && <p className="text-xs text-red-600">{error}</p>}

        <button
          onClick={() => run(async () => {
            await removeMember(conversation.id, meId);
            router.replace("/");
            router.refresh();
          })}
          className="w-full rounded-lg border border-red-300 py-1.5 text-red-600 hover:bg-red-50 dark:border-red-900 dark:hover:bg-red-950/40"
        >
          Salir del grupo
        </button>
      </div>
    </aside>
  );
}
