'use client';

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { Conversation } from '@/types';
import { StatusBadge } from './StatusBadge';
import { timeAgo } from '@/lib/time';
import {
  ArrowLeftRight,
  MessageSquare,
  MoreVertical,
  Archive,
  Trash2,
  RotateCcw,
  UserCheck,
  X,
} from 'lucide-react';

interface ConversationCardProps {
  conversation: Conversation;
  onAction?: (action: string, conv: Conversation) => void;
}

export function ConversationCard({ conversation: c, onAction }: ConversationCardProps) {
  const unreadCount = c.unread_count || 0;
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close menu on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    if (menuOpen) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [menuOpen]);

  const handleMenuAction = (action: string) => {
    setMenuOpen(false);
    onAction?.(action, c);
  };

  return (
    <div className="group relative">
      <Link
        key={c.id}
        href={`/conversations/chat?id=${c.id}`}
        className="block"
      >
        <div className="relative rounded-2xl border border-industrial-pale/80 bg-white p-4 shadow-industrial transition-all duration-200 hover:shadow-industrial-md hover:border-industrial-yellow/30 active:scale-[0.995]">
          {/* Unread indicator */}
          {unreadCount > 0 && (
            <div className="absolute right-3 top-3 flex h-5 min-w-[20px] items-center justify-center rounded-full bg-industrial-red px-1.5 text-[10px] font-bold text-white">
              {unreadCount > 99 ? '99+' : unreadCount}
            </div>
          )}

          <div className="flex items-start justify-between gap-3">
            {/* Avatar */}
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-industrial-surface text-sm font-bold text-industrial-medium">
              {(c.cliente_nome || 'C').charAt(0).toUpperCase()}
            </div>

            <div className="min-w-0 flex-1">
              {/* Top row: name + phone */}
              <div className="flex items-center gap-2">
                <span className="truncate text-sm font-bold text-industrial-black">
                  {c.cliente_nome || 'Cliente'}
                </span>
                <span className="shrink-0 text-[11px] font-medium text-industrial-light">
                  {c.cliente_telefone}
                </span>
              </div>

              {/* Status row */}
              <div className="mt-1 flex flex-wrap items-center gap-1.5">
                <StatusBadge status={c.status} />
                {c.transferida && (
                  <span className="inline-flex items-center gap-1 rounded-md bg-industrial-orange-pale px-1.5 py-0.5 text-[10px] font-semibold text-industrial-orange border border-industrial-orange/10">
                    <ArrowLeftRight className="h-2.5 w-2.5" />
                    Transferida
                  </span>
                )}
              </div>

              {/* Last message preview */}
              {c.ultima_mensagem && (
                <div className="mt-2 flex items-start gap-1.5">
                  <MessageSquare className="mt-0.5 h-3 w-3 shrink-0 text-industrial-light" />
                  <p className="truncate text-xs text-industrial-medium">
                    {c.ultima_mensagem}
                  </p>
                </div>
              )}

              {/* Bottom row: loja + time */}
              <div className="mt-2 flex items-center justify-between">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-industrial-light">
                  {c.loja_nome || '—'}
                </span>
                <span className="text-[11px] font-medium text-industrial-light">
                  {timeAgo(c.ultima_msg_em || c.updated_at)}
                </span>
              </div>
            </div>
          </div>
        </div>
      </Link>

      {/* Context menu trigger */}
      <button
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setMenuOpen(!menuOpen);
        }}
        className="absolute right-3 top-3 z-10 rounded-lg p-1.5 text-industrial-light opacity-0 transition hover:bg-industrial-surface hover:text-industrial-dark group-hover:opacity-100"
        style={{ top: unreadCount > 0 ? '2.5rem' : '0.75rem' }}
      >
        <MoreVertical className="h-4 w-4" />
      </button>

      {/* Context menu */}
      {menuOpen && (
        <div
          ref={menuRef}
          className="absolute right-3 top-10 z-20 w-44 overflow-hidden rounded-xl border border-industrial-pale bg-white shadow-industrial-lg"
          style={{ top: unreadCount > 0 ? '2.75rem' : '1rem' }}
        >
          <div className="py-1">
            {c.status === 'resolvida' && (
              <button
                onClick={() => handleMenuAction('reopen')}
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm font-medium text-industrial-dark transition hover:bg-industrial-surface"
              >
                <RotateCcw className="h-4 w-4 text-industrial-yellow" />
                Reabrir
              </button>
            )}
            {c.status === 'ia_ativa' && (
              <button
                onClick={() => handleMenuAction('take')}
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm font-medium text-industrial-dark transition hover:bg-industrial-surface"
              >
                <UserCheck className="h-4 w-4 text-industrial-blue" />
                Assumir
              </button>
            )}
            {c.status !== 'resolvida' && (
              <button
                onClick={() => handleMenuAction('archive')}
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm font-medium text-industrial-dark transition hover:bg-industrial-surface"
              >
                <Archive className="h-4 w-4 text-industrial-medium" />
                Arquivar
              </button>
            )}
            <button
              onClick={() => handleMenuAction('delete')}
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm font-medium text-industrial-red transition hover:bg-industrial-red-pale"
            >
              <Trash2 className="h-4 w-4" />
              Excluir
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
