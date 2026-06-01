'use client';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:8085';

import { useState, useEffect, useRef, useCallback, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { useConversations } from '@/hooks/useConversations';
import { useSSE } from '@/hooks/useSSE';
import { StatusBadge } from '@/components/StatusBadge';
import { timeAgo } from '@/lib/time';
import { Message, Conversation, SSEEvent } from '@/types';
import {
  ArrowLeft,
  Send,
  UserCheck,
  UserX,
  ArrowRightLeft,
  CheckCircle,
  Play,
  Pause,
  Loader2,
  Wifi,
  WifiOff,
} from 'lucide-react';

function MessageBubble({ msg }: { msg: Message }) {
  const isCliente = msg.autor_tipo === 'cliente';
  const isIA = msg.autor_tipo === 'ia';

  const align = isCliente ? 'items-start' : 'items-end';
  const bubbleBg = isCliente
    ? 'bg-gray-100 text-gray-900'
    : isIA
    ? 'bg-blue-50 text-blue-900'
    : 'bg-green-50 text-green-900';

  const [playing, setPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const toggleAudio = () => {
    if (!audioRef.current) return;
    if (playing) {
      audioRef.current.pause();
      setPlaying(false);
    } else {
      audioRef.current.play();
      setPlaying(true);
    }
  };

  const handleEnded = () => setPlaying(false);

  return (
    <div className={`flex flex-col ${align} mb-3`}>
      <div className="mb-0.5 text-xs text-gray-500">
        <span className="font-medium">{msg.autor_nome}</span>{' '}
        <span className="text-gray-400">{timeAgo(msg.enviada_em || msg.created_at)}</span>
      </div>

      <div className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm md:max-w-[60%] ${bubbleBg}`}>
        {msg.tipo_midia === 'texto' && (
          <p className="whitespace-pre-wrap">{msg.conteudo}</p>
        )}

        {msg.tipo_midia === 'imagem' && (
          <div className="space-y-1">
            {msg.midia_url && (
              <img
                src={msg.midia_url}
                alt={msg.descricao_imagem || 'Imagem'}
                className="max-h-48 rounded-lg object-cover"
              />
            )}
            {msg.descricao_imagem && (
              <p className="text-xs italic text-gray-600">{msg.descricao_imagem}</p>
            )}
          </div>
        )}

        {msg.tipo_midia === 'audio' && (
          <div className="space-y-1">
            <button
              onClick={toggleAudio}
              className="flex items-center gap-2 rounded-lg bg-white/60 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-white/80"
            >
              {playing ? (
                <Pause className="h-4 w-4" />
              ) : (
                <Play className="h-4 w-4" />
              )}
              {playing ? 'Pausar' : 'Ouvir áudio'}
            </button>
            {msg.midia_url && (
              <audio
                ref={audioRef}
                src={msg.midia_url}
                onEnded={handleEnded}
                className="hidden"
              />
            )}
            {msg.transcricao && (
              <div className="rounded bg-white/50 px-2 py-1 text-xs text-gray-700">
                📝 {msg.transcricao}
              </div>
            )}
          </div>
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
    }
    setSending(false);
  };

  const handleAction = async (action: string, body?: unknown) => {
    setActionLoading(action);
    try {
      const res = await fetch(`${API_BASE}/api/conversations/${conversaId}/${action}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: body ? JSON.stringify(body) : undefined,
      });
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
      <div className="flex h-full items-center justify-center text-gray-400">
        Selecione uma conversa na lista.
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-center gap-3 border-b border-gray-200 bg-white px-3 py-2 md:px-4 md:py-3">
        <Link
          href="/conversations"
          className="rounded-lg p-1 text-gray-500 hover:bg-gray-100"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>

        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-semibold text-gray-900">
            {conversation?.cliente_nome || 'Conversa'}
          </div>
          <div className="flex items-center gap-2">
            <StatusBadge status={conversation?.status || 'ia_ativa'} />
            <span className="text-xs text-gray-400">
              {conversation?.loja_nome}
            </span>
            {connected ? (
              <Wifi className="h-3 w-3 text-green-600" />
            ) : (
              <WifiOff className="h-3 w-3 text-red-500" />
            )}
          </div>
        </div>

        <div className="flex items-center gap-1">
          {conversation?.status === 'ia_ativa' && (
            <button
              onClick={() => handleAction('assumir')}
              disabled={!!actionLoading}
              className="flex items-center gap-1 rounded-lg bg-green-600 px-2 py-1.5 text-xs font-medium text-white hover:bg-green-700 disabled:opacity-60"
            >
              <UserCheck className="h-3.5 w-3.5" />
              Assumir
            </button>
          )}

          {conversation?.status === 'humano' && (
            <>
              <button
                onClick={() => handleAction('devolver')}
                disabled={!!actionLoading}
                className="flex items-center gap-1 rounded-lg bg-gray-600 px-2 py-1.5 text-xs font-medium text-white hover:bg-gray-700 disabled:opacity-60"
              >
                <UserX className="h-3.5 w-3.5" />
                Devolver
              </button>
              <button
                onClick={() => setTransferModal(true)}
                disabled={!!actionLoading}
                className="flex items-center gap-1 rounded-lg bg-orange-600 px-2 py-1.5 text-xs font-medium text-white hover:bg-orange-700 disabled:opacity-60"
              >
                <ArrowRightLeft className="h-3.5 w-3.5" />
                Transferir
              </button>
            </>
          )}

          {(conversation?.status === 'humano' || conversation?.status === 'transferida') && (
            <button
              onClick={() => handleAction('resolver')}
              disabled={!!actionLoading}
              className="flex items-center gap-1 rounded-lg bg-blue-600 px-2 py-1.5 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-60"
            >
              <CheckCircle className="h-3.5 w-3.5" />
              Resolver
            </button>
          )}
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto bg-gray-50 px-3 py-3 md:px-6 md:py-4">
        {msgLoading && messages.length === 0 && (
          <div className="flex items-center justify-center py-10 text-gray-400">
            <Loader2 className="mr-2 h-5 w-5 animate-spin" />
            Carregando mensagens...
          </div>
        )}

        <div className="mx-auto max-w-3xl">
          {messages.map((msg) => (
            <MessageBubble key={msg.id} msg={msg} />
          ))}

          {typing && (
            <div className="mb-3 flex items-end justify-end">
              <div className="max-w-[80%] rounded-2xl bg-blue-50 px-3 py-2 text-sm text-blue-900 md:max-w-[60%]">
                <div className="flex items-center gap-1">
                  <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-blue-400" />
                  <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-blue-400 [animation-delay:0.2s]" />
                  <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-blue-400 [animation-delay:0.4s]" />
                </div>
              </div>
            </div>
          )}

          <div ref={bottomRef} />
        </div>
      </div>

      {/* Input */}
      <div className="border-t border-gray-200 bg-white px-3 py-2 md:px-4 md:py-3">
        <div className="mx-auto flex max-w-3xl items-center gap-2">
          <input
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
            className="flex-1 rounded-xl border border-gray-300 bg-gray-50 px-4 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 disabled:opacity-60"
          />
          <button
            onClick={handleSend}
            disabled={sending || !input.trim()}
            className="flex items-center justify-center rounded-xl bg-blue-600 p-2.5 text-white transition hover:bg-blue-700 disabled:opacity-60"
          >
            {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {/* Transfer Modal */}
      {transferModal && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center">
          <div className="w-full max-w-sm rounded-xl bg-white p-4 shadow-xl">
            <h3 className="mb-3 text-base font-semibold text-gray-900">Transferir conversa</h3>
            <div className="space-y-3">
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Loja</label>
                <select
                  value={transferLoja}
                  onChange={(e) => setTransferLoja(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none"
                >
                  <option value="">Selecione...</option>
                  <option value="loja-vendas">Vendas</option>
                  <option value="loja-locacao">Locação</option>
                  <option value="loja-manutencao">Manutenção</option>
                </select>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Atendente (opcional)</label>
                <input
                  value={transferAtendente}
                  onChange={(e) => setTransferAtendente(e.target.value)}
                  placeholder="ID do atendente"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none"
                />
              </div>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button
                onClick={() => setTransferModal(false)}
                className="rounded-lg px-3 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100"
              >
                Cancelar
              </button>
              <button
                onClick={handleTransfer}
                disabled={!transferLoja || !!actionLoading}
                className="rounded-lg bg-orange-600 px-3 py-2 text-sm font-medium text-white hover:bg-orange-700 disabled:opacity-60"
              >
                Transferir
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function ChatPage() {
  return (
    <Suspense fallback={
      <div className="flex h-full items-center justify-center text-gray-400">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
        Carregando...
      </div>
    }>
      <ChatContent />
    </Suspense>
  );
}
