import { useEffect, useRef, useState, useCallback } from 'react';
import { SSEEvent } from '@/types';

const API_BASE = 'http://localhost:8085';
const RECONNECT_DELAYS = [1000, 2000, 5000, 10000, 15000];

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

    es.onmessage = (ev) => {
      if (!mounted.current) return;
      try {
        const parsed: SSEEvent = JSON.parse(ev.data);
        setLastEvent(parsed);
      } catch {
        // ignore malformed
      }
    };

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
            fetch(`${API_BASE}/api/conversations/poll`, {
              headers: token ? { Authorization: `Bearer ${token}` } : {},
            })
              .then((r) => (r.ok ? r.json() : null))
              .then((data) => {
                if (data && mounted.current) {
                  setLastEvent({ type: 'conversation_update', payload: data });
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
