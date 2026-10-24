import { getConversations } from "@/lib/api";
import ConversationLinks from "./ConversationLinks";
import ApiError from "./ApiError";

// Server Component: consulta la API por la red interna de Docker
export default async function ConversationList() {
  const result = await getConversations().then(
    (data) => ({ ok: true as const, data }),
    (error: unknown) => ({ ok: false as const, error }),
  );

  if (!result.ok) return <ApiError error={result.error} />;
  return <ConversationLinks conversations={result.data} />;
}

export function ConversationListSkeleton() {
  return (
    <ul aria-busy="true" aria-label="Cargando conversaciones">
      {Array.from({ length: 5 }).map((_, i) => (
        <li key={i} className="flex animate-pulse items-center gap-3 px-4 py-3">
          <div className="h-11 w-11 rounded-full bg-neutral-200 dark:bg-neutral-800" />
          <div className="flex-1 space-y-2">
            <div className="h-3 w-1/2 rounded bg-neutral-200 dark:bg-neutral-800" />
            <div className="h-3 w-3/4 rounded bg-neutral-200 dark:bg-neutral-800" />
          </div>
        </li>
      ))}
    </ul>
  );
}
