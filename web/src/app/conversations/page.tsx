'use client';

import { useState, useMemo, useEffect } from 'react';
import Link from 'next/link';
import { useAuth } from '@/hooks/useAuth';
import { useConversations } from '@/hooks/useConversations';
import { useSSE } from '@/hooks/useSSE';
import { StatusBadge } from '@/components/StatusBadge';
import { timeAgo } from '@/lib/time';
import { Conversation, ConversationStatus, SSEEvent } from '@/types';
import { Search, RefreshCw, ArrowLeftRight, Wifi, WifiOff, Loader2 } from 'lucide-react';

const ALL_STATUSES: ConversationStatus[] = ['ia_ativa', 'humano', 'transferida', 'resolvida'];

export default function ConversationsPage() {
  const { token, user } = useAuth();
  const {
    conversations,
    loading,
    error,
    fetchConversations,
    updateConversation,
    addConversation,
  } = useConversations(token);
  const { connected, fallbackActive, lastEvent } = useSSE(token);

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<ConversationStatus | 'todos'>('todos');
  const [lojaFilter, setLojaFilter] = useState<string>('todas');

  // apply SSE events
  useEffect(() => {
    if (!lastEvent) return;
    handleSSE(lastEvent);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lastEvent]);

  const handleSSE = (ev: SSEEvent) => {
    if (ev.type === 'conversation_update' && ev.payload) {
      const c = ev.payload as Conversation;
      updateConversation(c);
    }
    if (ev.type === 'new_message' && ev.payload) {
      const c = ev.payload as Conversation;
      updateConversation(c);
    }
    if (ev.type === 'transfer' && ev.payload) {
      const c = ev.payload as Conversation;
      updateConversation(c);
    }
  };

  const lojas = useMemo(() => {
    const map = new Map<string, string>();
    conversations.forEach((c) => {
      if (c.loja_responsavel_id && c.loja_nome) map.set(c.loja_responsavel_id, c.loja_nome);
    });
    return Array.from(map.entries());
  }, [conversations]);

  const filtered = useMemo(() => {
    return conversations.filter((c) => {
      const matchesSearch =
        search.trim().length === 0 ||
        (c.cliente_nome?.toLowerCase().includes(search.toLowerCase()) ?? false) ||
        c.cliente_telefone.includes(search) ||
        (c.ultima_mensagem?.toLowerCase().includes(search.toLowerCase()) ?? false);
      const matchesStatus = statusFilter === 'todos' || c.status === statusFilter;
      const matchesLoja = lojaFilter === 'todas' || c.loja_responsavel_id === lojaFilter;
      return matchesSearch && matchesStatus && matchesLoja;
    });
  }, [conversations, search, statusFilter, lojaFilter]);

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-center gap-3 border-b border-gray-200 bg-white p-3 md:p-4">
        <div className="flex flex-1 items-center gap-2 rounded-lg border border-gray-300 bg-gray-50 px-3 py-2">
          <Search className="h-4 w-4 shrink-0 text-gray-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar cliente ou mensagem..."
            className="w-full bg-transparent text-sm outline-none placeholder:text-gray-400"
          />
        </div>

        <button
          onClick={() => fetchConversations()}
          className="rounded-lg border border-gray-300 p-2 text-gray-600 hover:bg-gray-100"
          title="Atualizar"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
        </button>

        <div className="flex items-center gap-1">
          {connected ? (
            <Wifi className="h-4 w-4 text-green-600" />
          ) : fallbackActive ? (
            <WifiOff className="h-4 w-4 text-yellow-500" />
          ) : (
            <WifiOff className="h-4 w-4 text-red-500" />
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2 border-b border-gray-200 bg-white px-3 py-2 md:px-4">
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as ConversationStatus | 'todos')}
          className="rounded-md border border-gray-300 bg-white px-2 py-1 text-xs outline-none"
        >
          <option value="todos">Todos os status</option>
          {ALL_STATUSES.map((s) => (
            <option key={s} value={s}>
              {s === 'ia_ativa' && 'IA Ativa'}
              {s === 'humano' && 'Humano'}
              {s === 'transferida' && 'Transferida'}
              {s === 'resolvida' && 'Resolvida'}
            </option>
          ))}
        </select>

        <select
          value={lojaFilter}
          onChange={(e) => setLojaFilter(e.target.value)}
          className="rounded-md border border-gray-300 bg-white px-2 py-1 text-xs outline-none"
        >
          <option value="todas">Todas as lojas</option>
          {lojas.map(([id, nome]) => (
            <option key={id} value={id}>{nome}</option>
          ))}
        </select>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto p-2 md:p-4">
        {loading && conversations.length === 0 && (
          <div className="flex items-center justify-center py-10 text-gray-400">
            <Loader2 className="mr-2 h-5 w-5 animate-spin" />
            Carregando...
          </div>
        )}

        {error && conversations.length === 0 && (
          <div className="rounded-lg bg-red-50 p-4 text-sm text-red-700">
            {error}
          </div>
        )}

        <div className="space-y-2">
          {filtered.map((c) => (
            <Link
              key={c.id}
              href={`/conversations/chat?id=${c.id}`}
              className="block rounded-xl border border-gray-200 bg-white p-3 transition hover:border-blue-300 hover:shadow-sm md:p-4"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="truncate text-sm font-semibold text-gray-900">
                      {c.cliente_nome}
                    </span>
                    <span className="text-xs text-gray-400">{c.cliente_telefone}</span>
                  </div>
                  <div className="mt-1 flex items-center gap-2">
                    <StatusBadge status={c.status} />
                    {c.transferida && (
                      <span className="inline-flex items-center gap-0.5 rounded-full bg-orange-50 px-2 py-0.5 text-xs font-medium text-orange-700">
                        <ArrowLeftRight className="h-3 w-3" />
                        Transferida
                      </span>
                    )}
                    <span className="text-xs text-gray-400">{c.loja_nome}</span>
                  </div>
                  {c.ultima_mensagem && (
                    <p className="mt-1 truncate text-xs text-gray-500">
                      {c.ultima_mensagem}
                    </p>
                  )}
                </div>
                <div className="shrink-0 text-right">
                  <span className="block text-xs text-gray-400">{timeAgo(c.updated_at)}</span>
                </div>
              </div>
            </Link>
          ))}
        </div>

        {filtered.length === 0 && !loading && (
          <div className="py-10 text-center text-sm text-gray-400">
            Nenhuma conversa encontrada.
          </div>
        )}
      </div>
    </div>
  );
}
