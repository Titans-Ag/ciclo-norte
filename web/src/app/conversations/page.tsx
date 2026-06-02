'use client';

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { useConversations } from '@/hooks/useConversations';
import { useSSE } from '@/hooks/useSSE';
import { Conversation, Message, SSEEvent } from '@/types';
import { AudioPlayer } from '@/components/AudioPlayer';
import { ImageLightbox } from '@/components/ImageLightbox';
import { timeAgo } from '@/lib/time';
import { RefreshCw, Loader2, FileText } from 'lucide-react';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:8085';

/* ═══════════════════════════════════════════════════════════════════
   JSX LITERAL 1:1 — traduzido mecanicamente do arquivo
   web/ciclo-norte-app-refactored.html
   Cada tag, classe, atributo e SVG copiados literalmente.
   Somente convertido: class→className, onclick→onClick,
   stroke-width→strokeWidth, etc.
   ═══════════════════════════════════════════════════════════════════ */

export default function Page() {
  const router = useRouter();
  const { token, user, logout, isAdmin } = useAuth();
  const { conversations: convList, loading, error, fetchConversations, fetchMessages, sendMessage: apiSendMessage, updateConversation } = useConversations(token);
  const { connected, lastEvent } = useSSE(token);

  /* ── State (equivale às vars do <script> do HTML) ── */
  const [currentView, setCurrentView] = useState<'conversations' | 'admin'>('conversations');
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [mobileShowChat, setMobileShowChat] = useState(false);
  const [activeAdminTab, setActiveAdminTab] = useState('lojas');
  const [activeFilter, setActiveFilter] = useState<string>('todos');
  const [search, setSearch] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [actionsOpen, setActionsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [msgLoading, setMsgLoading] = useState(false);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [typing, setTyping] = useState(false);
  const [transferModal, setTransferModal] = useState(false);
  const [transferLoja, setTransferLoja] = useState('');

  const actionsRef = useRef<HTMLDivElement | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);

  const activeConversation = convList.find((c) => c.id === activeConversationId) || null;

  /* ── Effects ── */
  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (actionsRef.current && !actionsRef.current.contains(e.target as Node)) {
        setActionsOpen(false);
      }
    }
    document.addEventListener('click', onDocClick);
    return () => document.removeEventListener('click', onDocClick);
  }, []);

  useEffect(() => {
    if (!lastEvent) return;
    if (lastEvent.type === 'new_message' && lastEvent.payload) {
      const p = lastEvent.payload as { conversa_id: string; message: Message };
      if (p.conversa_id === activeConversationId) {
        setMessages((prev) => [...prev, p.message]);
      }
    }
    if (lastEvent.type === 'typing' && lastEvent.payload) {
      const p = lastEvent.payload as { conversa_id: string; active: boolean };
      if (p.conversa_id === activeConversationId) setTyping(p.active);
    }
    if (lastEvent.type === 'conversation_update' && lastEvent.payload) {
      const c = lastEvent.payload as Conversation;
      if (c.id === activeConversationId) updateConversation(c);
    }
  }, [lastEvent, activeConversationId, updateConversation]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, typing]);

  useEffect(() => {
    if (!activeConversationId || !token) { setMessages([]); return; }
    setMsgLoading(true);
    fetchMessages(activeConversationId).then((msgs) => setMessages(msgs)).finally(() => setMsgLoading(false));
  }, [activeConversationId, token, fetchMessages]);

  /* ── Handlers ── */
  const selectConversation = (id: string) => {
    setActiveConversationId(id);
    if (typeof window !== 'undefined' && window.innerWidth < 768) setMobileShowChat(true);
  };
  const showConversationList = () => setMobileShowChat(false);
  const switchView = (view: 'conversations' | 'admin') => {
    setCurrentView(view);
    if (view === 'conversations') setMobileShowChat(false);
  };
  const refresh = () => {
    setRefreshing(true);
    fetchConversations().finally(() => setTimeout(() => setRefreshing(false), 800));
  };
  const handleSend = async () => {
    if (!input.trim() || sending || !activeConversationId) return;
    setSending(true);
    const ok = await apiSendMessage(activeConversationId, input.trim());
    if (ok) { setInput(''); const msgs = await fetchMessages(activeConversationId); setMessages(msgs); }
    setSending(false);
  };
  const handleAction = async (action: string, body?: unknown) => {
    if (!activeConversationId) return;
    try {
      const res = await fetch(`${API_BASE}/api/conversations/${activeConversationId}/${action}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: body ? JSON.stringify(body) : undefined,
      });
      if (res.ok) await fetchConversations();
    } catch { /* ignore */ }
  };
  const handleTransfer = async () => {
    if (!transferLoja || !activeConversationId) return;
    await handleAction('transferir', { loja_id: transferLoja });
    setTransferModal(false); setTransferLoja('');
  };

  /* ── Data transformations (same logic as HTML's renderConversationList) ── */
  const filteredConversations = useMemo(() => {
    let list = [...convList];
    if (activeFilter !== 'todos') list = list.filter((c) => c.status === activeFilter);
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter((c) => (c.cliente_nome?.toLowerCase() || '').includes(q) || c.cliente_telefone.toLowerCase().includes(q) || (c.ultima_mensagem?.toLowerCase() || '').includes(q));
    }
    list.sort((a, b) => new Date(b.ultima_msg_em).getTime() - new Date(a.ultima_msg_em).getTime());
    return list;
  }, [convList, activeFilter, search]);

  /* ── Status / avatar helpers ── */
  const statusConfig: Record<string, { label: string; bg: string; text: string; border: string }> = {
    ia_ativa:    { label: 'IA Ativa',     bg: 'bg-industrial-yellow-pale',   text: 'text-industrial-yellow-dark', border: 'border-industrial-yellow/20' },
    humano:     { label: 'Humano',      bg: 'bg-industrial-blue-pale',     text: 'text-industrial-blue',       border: 'border-industrial-blue/20' },
    transferida:{ label: 'Transferida', bg: 'bg-industrial-orange-pale',  text: 'text-industrial-orange',     border: 'border-industrial-orange/20' },
    resolvida:  { label: 'Resolvida',   bg: 'bg-industrial-green-pale',    text: 'text-industrial-green',      border: 'border-industrial-green/20' },
  };
  const avatarColors: Record<string, string> = { ia_ativa: 'bg-industrial-yellow', humano: 'bg-industrial-blue', transferida: 'bg-industrial-orange', resolvida: 'bg-industrial-gray' };
  const getInitials = (name?: string) => {
    if (!name) return '??';
    const p = name.split(' ').filter(Boolean);
    if (p.length === 1) return p[0].slice(0, 2).toUpperCase();
    return (p[0][0] + p[p.length - 1][0]).toUpperCase();
  };
  const timeShort = (d: string) => {
    const date = new Date(d);
    const now = new Date();
    const mins = Math.floor((now.getTime() - date.getTime()) / 60000);
    const hrs = Math.floor((now.getTime() - date.getTime()) / 3600000);
    const days = Math.floor((now.getTime() - date.getTime()) / 86400000);
    if (mins < 1) return 'agora';
    if (mins < 60) return `${mins} min`;
    if (hrs < 24) return `${hrs}h`;
    if (days < 7) return `${days} dias`;
    return date.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
  };

  /* ═══════════════════════════════════════════════════════════════════
     JSX — cópia literal do HTML
     ═══════════════════════════════════════════════════════════════════ */
  return (
    <div id="app" className="h-screen flex flex-col overflow-hidden bg-industrial-surface" data-mobile-view={mobileShowChat ? 'chat' : 'list'} data-view={currentView}>

      {/* ── Desktop Navbar (flex-none, hidden on mobile) ── */}
      <nav className="hidden md:flex flex-none items-center justify-between h-14 px-6 bg-industrial-dark text-white shadow-industrial-md z-30">
        {/* Brand */}
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-industrial-yellow flex items-center justify-center">
            <svg className="w-5 h-5 text-industrial-dark" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </div>
          <span className="text-lg font-bold tracking-tight">Ciclo Norte</span>
        </div>

        {/* Nav Items */}
        <div className="flex items-center gap-1">
          <button id="nav-conversations" onClick={() => switchView('conversations')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 hover:bg-industrial-gray/20 ${currentView === 'conversations' ? 'text-industrial-yellow' : 'text-industrial-light'}`}>
            Conversas
          </button>
          <button id="nav-admin" onClick={() => switchView('admin')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 hover:bg-industrial-gray/20 ${currentView === 'admin' ? 'text-industrial-yellow' : 'text-industrial-light'}`}>
            Admin
          </button>
          <div className="w-px h-6 bg-industrial-gray/30 mx-2"></div>
          {/* SSE Status */}
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-industrial-black/30">
            <div className={`w-2 h-2 rounded-full pulse-dot ${connected ? 'bg-industrial-green' : 'bg-industrial-red'}`}></div>
            <span className="text-xs font-medium text-industrial-light">{connected ? 'Online' : 'Offline'}</span>
          </div>
          {/* Refresh */}
          <button onClick={refresh} className="ml-1 p-2 rounded-lg transition-all duration-200 hover:bg-industrial-gray/20 active:scale-95" title="Atualizar">
            <svg className={`w-4 h-4 text-industrial-light ${refreshing ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </button>
        </div>
      </nav>

      {/* ── Main Content Area (flex-1 min-h-0) ── */}
      <div className="flex-1 min-h-0 flex overflow-hidden">

        {/* ═══════════════════════════════════════════════
             VIEW: CONVERSATIONS
             ═══════════════════════════════════════════════ */}
        <div id="view-conversations" className={`${currentView === 'conversations' ? 'flex' : 'hidden'} flex-1 overflow-hidden`}>

          {/* ── Sidebar: Conversation List ── */}
          <aside id="sidebar" className={`${mobileShowChat ? 'hidden md:flex' : 'flex'} w-full md:w-[380px] md:flex-none flex-col bg-industrial-white md:border-r border-industrial-pale`}>

            {/* Sidebar Header (flex-none) */}
            <div className="flex-none p-5 border-b border-industrial-pale">
              {/* Title + Mobile SSE Status */}
              <div className="flex items-center justify-between mb-4">
                <h1 className="text-xl font-bold text-industrial-black">Conversas</h1>
                {/* Mobile SSE indicator */}
                <div className="flex md:hidden items-center gap-2 px-3 py-1 rounded-full bg-industrial-green-pale border border-industrial-green/20">
                  <div className={`w-1.5 h-1.5 rounded-full pulse-dot ${connected ? 'bg-industrial-green' : 'bg-industrial-red'}`}></div>
                  <span className="text-[11px] font-medium text-industrial-green">{connected ? 'Online' : 'Offline'}</span>
                </div>
              </div>

              {/* Search */}
              <div className="relative mb-3">
                <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-industrial-medium" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
                </svg>
                <input type="text" placeholder="Buscar conversas..." value={search} onChange={(e) => setSearch(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-industrial-surface border border-industrial-pale text-sm placeholder:text-industrial-light focus:outline-none focus:border-industrial-yellow focus:ring-1 focus:ring-industrial-yellow/30 transition-all duration-200" />
              </div>

              {/* Filter Tabs */}
              <div className="flex gap-1.5 overflow-x-auto pb-1 -mx-1 px-1">
                {(['todos','ia_ativa','humano','transferida','resolvida'] as string[]).map((f) => (
                  <button key={f} onClick={() => setActiveFilter(f)}
                    className={`filter-tab px-3 py-1.5 rounded-full text-[12px] font-medium whitespace-nowrap transition-all duration-200 ${activeFilter === f ? 'bg-industrial-yellow text-industrial-black active' : 'bg-industrial-surface text-industrial-medium hover:bg-industrial-pale'}`} data-filter={f}>
                    {f === 'todos' ? 'Todos' : f === 'ia_ativa' ? 'IA Ativa' : f === 'humano' ? 'Humano' : f === 'transferida' ? 'Transferida' : 'Resolvida'}
                  </button>
                ))}
              </div>
            </div>

            {/* Conversation List (flex-1 min-h-0 overflow-y-auto) — THE KEY SCROLL AREA */}
            <div className="flex-1 min-h-0 overflow-y-auto scroll-thin p-3 space-y-2" id="conversation-list">
              {loading && convList.length === 0 && (
                <div className="flex flex-col items-center justify-center py-12">
                  <RefreshCw className="w-6 h-6 animate-spin text-industrial-yellow" />
                  <p className="mt-3 text-sm text-industrial-medium">Carregando...</p>
                </div>
              )}
              {error && (
                <div className="p-4 rounded-xl bg-industrial-red-pale border border-industrial-red/20">
                  <p className="text-sm text-industrial-red">{error}</p>
                </div>
              )}
              {!loading && filteredConversations.length === 0 && (
                <div className="flex flex-col items-center justify-center py-12 text-industrial-medium">
                  <p className="text-sm">Nenhuma conversa encontrada.</p>
                </div>
              )}
              {filteredConversations.map((conv) => {
                const sc = statusConfig[conv.status];
                const isActive = conv.id === activeConversationId;
                const avatarBg = avatarColors[conv.status] || 'bg-industrial-gray';
                const avatarText = conv.status === 'ia_ativa' ? 'text-industrial-dark' : 'text-white';
                return (
                  <div key={conv.id}
                    className={`group p-4 rounded-xl cursor-pointer transition-all duration-200 ${isActive ? 'bg-industrial-yellow-pale/60 shadow-industrial-md' : 'bg-industrial-white shadow-industrial-sm hover:shadow-industrial-md hover:scale-[1.01] hover:bg-white'} border border-industrial-pale/60`}
                    onClick={() => selectConversation(conv.id)}>
                    <div className="flex gap-3.5">
                      {/* Avatar */}
                      <div className="relative flex-none">
                        <div className={`w-11 h-11 rounded-full ${avatarBg} flex items-center justify-center shadow-sm`}>
                          <span className={`text-[13px] font-bold ${avatarText}`}>{getInitials(conv.cliente_nome)}</span>
                        </div>
                        {(conv.unread_count || 0) > 0 && (
                          <div className="absolute -top-0.5 -right-0.5 w-5 h-5 rounded-full bg-industrial-yellow text-industrial-dark text-[10px] font-bold flex items-center justify-center border-2 border-white shadow-sm">{conv.unread_count}</div>
                        )}
                      </div>
                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2 mb-1">
                          <h3 className="text-[14px] font-semibold text-industrial-black truncate">{conv.cliente_nome || conv.cliente_telefone}</h3>
                          <span className="text-[11px] text-industrial-medium whitespace-nowrap flex-none mt-0.5">{timeShort(conv.ultima_msg_em)}</span>
                        </div>
                        <p className="text-[13px] text-industrial-gray line-clamp-2 leading-snug mb-2">{conv.ultima_mensagem || 'Sem mensagens'}</p>
                        <div className="flex items-center gap-2">
                          <span className="text-[11px] text-industrial-medium truncate">{conv.loja_nome || ''}</span>
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${sc.bg} ${sc.text} border ${sc.border} flex-none`}>{sc.label}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

          </aside>

          {/* ── Chat Panel ── */}
          <div id="chat-panel" className={`${mobileShowChat ? 'flex' : 'hidden md:flex'} flex-1 flex-col bg-industrial-surface`}>
            {activeConversation ? (
              <>
                {/* Chat Header (flex-none) */}
                <div className="flex-none p-4 bg-industrial-white border-b border-industrial-pale shadow-industrial-sm">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      {/* Mobile Back Button */}
                      <button onClick={showConversationList} className="md:hidden p-2 -ml-2 rounded-lg hover:bg-industrial-surface transition-colors duration-200 active:scale-95" aria-label="Voltar para conversas">
                        <svg className="w-5 h-5 text-industrial-gray" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
                        </svg>
                      </button>
                      {/* Avatar */}
                      <div className="w-10 h-10 rounded-full bg-industrial-yellow flex items-center justify-center flex-none">
                        <span className="text-sm font-bold text-industrial-dark">{getInitials(activeConversation.cliente_nome)}</span>
                      </div>
                      <div>
                        <h2 className="text-sm font-semibold text-industrial-black">{activeConversation.cliente_nome || activeConversation.cliente_telefone}</h2>
                        <p className="text-[12px] text-industrial-medium font-mono">{activeConversation.cliente_telefone}</p>
                      </div>
                      {/* Status Badge */}
                      <span className="hidden sm:inline-flex ml-2 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-industrial-yellow-pale text-industrial-yellow-dark border border-industrial-yellow/20">
                        {statusConfig[activeConversation.status]?.label || activeConversation.status}
                      </span>
                    </div>
                    {/* Actions Dropdown (click, not hover!) */}
                    <div className="relative" ref={actionsRef}>
                      <button onClick={() => setActionsOpen(!actionsOpen)} className="p-2 rounded-lg hover:bg-industrial-surface transition-all duration-200 active:scale-95" aria-label="Ações da conversa">
                        <svg className="w-5 h-5 text-industrial-medium" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.75a.75.75 0 110-1.5.75.75 0 010 1.5zM12 12.75a.75.75 0 110-1.5.75.75 0 010 1.5zM12 18.75a.75.75 0 110-1.5.75.75 0 010 1.5z" />
                        </svg>
                      </button>
                      <div id="chat-actions" className={`dropdown-menu absolute right-0 top-full mt-1 w-52 bg-industrial-white rounded-xl shadow-industrial-lg border border-industrial-pale z-50 py-1.5 ${actionsOpen ? '' : 'hidden'}`}>
                        {activeConversation.status === 'ia_ativa' && (
                          <button className="w-full px-4 py-2.5 text-left text-sm text-industrial-black hover:bg-industrial-surface transition-colors duration-150 flex items-center gap-2.5" onClick={() => { setActionsOpen(false); handleAction('assumir'); }}>
                            <svg className="w-4 h-4 text-industrial-blue" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0" /></svg>
                            Assumir conversa
                          </button>
                        )}
                        {activeConversation.status === 'humano' && (
                          <>
                            <button className="w-full px-4 py-2.5 text-left text-sm text-industrial-black hover:bg-industrial-surface transition-colors duration-150 flex items-center gap-2.5" onClick={() => { setActionsOpen(false); handleAction('devolver'); }}>
                              <svg className="w-4 h-4 text-industrial-yellow-dark" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865zM4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182" /></svg>
                              Devolver para IA
                            </button>
                            <button className="w-full px-4 py-2.5 text-left text-sm text-industrial-black hover:bg-industrial-surface transition-colors duration-150 flex items-center gap-2.5" onClick={() => { setActionsOpen(false); setTransferModal(true); }}>
                              <svg className="w-4 h-4 text-industrial-orange" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M7.5 21L3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5" /></svg>
                              Transferir
                            </button>
                          </>
                        )}
                        {(activeConversation.status === 'humano' || activeConversation.status === 'transferida') && (
                          <>
                            <div className="my-1 h-px bg-industrial-pale"></div>
                            <button className="w-full px-4 py-2.5 text-left text-sm text-industrial-black hover:bg-industrial-surface transition-colors duration-150 flex items-center gap-2.5" onClick={() => { setActionsOpen(false); handleAction('resolver'); }}>
                              <svg className="w-4 h-4 text-industrial-green" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                              Marcar como resolvida
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Chat Messages (flex-1 min-h-0 overflow-y-auto) — SECOND KEY SCROLL AREA */}
                <div className="flex-1 min-h-0 overflow-y-auto scroll-thin p-5" id="chat-messages">
                  {msgLoading && messages.length === 0 && (
                    <div className="flex flex-col items-center justify-center py-12">
                      <Loader2 className="h-8 w-8 animate-spin text-industrial-yellow" />
                      <p className="mt-3 text-sm font-medium text-industrial-medium">Carregando mensagens...</p>
                    </div>
                  )}
                  {messages.map((msg) => {
                    const isClient = msg.autor_tipo === 'cliente';
                    const isAgent = msg.autor_tipo === 'ia';
                    const bubbleBg = isClient
                      ? 'bg-industrial-white border border-industrial-pale'
                      : isAgent
                        ? 'bg-industrial-yellow-pale border border-industrial-yellow/15'
                        : 'bg-industrial-blue-pale border border-industrial-blue/15';
                    return (
                      <div key={msg.id} className={`flex ${isClient ? 'justify-start' : 'justify-end'} mb-3 msg-appear`}>
                        <div className={`${isClient ? 'mr-auto' : 'ml-auto'} max-w-[85%] md:max-w-[65%]`}>
                          <div className={`${bubbleBg} rounded-2xl px-4 py-3 shadow-industrial-sm`}>
                            {!isClient && (
                              <p className={`text-[11px] font-semibold ${isAgent ? 'text-industrial-yellow-dark' : 'text-industrial-blue'} mb-1`}>{msg.autor_nome}</p>
                            )}
                            {(msg.midia_tipo === 'text' || msg.midia_tipo === 'texto') && (
                              <p className="text-[14px] text-industrial-black leading-relaxed whitespace-pre-line">{msg.conteudo || '(sem texto)'}</p>
                            )}
                            {(msg.midia_tipo === 'image' || msg.midia_tipo === 'imagem') && (
                              <div className="space-y-1.5">
                                {msg.midia_url && <ImageLightbox src={msg.midia_url} alt={msg.descricao_imagem || 'Imagem'} />}
                                {msg.descricao_imagem && <p className="text-xs italic text-industrial-medium leading-relaxed">{msg.descricao_imagem}</p>}
                              </div>
                            )}
                            {(msg.midia_tipo === 'audio' || msg.midia_tipo === 'Áudio') && (
                              <div className="space-y-1.5">
                                {msg.midia_url && <AudioPlayer src={msg.midia_url} transcricao={msg.transcricao} />}
                              </div>
                            )}
                            {(msg.midia_tipo === 'video' || msg.midia_tipo === 'vídeo') && (
                              <div className="space-y-1.5">
                                {msg.midia_url && <video src={msg.midia_url} controls className="max-h-52 rounded-lg" preload="metadata" />}
                              </div>
                            )}
                            {(msg.midia_tipo === 'document' || msg.midia_tipo === 'documento') && (
                              <div className="space-y-1.5">
                                {msg.midia_url && (
                                  <a href={msg.midia_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 rounded-lg bg-white/60 px-3 py-2 text-xs font-semibold text-industrial-dark transition hover:bg-white">
                                    <FileText className="h-4 w-4 text-industrial-medium" />
                                    <span className="truncate">Abrir documento</span>
                                  </a>
                                )}
                              </div>
                            )}
                            {!['text','texto','image','imagem','audio','Áudio','video','vídeo','document','documento'].includes(msg.midia_tipo) && (
                              <p className="whitespace-pre-wrap italic text-industrial-medium">{msg.conteudo || '(conteúdo não suportado)'}</p>
                            )}
                          </div>
                          <p className={`text-[11px] text-industrial-light mt-1 ${isClient ? 'text-left' : 'text-right'}`}>{timeAgo(msg.enviada_em || msg.created_at)}</p>
                        </div>
                      </div>
                    );
                  })}
                  {typing && (
                    <div className="mb-3 flex items-end justify-end">
                      <div className="max-w-[80%] rounded-2xl border border-industrial-yellow/30 bg-industrial-yellow-pale px-4 py-2.5 text-sm text-industrial-dark md:max-w-[60%]">
                        <div className="flex items-center gap-1.5">
                          <span className="h-2 w-2 animate-bounce rounded-full bg-industrial-yellow-dark"></span>
                          <span className="h-2 w-2 animate-bounce rounded-full bg-industrial-yellow-dark" style={{ animationDelay: '0.2s' }}></span>
                          <span className="h-2 w-2 animate-bounce rounded-full bg-industrial-yellow-dark" style={{ animationDelay: '0.4s' }}></span>
                        </div>
                      </div>
                    </div>
                  )}
                  <div ref={bottomRef}></div>
                </div>

                {/* Chat Input (flex-none) */}
                <div className="flex-none p-4 bg-industrial-white border-t border-industrial-pale">
                  <div className="flex items-end gap-3">
                    {/* Attach button */}
                    <button className="p-2.5 rounded-xl bg-industrial-surface text-industrial-medium hover:bg-industrial-pale hover:text-industrial-gray transition-all duration-200 active:scale-95 flex-none" title="Anexar arquivo">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M18.375 12.739l-7.693 7.693a4.5 4.5 0 01-6.364-6.364l10.94-10.94A3 3 0 1119.5 7.372L8.552 18.32m0 0l-.01.01m5.638-8.387a3 3 0 11-4.242 4.242" />
                      </svg>
                    </button>
                    {/* Text Input */}
                    <div className="flex-1 relative">
                      <textarea id="msg-input" rows={1} placeholder="Digite sua mensagem..." value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
                        className="w-full px-4 py-2.5 rounded-xl bg-industrial-surface border border-industrial-pale text-sm placeholder:text-industrial-light resize-none focus:outline-none focus:border-industrial-yellow focus:ring-1 focus:ring-industrial-yellow/30 transition-all duration-200 max-h-32"
                        style={{ height: 'auto', minHeight: '40px' }}></textarea>
                    </div>
                    {/* Send Button */}
                    <button onClick={handleSend} className="p-2.5 rounded-xl bg-industrial-yellow text-industrial-dark hover:bg-industrial-yellow-dark hover:text-industrial-white transition-all duration-200 active:scale-95 flex-none shadow-industrial-sm" title="Enviar">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
                      </svg>
                    </button>
                  </div>
                </div>
              </>
            ) : (
              <div className="hidden md:flex flex-1 flex-col items-center justify-center text-industrial-medium">
                <svg className="mb-3 h-12 w-12 text-industrial-pale" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.126C3.738 16.636 3 14.474 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z" />
                </svg>
                <p className="text-sm font-semibold">Selecione uma conversa para começar.</p>
              </div>
            )}
          </div>

        </div>
        {/* /view-conversations */}

        {/* ═══════════════════════════════════════════════
             VIEW: ADMIN
             ═══════════════════════════════════════════════ */}
        <div id="view-admin" className={`${currentView === 'admin' ? 'flex' : 'hidden'} flex-1 flex-col overflow-hidden`}>

          {/* Admin Header with PROMINENT Back Button (flex-none) */}
          <div className="flex-none p-5 bg-industrial-white border-b border-industrial-pale shadow-industrial-sm">
            <div className="flex items-center gap-4">
              {/* ★ PROMINENT BACK BUTTON ★ */}
              <button onClick={() => switchView('conversations')} className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-industrial-yellow text-industrial-dark font-semibold text-sm shadow-industrial-sm hover:shadow-industrial-md hover:brightness-105 active:scale-[0.98] transition-all duration-200">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
                </svg>
                Voltar para Conversas
              </button>
              <div>
                <h1 className="text-xl font-bold text-industrial-black">Administração</h1>
                <p className="text-[12px] text-industrial-medium mt-0.5">Gerencie lojas, atendentes e configurações</p>
              </div>
            </div>
          </div>

          {/* Admin Tabs (flex-none) */}
          <div className="flex-none bg-industrial-white border-b border-industrial-pale">
            <div className="flex overflow-x-auto px-5 gap-1">
              {(['lojas','atendentes','agente','fluxo','whatsapp'] as string[]).map((tab) => (
                <button key={tab} onClick={() => setActiveAdminTab(tab)}
                  className={`admin-tab px-4 py-3 text-sm font-medium border-b-2 whitespace-nowrap transition-all duration-200 ${activeAdminTab === tab ? 'active border-industrial-yellow text-industrial-black' : 'border-transparent text-industrial-medium hover:text-industrial-gray'}`} data-tab={tab}>
                  {tab === 'lojas' ? 'Lojas' : tab === 'atendentes' ? 'Atendentes' : tab === 'agente' ? 'Agente IA' : tab === 'fluxo' ? 'Fluxo' : 'WhatsApp'}
                </button>
              ))}
            </div>
          </div>

          {/* Admin Content (flex-1 min-h-0 overflow-y-auto) */}
          <div className="flex-1 min-h-0 overflow-y-auto scroll-thin p-5" id="admin-content">
            <div className="tab-content max-w-4xl">
              <p className="text-sm text-industrial-medium">Painel administrativo — funcionalidades em desenvolvimento.</p>
            </div>
          </div>

        </div>
        {/* /view-admin */}

      </div>

      {/* ── Mobile Bottom Nav (md:hidden, flex-none) ── */}
      <nav className="md:hidden flex-none h-16 bg-industrial-dark flex items-center justify-around px-2 z-30 border-t border-industrial-gray/20 safe-area-bottom">
        <button id="mob-conversations" onClick={() => switchView('conversations')} className="flex flex-col items-center gap-1 py-2 px-4 rounded-lg transition-all duration-200 active:scale-95">
          <svg className={`w-6 h-6 ${currentView === 'conversations' ? 'text-industrial-yellow' : 'text-industrial-light'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.126C3.738 16.636 3 14.474 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z" />
          </svg>
          <span className={`text-[10px] font-medium ${currentView === 'conversations' ? 'text-industrial-yellow' : 'text-industrial-light'}`}>Conversas</span>
        </button>
        <button id="mob-admin" onClick={() => switchView('admin')} className="flex flex-col items-center gap-1 py-2 px-4 rounded-lg transition-all duration-200 active:scale-95">
          <svg className={`w-6 h-6 ${currentView === 'admin' ? 'text-industrial-yellow' : 'text-industrial-light'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.312.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          <span className={`text-[10px] font-medium ${currentView === 'admin' ? 'text-industrial-yellow' : 'text-industrial-light'}`}>Admin</span>
        </button>
      </nav>

      {/* Transfer Modal */}
      {transferModal && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-4 sm:items-center">
          <div className="w-full max-w-sm rounded-2xl border border-industrial-pale bg-white p-6 shadow-industrial-lg">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-base font-bold text-industrial-black">Transferir conversa</h3>
              <button onClick={() => setTransferModal(false)} className="rounded-lg p-1 text-industrial-medium transition hover:bg-industrial-surface">
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="mb-1.5 block text-sm font-semibold text-industrial-dark">Loja de destino</label>
                <select value={transferLoja} onChange={(e) => setTransferLoja(e.target.value)}
                  className="w-full rounded-xl border border-industrial-pale bg-industrial-surface px-4 py-3 text-sm text-industrial-black shadow-industrial-sm outline-none transition focus:border-industrial-yellow focus:ring-2 focus:ring-industrial-yellow/20">
                  <option value="">Selecione uma loja...</option>
                  <option value="loja-vendas">Vendas</option>
                  <option value="loja-locacao">Locação</option>
                  <option value="loja-manutencao">Manutenção</option>
                </select>
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <button onClick={() => setTransferModal(false)} className="px-4 py-2.5 rounded-xl text-sm font-medium text-industrial-gray hover:bg-industrial-surface transition">Cancelar</button>
              <button onClick={handleTransfer} disabled={!transferLoja}
                className="px-5 py-2.5 rounded-xl bg-industrial-yellow text-industrial-dark text-sm font-semibold shadow-industrial-sm hover:shadow-industrial-md hover:brightness-105 active:scale-[0.98] transition-all duration-200 disabled:opacity-50">Transferir</button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
