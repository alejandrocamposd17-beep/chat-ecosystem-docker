import { Suspense } from "react";
import { getConversation, getMessages } from "@/lib/api";
import ChatWindow from "@/components/ChatWindow";
import ApiError from "@/components/ApiError";

async function ChatLoader({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const result = await Promise.all([getConversation(id), getMessages(id)]).then(
    ([conversation, messages]) => ({ ok: true as const, conversation, messages }),
    (error: unknown) => ({ ok: false as const, error }),
  );

  if (!result.ok) return <ApiError error={result.error} />;

  // key: reinicia el estado del cliente al cambiar de conversacion
  return <ChatWindow key={id} conversation={result.conversation} initialMessages={result.messages} />;
}

function ChatSkeleton() {
  return (
    <div className="flex flex-1 items-center justify-center text-sm text-neutral-500" aria-busy="true">
      Cargando conversación...
    </div>
  );
}

export default function ChatPage({ params }: PageProps<"/chat/[id]">) {
  return (
    <Suspense fallback={<ChatSkeleton />}>
      <ChatLoader params={params} />
    </Suspense>
  );
}
