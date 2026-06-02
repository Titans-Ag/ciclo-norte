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
  ArrowDownAZ,
  ArrowUpDown,
  Clock,
  AlertCircle,
  CheckCircle2,
} from 'lucide-react';

const ALL_STATUSES: ConversationStatus[] = ['ia_ativa', 'humano', 'transferida', 'resolvida'];

const STATUS_LABELS: Record<ConversationStatus | 'todos', string> = {
  todos: 'Todos',
  ia_ativa: 'IA Ativa',
  humano: 'Humano',
  transferida: 'Transferida',
  resolvida: 'Resolvida',
};

type SortField = 'updated' | 'name' | 'unread';
type SortDir = 'asc' | 'desc';

export default function ConversationsPage() {
  const { token, user } = useAuth();
  const {
    conversations,
    loading,
    error,
    fetchConversations,
    updateConversation,
    addConversation,
    removeConversation,
  } = useConversations(token);
  const { connected, fallbackActive, lastEvent } = useSSE(token);

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<ConversationStatus | 'todos'>('todos');
  const [lojaFilter, setLojaFilter] = useState<string>('todas');
  const [showFilters, setShowFilters] = useState(false);
  const [sortField, setSortField] = useState<SortField>('updated');
  const [sortDir, setSortDir] = useState<SortDir>('desc');

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
      fetchConversations();
    }
    if (ev.type === 'transfer' && ev.payload) {
      fetchConversations();
    }
    if (ev.type === 'status_change' && ev.payload) {
      fetchConversations();
    }
  };

  const handleCardAction = async (action: string, conv: Conversation) => {
    if (!token) return;
    const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };

    if (action === 'delete') {
      if (!confirm('Excluir esta conversa permanentemente?')) return;
      try {
        const res = await fetch(`${process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:8085'}/api/conversations/${conv.id}`, { method: 'DELETE', headers });
        if (res.ok) removeConversation(conv.id);
      } catch { /* ignore */ }
      return;
    }

    if (action === 'archive') {
      try {
        const res = await fetch(`${process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:8085'}/api/conversations/${conv.id}/resolve`, { method: 'POST', headers });
        if (res.ok) fetchConversations();
      } catch { /* ignore */ }
      return;
    }

    if (action === 'reopen') {
      try {
        const res = await fetch(`${process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:8085'}/api/conversations/${conv.id}/devolver`, { method: 'POST', headers });
        if (res.ok) fetchConversations();
      } catch { /* ignore */ }
      return;
    }

    if (action === 'take') {
      try {
        const res = await fetch(`${process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:8085'}/api/conversations/${conv.id}/assumir`, { method: 'POST', headers });
        if (res.ok) fetchConversations();
      } catch { /* ignore */ }
      return;
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
    let list = conversations.filter((c) => {
      const matchesSearch =
        search.trim().length === 0 ||
        (c.cliente_nome?.toLowerCase().includes(search.toLowerCase()) ?? false) ||
        c.cliente_telefone.includes(search) ||
        (c.ultima_mensagem?.toLowerCase().includes(search.toLowerCase()) ?? false);
      const matchesStatus = statusFilter === 'todos' || c.status === statusFilter;
      const matchesLoja = lojaFilter === 'todas' || c.loja_responsavel_id === lojaFilter;
      return matchesSearch && matchesStatus && matchesLoja;
    });

    // Sort
    list.sort((a, b) => {
      let cmp = 0;
      if (sortField === 'updated') {
        const aDate = a.ultima_msg_em || a.updated_at;
        const bDate = b.ultima_msg_em || b.updated_at;
        cmp = new Date(bDate).getTime() - new Date(aDate).getTime();
      } else if (sortField === 'name') {
        cmp = (a.cliente_nome || a.cliente_telefone).localeCompare(b.cliente_nome || b.cliente_telefone);
      } else if (sortField === 'unread') {
        cmp = (b.unread_count || 0) - (a.unread_count || 0);
      }
      return sortDir === 'asc' ? -cmp : cmp;
    });

    return list;
  }, [conversations, search, statusFilter, lojaFilter, sortField, sortDir]);

  const totalUnread = useMemo(
    () => conversations.reduce((sum, c) => sum + (c.unread_count || 0), 0),
    [conversations]
  );

  const stats = useMemo(() => {
    return {
      ia: conversations.filter((c) => c.status === 'ia_ativa').length,
      humano: conversations.filter((c) => c.status === 'humano').length,
      resolvida: conversations.filter((c) => c.status === 'resolvida').length,
      transferida: conversations.filter((c) => c.status === 'transferida').length,
    };
  }, [conversations]);

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir((d) => (d === 'desc' ? 'asc' : 'desc'));
    } else {
      setSortField(field);
      setSortDir('desc');
    }
  };

  return (
    <div className="flex h-[calc(100dvh-56px)] flex-col">
      {/* Header */}
      <div className="border-b border-industrial-pale/60 bg-white/80 px-4 py-3 backdrop-blur-sm md:px-6 md:py-4">
        {/* Top row: title + stats */}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h1 className="text-lg font-bold text-industrial-black md:text-xl">
              Conversas
            </h1>
            <p className="mt-0.5 text-xs text-industrial-medium">
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

        {/* Stats chips */}
        <div className="mt-3 flex flex-wrap gap-1.5">
          <button
            onClick={() => setStatusFilter('ia_ativa')}
            className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold transition ${
              statusFilter === 'ia_ativa'
                ? 'bg-industrial-yellow text-industrial-black'
                : 'bg-industrial-surface text-industrial-medium border border-industrial-pale'
            }`}
          >
            <AlertCircle className="h-3 w-3" />
            IA Ativa {stats.ia > 0 && <span className="ml-0.5 font-bold">{stats.ia}</span>}
          </button>
          <button
            onClick={() => setStatusFilter('humano')}
            className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold transition ${
              statusFilter === 'humano'
                ? 'bg-industrial-blue text-white'
                : 'bg-industrial-surface text-industrial-medium border border-industrial-pale'
            }`}
          >
            <CheckCircle2 className="h-3 w-3" />
            Humano {stats.humano > 0 && <span className="ml-0.5 font-bold">{stats.humano}</span>}
          </button>
          <button
            onClick={() => setStatusFilter('transferida')}
            className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold transition ${
              statusFilter === 'transferida'
                ? 'bg-industrial-orange text-white'
                : 'bg-industrial-surface text-industrial-medium border border-industrial-pale'
            }`}
          >
            <ArrowDownAZ className="h-3 w-3" />
            Transferida {stats.transferida > 0 && <span className="ml-0.5 font-bold">{stats.transferida}</span>}
          </button>
          <button
            onClick={() => setStatusFilter('resolvida')}
            className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold transition ${
              statusFilter === 'resolvida'
                ? 'bg-industrial-green text-white'
                : 'bg-industrial-surface text-industrial-medium border border-industrial-pale'
            }`}
          >
            <CheckCircle2 className="h-3 w-3" />
            Resolvida {stats.resolvida > 0 && <span className="ml-0.5 font-bold">{stats.resolvida}</span>}
          </button>
          {statusFilter !== 'todos' && (
            <button
              onClick={() => setStatusFilter('todos')}
              className="inline-flex items-center gap-1 rounded-full bg-white px-2.5 py-1 text-[11px] font-semibold text-industrial-medium border border-industrial-pale transition hover:bg-industrial-surface"
            >
              <X className="h-3 w-3" />
              Limpar
            </button>
          )}
        </div>

        {/* Search bar */}
        <div className="mt-3 flex items-center gap-2 rounded-xl border border-industrial-pale bg-industrial-surface/80 px-4 py-2.5 shadow-industrial transition focus-within:border-industrial-yellow focus-within:ring-2 focus-within:ring-industrial-yellow/20">
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

        {/* Filters row + sort */}
        <div className={`mt-3 flex flex-wrap items-center gap-2 ${showFilters ? '' : 'hidden lg:flex'}`}>
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

          <div className="h-5 w-px bg-industrial-pale"></div>

          <span className="text-[11px] font-semibold uppercase tracking-wider text-industrial-light">Ordenar:</span>
          <button
            onClick={() => toggleSort('updated')}
            className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-semibold transition ${
              sortField === 'updated'
                ? 'bg-industrial-black text-white shadow-industrial'
                : 'bg-white text-industrial-medium border border-industrial-pale hover:border-industrial-light'
            }`}
          >
            <Clock className="h-3 w-3" />
            Data {sortField === 'updated' && (sortDir === 'desc' ? '↓' : '↑')}
          </button>
          <button
            onClick={() => toggleSort('name')}
            className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-semibold transition ${
              sortField === 'name'
                ? 'bg-industrial-black text-white shadow-industrial'
                : 'bg-white text-industrial-medium border border-industrial-pale hover:border-industrial-light'
            }`}
          >
            <ArrowDownAZ className="h-3 w-3" />
            Nome {sortField === 'name' && (sortDir === 'desc' ? '↓' : '↑')}
          </button>
          <button
            onClick={() => toggleSort('unread')}
            className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-semibold transition ${
              sortField === 'unread'
                ? 'bg-industrial-black text-white shadow-industrial'
                : 'bg-white text-industrial-medium border border-industrial-pale hover:border-industrial-light'
            }`}
          >
            <ArrowUpDown className="h-3 w-3" />
            Não lidas {sortField === 'unread' && (sortDir === 'desc' ? '↓' : '↑')}
          </button>
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
            <ConversationCard key={c.id} conversation={c} onAction={handleCardAction} />
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
