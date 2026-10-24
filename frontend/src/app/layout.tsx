import type { Metadata } from "next";
import { Suspense } from "react";
import ConversationList, { ConversationListSkeleton } from "@/components/ConversationList";
import "./globals.css";

export const metadata: Metadata = {
  title: "Chat | Ecosistema Docker",
  description: "Frontend Next.js del ecosistema Next.js + Laravel + MySQL",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="es" className="h-full antialiased">
      <body className="h-full">
        <main className="flex h-dvh overflow-hidden">
          <aside className="flex w-80 shrink-0 flex-col border-r border-neutral-200 dark:border-neutral-800">
            <header className="border-b border-neutral-200 px-4 py-4 dark:border-neutral-800">
              <h1 className="text-lg font-semibold">Chats</h1>
            </header>
            <nav className="min-h-0 flex-1 overflow-y-auto" aria-label="Conversaciones">
              {/* Datos sin cache: se transmiten en streaming dentro de Suspense */}
              <Suspense fallback={<ConversationListSkeleton />}>
                <ConversationList />
              </Suspense>
            </nav>
          </aside>
          <div className="flex min-w-0 flex-1">{children}</div>
        </main>
      </body>
    </html>
  );
}
