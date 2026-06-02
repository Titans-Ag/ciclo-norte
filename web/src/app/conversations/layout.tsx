'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { IndustrialLogo } from '@/components/IndustrialLogo';
import { LogOut, MessageSquare, Settings, Users, Menu, X } from 'lucide-react';

export default function ConversationsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, logout, isAdmin } = useAuth();
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  const navItems = [
    {
      href: '/conversations',
      label: 'Conversas',
      icon: MessageSquare,
      active: pathname === '/conversations' || pathname === '/conversations/chat',
    },
    ...(isAdmin
      ? [
          {
            href: '/admin',
            label: 'Admin',
            icon: Settings,
            active: pathname === '/admin',
          },
        ]
      : []),
  ];

  return (
    <div className="flex h-screen flex-col md:flex-row">
      {/* Mobile top bar */}
      <div className="flex items-center justify-between border-b border-industrial-pale bg-white px-4 py-3 md:hidden">
        <IndustrialLogo size="sm" />
        <button
          onClick={() => setMobileOpen(!mobileOpen)}
          className="flex h-9 w-9 items-center justify-center rounded-lg text-industrial-dark transition hover:bg-industrial-surface"
        >
          {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {/* Mobile drawer overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 md:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-64 transform border-r border-industrial-pale bg-white shadow-industrial-lg transition-transform duration-200 md:static md:w-64 md:translate-x-0 md:shadow-none ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex h-full flex-col">
          {/* Logo */}
          <div className="flex items-center justify-between border-b border-industrial-pale p-5">
            <IndustrialLogo size="sm" />
            <button
              onClick={() => setMobileOpen(false)}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-industrial-medium transition hover:bg-industrial-surface md:hidden"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* User info */}
          <div className="border-b border-industrial-pale px-5 py-4">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-industrial-yellow font-bold text-industrial-black">
                {user?.nome?.charAt(0)?.toUpperCase() || 'A'}
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm font-bold text-industrial-black">
                  {user?.nome || 'Atendente'}
                </p>
                <p className="truncate text-[11px] font-medium uppercase tracking-wider text-industrial-medium">
                  {user?.role === 'admin' ? 'Administrador' : 'Atendente'}
                </p>
              </div>
            </div>
          </div>

          {/* Navigation */}
          <nav className="flex-1 space-y-1 p-3">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMobileOpen(false)}
                className={`flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-semibold transition-all duration-150 ${
                  item.active
                    ? 'bg-industrial-black text-white shadow-industrial'
                    : 'text-industrial-medium hover:bg-industrial-surface hover:text-industrial-dark'
                }`}
              >
                <item.icon className="h-4 w-4" />
                {item.label}
              </Link>
            ))}
          </nav>

          {/* Logout */}
          <div className="border-t border-industrial-pale p-3">
            <button
              onClick={() => {
                setMobileOpen(false);
                logout();
              }}
              className="flex w-full items-center gap-3 rounded-xl px-4 py-3 text-sm font-semibold text-industrial-red transition hover:bg-industrial-red-pale"
            >
              <LogOut className="h-4 w-4" />
              Sair
            </button>
          </div>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 overflow-hidden bg-industrial-surface">{children}</main>
    </div>
  );
}
