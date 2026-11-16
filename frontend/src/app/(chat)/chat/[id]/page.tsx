import { Suspense } from "react";
import { unstable_rethrow } from "next/navigation";
import { getConversation, getMessages } from "@/lib/server-api";
import ChatWindow from "@/components/ChatWindow";
import ApiError from "@/components/ApiError";

async function ChatLoader({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const result = await Promise.all([getConversation(id), getMessages(id)]).then(
    ([conversation, messages]) => ({ ok: true as const, conversation, messages }),
    (error: unknown) => {
      // Las redirecciones (sesión vencida) no son errores: se dejan pasar
      unstable_rethrow(error);
      return { ok: false as const, error };
    },
  );

  if (!result.ok) return <ApiError error={result.error} />;

  // key: reinicia el estado del cliente al cambiar de conversación
  return <ChatWindow key={id} conversation={result.conversation} initialMessages={result.messages} />;
}

function ChatSkeleton() {
  return (
    <div className="flex flex-1 items-center justify-center text-sm text-neutral-500" aria-busy="true">
      Cargando conversación...
    </div>
  );
}

export default function ChatPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense fallback={<ChatSkeleton />}>
      <ChatLoader params={params} />
    </Suspense>
  );
}
