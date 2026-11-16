"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import type { RealtimeEvent } from "@/types/chat";

type Listener = (event: RealtimeEvent) => void;
type Status = "connecting" | "open" | "reconnecting";

const RealtimeContext = createContext<{ subscribe: (fn: Listener) => () => void; status: Status }>({
  subscribe: () => () => {},
  status: "connecting",
});

const EVENT_TYPES = ["message", "message_updated", "typing", "read", "presence", "conversations"] as const;

/**
 * Abre una sola conexión SSE (/api/stream) para toda la app y reparte los eventos
 * a los componentes suscritos (lista de chats y ventana de chat).
 */
export default function RealtimeProvider({ children }: { children: React.ReactNode }) {
  const listeners = useRef(new Set<Listener>());
  const [status, setStatus] = useState<Status>("connecting");

  const subscribe = useCallback((fn: Listener) => {
    listeners.current.add(fn);
    return () => {
      listeners.current.delete(fn);
    };
  }, []);

  useEffect(() => {
    let source: EventSource | null = null;
    let retryTimer: ReturnType<typeof setTimeout> | undefined;
    let closed = false;

    const connect = () => {
      source = new EventSource("/api/stream");
      source.onopen = () => setStatus("open");
      source.onerror = () => {
        setStatus("reconnecting");
        // CLOSED: el servidor respondió con error (no 200); se reintenta manualmente
        if (source?.readyState === EventSource.CLOSED && !closed) {
          retryTimer = setTimeout(async () => {
            const me = await fetch("/api/proxy?path=me", { cache: "no-store" }).catch(() => null);
            if (me?.status === 401) {
              window.location.assign("/api/session/expired");
              return;
            }
            connect();
          }, 3000);
        }
      };
      for (const type of EVENT_TYPES) {
        source.addEventListener(type, (e) => {
          try {
            const data = JSON.parse((e as MessageEvent<string>).data);
            const event = { type, data } as RealtimeEvent;
            listeners.current.forEach((fn) => fn(event));
          } catch {
            // Evento mal formado: se ignora
          }
        });
      }
    };

    connect();
    return () => {
      closed = true;
      clearTimeout(retryTimer);
      source?.close();
    };
  }, []);

  return <RealtimeContext.Provider value={{ subscribe, status }}>{children}</RealtimeContext.Provider>;
}

/** Suscribe un callback a los eventos en tiempo real mientras el componente está montado. */
export function useRealtime(handler: Listener) {
  const { subscribe } = useContext(RealtimeContext);
  const handlerRef = useRef(handler);

  useEffect(() => {
    handlerRef.current = handler;
  });

  useEffect(() => subscribe((event) => handlerRef.current(event)), [subscribe]);
}

export function useRealtimeStatus(): Status {
  return useContext(RealtimeContext).status;
}
