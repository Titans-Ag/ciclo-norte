import { useState, useEffect, useCallback } from 'react';
import { Conversation, Message } from '@/types';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:8085';

export function useConversations(token: string | null) {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const headers = useCallback(
    () => ({
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    }),
    [token]
  );

  const fetchConversations = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/api/conversations`, { headers: headers() });
      if (!res.ok) throw new Error('Erro ao carregar conversas');
      const data = await res.json();
      setConversations(data.conversations || []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro desconhecido');
    } finally {
      setLoading(false);
    }
  }, [token, headers]);

  useEffect(() => {
    fetchConversations();
  }, [fetchConversations]);

  const fetchMessages = useCallback(
    async (conversaId: string): Promise<Message[]> => {
      if (!token) return [];
      try {
        const res = await fetch(`${API_BASE}/api/conversations/${conversaId}`, {
          headers: headers(),
        });
        if (!res.ok) return [];
        const data = await res.json();
        return data.mensagens || [];
      } catch {
        return [];
      }
    },
    [token, headers]
  );

  const sendMessage = useCallback(
    async (conversaId: string, conteudo: string): Promise<boolean> => {
      if (!token) return false;
      try {
        const res = await fetch(`${API_BASE}/api/conversations/${conversaId}/messages`, {
          method: 'POST',
          headers: headers(),
          body: JSON.stringify({ conteudo, midia_tipo: 'text' }),
        });
        return res.ok;
      } catch {
        return false;
      }
    },
    [token, headers]
  );

  const updateConversation = useCallback((updated: Conversation) => {
    setConversations((prev) =>
      prev.map((c) => (c.id === updated.id ? updated : c))
    );
  }, []);

  const addConversation = useCallback((conversation: Conversation) => {
    setConversations((prev) => {
      if (prev.find((c) => c.id === conversation.id)) return prev;
      return [conversation, ...prev];
    });
  }, []);

  return {
    conversations,
    loading,
    error,
    fetchConversations,
    fetchMessages,
    sendMessage,
    updateConversation,
    addConversation,
  };
}
