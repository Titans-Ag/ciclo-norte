'use client';

import { useState, useEffect, useRef, useCallback, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { useConversations } from '@/hooks/useConversations';
import { useSSE } from '@/hooks/useSSE';
import { StatusBadge } from '@/components/StatusBadge';
import { IndustrialButton } from '@/components/IndustrialButton';
import { AudioPlayer } from '@/components/AudioPlayer';
import { ImageLightbox } from '@/components/ImageLightbox';
import { timeAgo } from '@/lib/time';
import { Message, Conversation, SSEEvent } from '@/types';
import {
  ArrowLeft,
  Send,
  UserCheck,
  UserX,
  ArrowRightLeft,
  CheckCircle2,
  Loader2,
  Wifi,
  WifiOff,
  FileText,
  Play,
  X,
  Wrench,
} from 'lucide-react';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:8085';

function MessageBubble({ msg }: { msg: Message }) {
  const isCliente = msg.autor_tipo === 'cliente';
  const isIA = msg.autor_tipo === 'ia';
  const isAtendente = msg.autor_tipo === 'atendente';

  const align = isCliente ? 'items-start' : 'items-end';
  const bubbleBg = isCliente
    ? 'bg-white border border-industrial-pale text-industrial-black'
    : isIA
    ? 'bg-industrial-yellow-pale border border-industrial-yellow/30 text-industrial-dark'
    : 'bg-industrial-blue-pale border border-industrial-blue/20 text-industrial-dark';

  const authorColor = isCliente
    ? 'text-industrial-dark'
    : isIA
    ? 'text-industrial-yellow-dark'
    : 'text-industrial-blue';

  const avatarBg = isCliente
    ? 'bg-industrial-pale'
    : isIA
    ? 'bg-industrial-yellow'
    : 'bg-industrial-blue';

  const avatarIcon = isCliente ? (
    <span className="text-xs font-bold text-industrial-medium">C</span>
  ) : isIA ? (
    <Wrench className="h-3 w-3 text-industrial-black" />
  ) : (
    <span className="text-xs font-bold text-white">A</span>
  );

  return (
    <div className={`flex flex-col ${align} mb-4`}>
      <div className="mb-1 flex items-center gap-2">
        <div
          className={`flex h-5 w-5 items-center justify-center rounded-full ${avatarBg}`}
        >
          {avatarIcon}
        </div>
        <span className={`text-xs font-bold ${authorColor}`}>
          {msg.autor_nome}
        </span>
        <span className="text-[10px] text-industrial-light">
          {timeAgo(msg.enviada_em || msg.created_at)}
        </span>
      </div>

      <div
        className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm md:max-w-[65%] ${bubbleBg}`}
      >
        {(msg.midia_tipo === 'text' || msg.midia_tipo === 'texto') && (
          <p className="whitespace-pre-wrap leading-relaxed">
            {msg.conteudo || '(sem texto)'}
          </p>
        )}

        {(msg.midia_tipo === 'image' || msg.midia_tipo === 'imagem') && (
          <div className="space-y-1.5">
            {msg.midia_url && <ImageLightbox src={msg.midia_url} alt={msg.descricao_imagem || 'Imagem'} />}
            {msg.descricao_imagem && (
              <p className="text-xs italic text-industrial-medium leading-relaxed">
                {msg.descricao_imagem}
              </p>
            )}
          </div>
        )}

        {(msg.midia_tipo === 'audio' || msg.midia_tipo === 'Áudio') && (
          <div className="space-y-1.5">
            {msg.midia_url && (
              <AudioPlayer src={msg.midia_url} transcricao={msg.transcricao} />
            )}
          </div>
        )}

        {(msg.midia_tipo === 'video' || msg.midia_tipo === 'vídeo') && (
          <div className="space-y-1.5">
            {msg.midia_url && (
              <video
                src={msg.midia_url}
                controls
                className="max-h-52 rounded-lg"
                preload="metadata"
              />
            )}
          </div>
        )}

        {(msg.midia_tipo === 'document' || msg.midia_tipo === 'documento') && (
          <div className="space-y-1.5">
            {msg.midia_url && (
              <a
                href={msg.midia_url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 rounded-lg bg-white/60 px-3 py-2 text-xs font-semibold text-industrial-dark transition hover:bg-white"
              >
                <FileText className="h-4 w-4 text-industrial-medium" />
                <span className="truncate">Abrir documento</span>
              </a>
            )}
          </div>
        )}

        {![
          'text', 'texto',
          'image', 'imagem',
          'audio', 'Áudio',
          'video', 'vídeo',
          'document', 'documento',
        ].includes(msg.midia_tipo) && (
          <p className="whitespace-pre-wrap italic text-industrial-medium">
            {msg.conteudo || '(conteúdo não suportado)'}
          </p>
        )}
      </div>
    </div>
  );
}

function ChatContent() {
  const searchParams = useSearchParams();
  const conversaId = searchParams.get('id') || '';

  const { token, user } = useAuth();
  const {
    conversations,
    fetchConversations,
    fetchMessages,
    sendMessage,
    updateConversation,
  } = useConversations(token);
  const { connected, fallbackActive, lastEvent } = useSSE(token);

  const [messages, setMessages] = useState<Message[]>([]);
  const [msgLoading, setMsgLoading] = useState(false);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [typing, setTyping] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [transferModal, setTransferModal] = useState(false);
  const [transferLoja, setTransferLoja] = useState('');
  const [transferAtendente, setTransferAtendente] = useState('');
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const conversation = conversations.find((c) => c.id === conversaId);

  useEffect(() => {
    if (!conversaId || !token) return;
    setMsgLoading(true);
    fetchMessages(conversaId)
      .then((msgs) => setMessages(msgs))
      .finally(() => setMsgLoading(false));
  }, [conversaId, token, fetchMessages]);

  useEffect(() => {
    if (!lastEvent) return;
    handleSSE(lastEvent);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lastEvent]);

  const handleSSE = (ev: SSEEvent) => {
    if (ev.type === 'new_message' && ev.payload) {
      const payload = ev.payload as { conversa_id: string; message: Message };
      if (payload.conversa_id === conversaId) {
        setMessages((prev) => [...prev, payload.message]);
      }
    }
    if (ev.type === 'typing' && ev.payload) {
      const payload = ev.payload as { conversa_id: string; active: boolean };
      if (payload.conversa_id === conversaId) {
        setTyping(payload.active);
      }
    }
    if (ev.type === 'conversation_update' && ev.payload) {
      const c = ev.payload as Conversation;
      if (c.id === conversaId) {
        updateConversation(c);
      }
    }
  };

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, typing]);

  const handleSend = async () => {
    if (!input.trim() || sending) return;
    setSending(true);
    const ok = await sendMessage(conversaId, input.trim());
    if (ok) {
      setInput('');
      const msgs = await fetchMessages(conversaId);
      setMessages(msgs);
      inputRef.current?.focus();
    }
    setSending(false);
  };

  const handleAction = async (action: string, body?: unknown) => {
    setActionLoading(action);
    try {
      const res = await fetch(
        `${API_BASE}/api/conversations/${conversaId}/${action}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: body ? JSON.stringify(body) : undefined,
        }
      );
      if (res.ok) {
        await fetchConversations();
      }
    } catch {
      // ignore
    } finally {
      setActionLoading(null);
    }
  };

  const handleTransfer = async () => {
    if (!transferLoja) return;
    await handleAction('transferir', {
      loja_id: transferLoja,
      atendente_id: transferAtendente || undefined,
    });
    setTransferModal(false);
    setTransferLoja('');
    setTransferAtendente('');
  };

  if (!conversaId) {
    return (
      <div className="flex h-full flex-col items-center justify-center text-industrial-medium">
        <Wrench className="mb-3 h-12 w-12 text-industrial-pale" />
        <p className="text-sm font-semibold">Selecione uma conversa na lista.</p>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col bg-industrial-surface">
      {/* Header */}
      <div className="flex items-center gap-3 border-b border-industrial-pale bg-white px-4 py-3 md:px-6 md:py-4">
        <Link
          href="/conversations"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-industrial-medium transition hover:bg-industrial-surface hover:text-industrial-dark md:hidden"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>

        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-bold text-industrial-black">
            {conversation?.cliente_nome || 'Conversa'}
          </div>
          <div className="flex items-center gap-2">
            <StatusBadge status={conversation?.status || 'ia_ativa'} size="sm" />
            <span className="text-[11px] font-semibold uppercase tracking-wider text-industrial-light">
              {conversation?.loja_nome}
            </span>
            {connected ? (
              <Wifi className="h-3 w-3 text-industrial-green" />
            ) : (
              <WifiOff className="h-3 w-3 text-industrial-red" />
            )}
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          {conversation?.status === 'ia_ativa' && (
            <IndustrialButton
              variant="primary"
              size="sm"
              onClick={() => handleAction('assumir')}
              loading={actionLoading === 'assumir'}
              leftIcon={<UserCheck className="h-3.5 w-3.5" />}
            >
              Assumir
            </IndustrialButton>
          )}

          {conversation?.status === 'humano' && (
            <>
              <IndustrialButton
                variant="ghost"
                size="sm"
                onClick={() => handleAction('devolver')}
                loading={actionLoading === 'devolver'}
                leftIcon={<UserX className="h-3.5 w-3.5" />}
              >
                Devolver
              </IndustrialButton>
              <IndustrialButton
                variant="secondary"
                size="sm"
                onClick={() => setTransferModal(true)}
                loading={actionLoading === 'transferir'}
                leftIcon={<ArrowRightLeft className="h-3.5 w-3.5" />}
              >
                Transferir
              </IndustrialButton>
            </>
          )}

          {(conversation?.status === 'humano' ||
            conversation?.status === 'transferida') && (
            <IndustrialButton
              variant="dark"
              size="sm"
              onClick={() => handleAction('resolver')}
              loading={actionLoading === 'resolver'}
              leftIcon={<CheckCircle2 className="h-3.5 w-3.5" />}
            >
              Resolver
            </IndustrialButton>
          )}
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 md:px-8 md:py-6">
        {msgLoading && messages.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-industrial-yellow" />
            <p className="mt-3 text-sm font-medium text-industrial-medium">
              Carregando mensagens...
            </p>
          </div>
        )}

        <div className="mx-auto max-w-3xl">
          {messages.map((msg) => (
            <MessageBubble key={msg.id} msg={msg} />
          ))}

          {typing && (
            <div className="mb-4 flex items-end justify-end">
              <div className="max-w-[80%] rounded-2xl border border-industrial-yellow/30 bg-industrial-yellow-pale px-4 py-2.5 text-sm text-industrial-dark md:max-w-[60%]">
                <div className="flex items-center gap-1.5">
                  <span className="h-2 w-2 animate-bounce rounded-full bg-industrial-yellow-dark" />
                  <span
                    className="h-2 w-2 animate-bounce rounded-full bg-industrial-yellow-dark"
                    style={{ animationDelay: '0.2s' }}
                  />
                  <span
                    className="h-2 w-2 animate-bounce rounded-full bg-industrial-yellow-dark"
                    style={{ animationDelay: '0.4s' }}
                  />
                </div>
              </div>
            </div>
          )}

          <div ref={bottomRef} />
        </div>
      </div>

      {/* Input */}
      <div className="border-t border-industrial-pale bg-white px-4 py-3 md:px-6 md:py-4">
        <div className="mx-auto flex max-w-3xl items-center gap-2">
          <input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            placeholder="Digite uma mensagem..."
            disabled={sending}
            className="flex-1 rounded-xl border border-industrial-pale bg-industrial-surface px-4 py-3 text-sm font-medium text-industrial-black shadow-industrial outline-none transition placeholder:text-industrial-light focus:border-industrial-yellow focus:ring-2 focus:ring-industrial-yellow/20 disabled:opacity-50"
          />
          <IndustrialButton
            variant="dark"
            size="md"
            onClick={handleSend}
            loading={sending}
            disabled={!input.trim()}
            leftIcon={
              sending ? undefined : <Send className="h-4 w-4" />
            }
            className="shrink-0"
          >
            {sending ? '' : 'Enviar'}
          </IndustrialButton>
        </div>
      </div>

      {/* Transfer Modal */}
      {transferModal && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-4 sm:items-center">
          <div className="w-full max-w-sm rounded-2xl border border-industrial-pale bg-white p-6 shadow-industrial-lg">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-base font-bold text-industrial-black">
                Transferir conversa
              </h3>
              <button
                onClick={() => setTransferModal(false)}
                className="rounded-lg p-1 text-industrial-medium transition hover:bg-industrial-surface"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="mb-1.5 block text-sm font-semibold text-industrial-dark">
                  Loja de destino
                </label>
                <select
                  value={transferLoja}
                  onChange={(e) => setTransferLoja(e.target.value)}
                  className="w-full rounded-xl border border-industrial-pale bg-industrial-surface px-4 py-3 text-sm text-industrial-black shadow-industrial outline-none transition focus:border-industrial-yellow focus:ring-2 focus:ring-industrial-yellow/20"
                >
                  <option value="">Selecione uma loja...</option>
                  <option value="loja-vendas">Vendas</option>
                  <option value="loja-locacao">Locação</option>
                  <option value="loja-manutencao">Manutenção</option>
                </select>
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-semibold text-industrial-dark">
                  Atendente (opcional)
                </label>
                <input
                  value={transferAtendente}
                  onChange={(e) => setTransferAtendente(e.target.value)}
                  placeholder="ID do atendente"
                  className="w-full rounded-xl border border-industrial-pale bg-industrial-surface px-4 py-3 text-sm text-industrial-black shadow-industrial outline-none transition placeholder:text-industrial-light focus:border-industrial-yellow focus:ring-2 focus:ring-industrial-yellow/20"
                />
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-2">
              <IndustrialButton
                variant="ghost"
                size="md"
                onClick={() => setTransferModal(false)}
              >
                Cancelar
              </IndustrialButton>
              <IndustrialButton
                variant="primary"
                size="md"
                onClick={handleTransfer}
                loading={actionLoading === 'transferir'}
                disabled={!transferLoja}
                leftIcon={<ArrowRightLeft className="h-4 w-4" />}
              >
                Transferir
              </IndustrialButton>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function ChatPage() {
  return (
    <Suspense
      fallback={
        <div className="flex h-full flex-col items-center justify-center text-industrial-medium">
          <Loader2 className="mr-2 h-8 w-8 animate-spin text-industrial-yellow" />
          <p className="mt-2 text-sm font-semibold">Carregando...</p>
        </div>
      }
    >
      <ChatContent />
    </Suspense>
  );
}
