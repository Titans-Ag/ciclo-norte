'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { useState } from 'react';
import {
  MessageSquare,
  Settings,
  LogOut,
  Menu,
  X,
  Shield,
  ChevronLeft,
} from 'lucide-react';

const NAV_ITEMS = [
  { href: '/conversations', label: 'Conversas', icon: MessageSquare },
  { href: '/admin', label: 'Admin', icon: Shield, adminOnly: true },
];

export function Navbar() {
  const { user, logout, isAdmin } = useAuth();
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  const showBack = pathname?.startsWith('/conversations/chat') || pathname === '/admin';
  const backHref = pathname?.startsWith('/conversations/chat') ? '/conversations' : '/';

  const filteredNav = NAV_ITEMS.filter((item) => !item.adminOnly || isAdmin);

  return (
    <nav className="sticky top-0 z-50 border-b border-industrial-pale bg-white/90 backdrop-blur-md shadow-industrial">
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4 md:px-6">
        {/* Left: logo / back */}
        <div className="flex items-center gap-3">
          {showBack ? (
            <Link
              href={backHref}
              className="flex items-center gap-1.5 rounded-lg p-1.5 text-industrial-dark transition hover:bg-industrial-surface"
            >
              <ChevronLeft className="h-5 w-5" />
              <span className="hidden text-sm font-semibold sm:inline">Voltar</span>
            </Link>
          ) : (
            <Link href="/conversations" className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-industrial-black">
                <MessageSquare className="h-4 w-4 text-industrial-yellow" />
              </div>
              <span className="hidden text-sm font-bold tracking-tight text-industrial-black sm:inline">
                Ciclo Norte
              </span>
            </Link>
          )}
        </div>

        {/* Center: nav links (desktop) */}
        <div className="hidden items-center gap-1 md:flex">
          {filteredNav.map((item) => {
            const active = pathname === item.href || pathname?.startsWith(item.href + '/');
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-semibold transition-all duration-150 ${
                  active
                    ? 'bg-industrial-black text-white shadow-industrial'
                    : 'text-industrial-medium hover:bg-industrial-surface hover:text-industrial-dark'
                }`}
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}
        </div>

        {/* Right: user + logout */}
        <div className="flex items-center gap-2">
          {user && (
            <div className="hidden items-center gap-2 md:flex">
              <div className="flex flex-col items-end">
                <span className="text-xs font-bold text-industrial-black">{user.nome}</span>
                <span className="text-[10px] font-medium uppercase tracking-wider text-industrial-light">
                  {user.role === 'admin' ? 'Administrador' : 'Atendente'}
                </span>
              </div>
              <button
                onClick={logout}
                className="rounded-lg p-2 text-industrial-medium transition hover:bg-industrial-red-pale hover:text-industrial-red"
                title="Sair"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </div>
          )}

          {/* Mobile hamburger */}
          <button
            onClick={() => setMobileOpen(!mobileOpen)}
            className="rounded-lg p-2 text-industrial-dark transition hover:bg-industrial-surface md:hidden"
          >
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {mobileOpen && (
        <div className="border-t border-industrial-pale bg-white px-4 pb-4 pt-2 md:hidden">
          <div className="flex flex-col gap-1">
            {filteredNav.map((item) => {
              const active = pathname === item.href || pathname?.startsWith(item.href + '/');
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMobileOpen(false)}
                  className={`flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm font-semibold transition ${
                    active
                      ? 'bg-industrial-black text-white'
                      : 'text-industrial-medium hover:bg-industrial-surface'
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  {item.label}
                </Link>
              );
            })}
            {user && (
              <button
                onClick={() => {
                  setMobileOpen(false);
                  logout();
                }}
                className="mt-2 flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm font-semibold text-industrial-red transition hover:bg-industrial-red-pale"
              >
                <LogOut className="h-4 w-4" />
                Sair
              </button>
            )}
          </div>
        </div>
      )}
    </nav>
  );
}
