'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { LogOut, MessageSquare, Settings, Users } from 'lucide-react';

export default function ConversationsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, logout, isAdmin } = useAuth();
  const pathname = usePathname();

  return (
    <div className="flex h-screen flex-col md:flex-row">
      {/* Sidebar */}
      <aside className="flex-shrink-0 border-b border-gray-200 bg-white md:w-64 md:border-b-0 md:border-r">
        <div className="flex items-center justify-between p-4 md:block">
          <div className="text-lg font-bold text-blue-700">Ciclo Norte</div>
          <div className="mt-2 hidden text-xs text-gray-500 md:block">
            {user?.nome || 'Atendente'}
          </div>
        </div>

        <nav className="flex items-center gap-1 overflow-x-auto px-2 pb-2 md:block md:space-y-1 md:px-2 md:pb-0">
          <Link
            href="/conversations"
            className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition ${
              pathname === '/conversations'
                ? 'bg-blue-50 text-blue-700 font-medium'
                : 'text-gray-700 hover:bg-gray-100'
            }`}
          >
            <MessageSquare className="h-4 w-4" />
            <span className="hidden md:inline">Conversas</span>
          </Link>

          {isAdmin && (
            <Link
              href="/admin"
              className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition ${
                pathname === '/admin'
                  ? 'bg-blue-50 text-blue-700 font-medium'
                  : 'text-gray-700 hover:bg-gray-100'
              }`}
            >
              <Settings className="h-4 w-4" />
              <span className="hidden md:inline">Admin</span>
            </Link>
          )}

          <button
            onClick={logout}
            className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-red-600 transition hover:bg-red-50"
          >
            <LogOut className="h-4 w-4" />
            <span className="hidden md:inline">Sair</span>
          </button>
        </nav>
      </aside>

      {/* Main */}
      <main className="flex-1 overflow-hidden bg-gray-50">{children}</main>
    </div>
  );
}
