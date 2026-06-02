import { useEffect, useRef, useState, useCallback } from 'react';
import { SSEEvent } from '@/types';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:8085';
const RECONNECT_DELAYS = [1000, 2000, 5000, 10000, 15000];

/** Maps backend SSE event names to frontend event types. */
const EVENT_NAME_MAP: Record<string, string> = {
  nova_mensagem: 'new_message',
  conversa_transferida: 'transfer',
  status_mudou: 'status_change',
  atendente_assumiu: 'conversation_update',
};

export function useSSE(token: string | null) {
  const [connected, setConnected] = useState(false);
  const [lastEvent, setLastEvent] = useState<SSEEvent | null>(null);
  const [fallbackActive, setFallbackActive] = useState(false);
  const esRef = useRef<EventSource | null>(null);
  const retryCount = useRef(0);
  const pollInterval = useRef<ReturnType<typeof setInterval> | null>(null);
  const mounted = useRef(true);

  const connect = useCallback(() => {
    if (!token || !mounted.current) return;
    if (esRef.current) {
      esRef.current.close();
    }

    const url = `${API_BASE}/api/events?token=${encodeURIComponent(token)}`;
    const es = new EventSource(url);
    esRef.current = es;

    es.onopen = () => {
      if (!mounted.current) return;
      setConnected(true);
      setFallbackActive(false);
      retryCount.current = 0;
      if (pollInterval.current) {
        clearInterval(pollInterval.current);
        pollInterval.current = null;
      }
    };

    // Named event listeners — backend sends event: nova_mensagem etc.
    const handleNamedEvent = (backendType: string) => (ev: MessageEvent) => {
      if (!mounted.current) return;
      try {
        const payload = JSON.parse(ev.data);
        const frontendType = EVENT_NAME_MAP[backendType] || backendType;

        // Frontend chat/page.tsx expects new_message payload as { conversa_id, message: Message }
        let wrappedPayload: unknown = payload;
        if (frontendType === 'new_message' && payload && payload.conversa_id) {
          wrappedPayload = {
            conversa_id: payload.conversa_id,
            message: payload,
          };
        }

        const sseEvent: SSEEvent = {
          type: frontendType as SSEEvent['type'],
          payload: wrappedPayload,
        };
        setLastEvent(sseEvent);
      } catch {
        // ignore malformed
      }
    };

    es.addEventListener('nova_mensagem', handleNamedEvent('nova_mensagem'));
    es.addEventListener('conversa_transferida', handleNamedEvent('conversa_transferida'));
    es.addEventListener('status_mudou', handleNamedEvent('status_mudou'));
    es.addEventListener('atendente_assumiu', handleNamedEvent('atendente_assumiu'));

    es.onerror = () => {
      if (!mounted.current) return;
      setConnected(false);
      es.close();
      esRef.current = null;

      if (retryCount.current < RECONNECT_DELAYS.length) {
        const delay = RECONNECT_DELAYS[retryCount.current];
        retryCount.current += 1;
        setTimeout(connect, delay);
      } else {
        // fallback to polling
        setFallbackActive(true);
        if (!pollInterval.current) {
          pollInterval.current = setInterval(() => {
            if (!mounted.current) return;
            fetch(`${API_BASE}/api/events/poll?token=${encodeURIComponent(token)}`)
              .then((r) => (r.ok ? r.json() : null))
              .then((data) => {
                if (data && data.events && mounted.current) {
                  // pick the most recent event
                  const ev = data.events[data.events.length - 1];
                  if (ev) {
                    const frontendType = EVENT_NAME_MAP[ev.type] || ev.type || 'conversation_update';
                    let wrappedPayload: unknown = ev.payload || ev;
                    if (frontendType === 'new_message' && wrappedPayload && (wrappedPayload as any).conversa_id) {
                      wrappedPayload = {
                        conversa_id: (wrappedPayload as any).conversa_id,
                        message: wrappedPayload,
                      };
                    }
                    setLastEvent({ type: frontendType as SSEEvent['type'], payload: wrappedPayload });
                  }
                }
              })
              .catch(() => {});
          }, 5000);
        }
      }
    };
  }, [token]);

  useEffect(() => {
    mounted.current = true;
    connect();
    return () => {
      mounted.current = false;
      if (esRef.current) {
        esRef.current.close();
        esRef.current = null;
      }
      if (pollInterval.current) {
        clearInterval(pollInterval.current);
        pollInterval.current = null;
      }
    };
  }, [connect]);

  return { connected, fallbackActive, lastEvent };
}
