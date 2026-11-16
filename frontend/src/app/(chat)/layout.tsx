import { Suspense } from "react";
import { unstable_rethrow } from "next/navigation";
import RealtimeProvider from "@/components/RealtimeProvider";
import Sidebar from "@/components/Sidebar";
import ApiError from "@/components/ApiError";
import { getConversations, getMe } from "@/lib/server-api";

// Server Component: trae el usuario y sus chats con el token de la cookie (en streaming dentro de Suspense)
async function SidebarLoader() {
  const result = await Promise.all([getMe(), getConversations()]).then(
    ([me, conversations]) => ({ ok: true as const, me, conversations }),
    (error: unknown) => {
      // Las redirecciones (sesión vencida) no son errores: se dejan pasar
      unstable_rethrow(error);
      return { ok: false as const, error };
    },
  );

  if (!result.ok) {
    return (
      <aside className="w-full shrink-0 border-r border-neutral-200 md:w-80 dark:border-neutral-800">
        <ApiError error={result.error} />
      </aside>
    );
  }
  return <Sidebar me={result.me} initialConversations={result.conversations} />;
}

function SidebarSkeleton() {
  return (
    <aside className="hidden w-80 shrink-0 border-r border-neutral-200 md:block dark:border-neutral-800" aria-busy="true">
      <ul aria-label="Cargando conversaciones">
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
    </aside>
  );
}

export default function ChatLayout({ children }: { children: React.ReactNode }) {
  return (
    <RealtimeProvider>
      <main className="flex h-dvh overflow-hidden">
        <Suspense fallback={<SidebarSkeleton />}>
          <SidebarLoader />
        </Suspense>
        <div className="flex min-w-0 flex-1">{children}</div>
      </main>
    </RealtimeProvider>
  );
}
