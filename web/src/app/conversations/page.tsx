'use client';

import { useState, useMemo, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useConversations } from '@/hooks/useConversations';
import { useSSE } from '@/hooks/useSSE';
import { ConversationCard } from '@/components/ConversationCard';
import { IndustrialButton } from '@/components/IndustrialButton';
import { timeAgo } from '@/lib/time';
import { Conversation, ConversationStatus, SSEEvent } from '@/types';
import {
  Search,
  RefreshCw,
  Wifi,
  WifiOff,
  Loader2,
  SlidersHorizontal,
  MessageSquare,
  X,
} from 'lucide-react';

const ALL_STATUSES: ConversationStatus[] = ['ia_ativa', 'humano', 'transferida', 'resolvida'];

const STATUS_LABELS: Record<ConversationStatus | 'todos', string> = {
  todos: 'Todos',
  ia_ativa: 'IA Ativa',
  humano: 'Humano',
  transferida: 'Transferida',
  resolvida: 'Resolvida',
};

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
  const [showFilters, setShowFilters] = useState(false);

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
      // Payload is { conversa_id, message }; refresh list to get updated preview
      fetchConversations();
    }
    if (ev.type === 'transfer' && ev.payload) {
      // Payload is transfer metadata; refresh list
      fetchConversations();
    }
    if (ev.type === 'status_change' && ev.payload) {
      // Payload is status metadata; refresh list
      fetchConversations();
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

  const totalUnread = useMemo(
    () => conversations.reduce((sum, c) => sum + (c.unread_count || 0), 0),
    [conversations]
  );

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="border-b border-industrial-pale bg-white px-4 py-3 md:px-6 md:py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold text-industrial-black md:text-xl">
              Conversas
            </h1>
            <p className="text-xs text-industrial-medium">
              {conversations.length} total{totalUnread > 0 && (
                <span className="ml-1 font-semibold text-industrial-red">
                  • {totalUnread} não lidas
                </span>
              )}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 rounded-lg border border-industrial-pale bg-industrial-surface px-2.5 py-1.5">
              {connected ? (
                <>
                  <Wifi className="h-3.5 w-3.5 text-industrial-green" />
                  <span className="hidden text-[11px] font-semibold text-industrial-green sm:inline">Online</span>
                </>
              ) : fallbackActive ? (
                <>
                  <WifiOff className="h-3.5 w-3.5 text-industrial-orange" />
                  <span className="hidden text-[11px] font-semibold text-industrial-orange sm:inline">Polling</span>
                </>
              ) : (
                <>
                  <WifiOff className="h-3.5 w-3.5 text-industrial-red" />
                  <span className="hidden text-[11px] font-semibold text-industrial-red sm:inline">Offline</span>
                </>
              )}
            </div>

            <IndustrialButton
              variant="ghost"
              size="sm"
              onClick={() => fetchConversations()}
              leftIcon={
                loading ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <RefreshCw className="h-3.5 w-3.5" />
                )
              }
            >
              Atualizar
            </IndustrialButton>

            <IndustrialButton
              variant={showFilters ? 'primary' : 'ghost'}
              size="sm"
              onClick={() => setShowFilters(!showFilters)}
              leftIcon={<SlidersHorizontal className="h-3.5 w-3.5" />}
              className="lg:hidden"
            >
              Filtros
            </IndustrialButton>
          </div>
        </div>

        {/* Search bar */}
        <div className="mt-3 flex items-center gap-2 rounded-xl border border-industrial-pale bg-industrial-surface px-4 py-2.5 shadow-industrial transition focus-within:border-industrial-yellow focus-within:ring-2 focus-within:ring-industrial-yellow/20">
          <Search className="h-4 w-4 shrink-0 text-industrial-light" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar cliente, telefone ou mensagem..."
            className="w-full bg-transparent text-sm font-medium text-industrial-black outline-none placeholder:text-industrial-light"
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="rounded-md p-0.5 text-industrial-light transition hover:bg-industrial-pale hover:text-industrial-dark"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* Filters row - desktop always visible, mobile toggle */}
        <div className={`mt-3 flex flex-wrap items-center gap-2 ${showFilters ? '' : 'hidden lg:flex'}`}>
          <div className="flex flex-wrap gap-1.5">
            {(['todos', ...ALL_STATUSES] as const).map((s) => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-all duration-150 ${
                  statusFilter === s
                    ? 'bg-industrial-dark text-white shadow-industrial'
                    : 'bg-white text-industrial-medium border border-industrial-pale hover:border-industrial-light'
                }`}
              >
                {STATUS_LABELS[s]}
              </button>
            ))}
          </div>

          <div className="h-5 w-px bg-industrial-pale"></div>

          <select
            value={lojaFilter}
            onChange={(e) => setLojaFilter(e.target.value)}
            className="rounded-lg border border-industrial-pale bg-white px-3 py-1.5 text-xs font-semibold text-industrial-dark outline-none transition focus:border-industrial-yellow focus:ring-2 focus:ring-industrial-yellow/20"
          >
            <option value="todas">Todas as lojas</option>
            {lojas.map(([id, nome]) => (
              <option key={id} value={id}>{nome}</option>
            ))}
          </select>
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto p-3 md:p-6">
        {loading && conversations.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16">
            <Loader2 className="h-8 w-8 animate-spin text-industrial-yellow" />
            <p className="mt-3 text-sm font-medium text-industrial-medium">
              Carregando conversas...
            </p>
          </div>
        )}

        {error && conversations.length === 0 && (
          <div className="rounded-xl border border-industrial-red/20 bg-industrial-red-pale p-6 text-center">
            <p className="text-sm font-semibold text-industrial-red">{error}</p>
            <IndustrialButton
              variant="secondary"
              size="sm"
              onClick={() => fetchConversations()}
              className="mt-3"
            >
              Tentar novamente
            </IndustrialButton>
          </div>
        )}

        <div className="space-y-3">
          {filtered.map((c) => (
            <ConversationCard key={c.id} conversation={c} />
          ))}
        </div>

        {filtered.length === 0 && !loading && (
          <div className="flex flex-col items-center justify-center py-16">
            <MessageSquare className="h-12 w-12 text-industrial-pale" />
            <p className="mt-4 text-sm font-semibold text-industrial-medium">
              Nenhuma conversa encontrada.
            </p>
            <p className="mt-1 text-xs text-industrial-light">
              Tente ajustar os filtros ou aguarde novas mensagens.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
