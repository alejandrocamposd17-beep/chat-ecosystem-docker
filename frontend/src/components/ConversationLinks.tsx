"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { Conversation } from "@/types/chat";
import Avatar from "./Avatar";
import { formatTime } from "@/lib/format";

export default function ConversationLinks({ conversations }: { conversations: Conversation[] }) {
  const pathname = usePathname();

  if (conversations.length === 0) {
    return <p className="p-6 text-sm text-neutral-500">No hay conversaciones todavia.</p>;
  }

  return (
    <ul>
      {conversations.map((c) => {
        const active = pathname === `/chat/${c.id}`;
        return (
          <li key={c.id}>
            <Link
              href={`/chat/${c.id}`}
              className={`flex items-center gap-3 px-4 py-3 transition-colors ${
                active
                  ? "bg-indigo-50 dark:bg-indigo-950/40"
                  : "hover:bg-neutral-100 dark:hover:bg-neutral-800/60"
              }`}
            >
              <Avatar user={c.user} />
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="truncate font-medium">{c.user.name}</span>
                  {c.updatedAt && (
                    <span className="shrink-0 text-xs text-neutral-500">{formatTime(c.updatedAt)}</span>
                  )}
                </div>
                <p className="truncate text-sm text-neutral-500">{c.lastMessage || "Sin mensajes"}</p>
              </div>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
