'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { IndustrialLogo } from '@/components/IndustrialLogo';
import { IndustrialButton } from '@/components/IndustrialButton';
import { Loader2, Mail, Lock, AlertTriangle } from 'lucide-react';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    const ok = await login(email, password);
    setLoading(false);
    if (ok) {
      router.push('/conversations');
    } else {
      setError('Email ou senha incorretos. Verifique e tente novamente.');
    }
  };

  return (
    <div className="flex min-h-screen">
      {/* Left panel - Hero */}
      <div className="hidden flex-col justify-between bg-industrial-black p-12 lg:flex lg:w-1/2 xl:w-5/12">
        <div>
          <IndustrialLogo size="md" />
        </div>

        <div className="space-y-6">
          <div className="relative">
            <div className="absolute -left-4 -top-4 h-20 w-20 rounded-full bg-industrial-yellow/10"></div>
            <div className="absolute -bottom-6 -right-6 h-32 w-32 rounded-full bg-industrial-yellow/5"></div>
            <h2 className="relative text-4xl font-black leading-tight tracking-tight text-white">
              Atendimento
              <br />
              <span className="text-industrial-yellow">Inteligente</span>
            </h2>
          </div>

          <p className="max-w-sm text-base leading-relaxed text-industrial-light">
            Gerencie conversas do WhatsApp com IA e atendentes humanos em
            uma plataforma robusta, rápida e feita para escalar seu negócio.
          </p>

          <div className="flex items-center gap-6 pt-4">
            <div className="text-center">
              <div className="text-2xl font-black text-industrial-yellow">24/7</div>
              <div className="text-xs font-medium uppercase tracking-wider text-industrial-medium">IA Ativa</div>
            </div>
            <div className="h-10 w-px bg-industrial-gray"></div>
            <div className="text-center">
              <div className="text-2xl font-black text-industrial-yellow">3</div>
              <div className="text-xs font-medium uppercase tracking-wider text-industrial-medium">Lojas</div>
            </div>
            <div className="h-10 w-px bg-industrial-gray"></div>
            <div className="text-center">
              <div className="text-2xl font-black text-industrial-yellow">∞</div>
              <div className="text-xs font-medium uppercase tracking-wider text-industrial-medium">Conversas</div>
            </div>
          </div>
        </div>

        <div className="text-xs text-industrial-gray">
          © {new Date().getFullYear()} Ciclo Norte. Todos os direitos reservados.
        </div>
      </div>

      {/* Right panel - Form */}
      <div className="flex flex-1 items-center justify-center bg-industrial-surface p-6">
        <div className="w-full max-w-sm">
          {/* Mobile logo */}
          <div className="mb-10 flex justify-center lg:hidden">
            <IndustrialLogo size="md" />
          </div>

          <div className="mb-8">
            <h2 className="text-2xl font-bold text-industrial-black">
              Bem-vindo de volta
            </h2>
            <p className="mt-1 text-sm text-industrial-medium">
              Entre com suas credenciais para acessar o painel.
            </p>
          </div>

          {error && (
            <div className="mb-6 flex items-start gap-2.5 rounded-xl border border-industrial-red/20 bg-industrial-red-pale p-4">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-industrial-red" />
              <span className="text-sm font-medium text-industrial-red">{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label htmlFor="email" className="mb-1.5 block text-sm font-semibold text-industrial-dark">
                Email
              </label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-industrial-light" />
                <input
                  id="email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full rounded-xl border border-industrial-pale bg-white py-3 pl-11 pr-4 text-sm text-industrial-black shadow-industrial outline-none transition placeholder:text-industrial-light focus:border-industrial-yellow focus:ring-2 focus:ring-industrial-yellow/20"
                  placeholder="seu@email.com"
                />
              </div>
            </div>

            <div>
              <label htmlFor="password" className="mb-1.5 block text-sm font-semibold text-industrial-dark">
                Senha
              </label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-industrial-light" />
                <input
                  id="password"
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full rounded-xl border border-industrial-pale bg-white py-3 pl-11 pr-4 text-sm text-industrial-black shadow-industrial outline-none transition placeholder:text-industrial-light focus:border-industrial-yellow focus:ring-2 focus:ring-industrial-yellow/20"
                  placeholder="••••••••"
                />
              </div>
            </div>

            <IndustrialButton
              type="submit"
              variant="dark"
              size="lg"
              fullWidth
              loading={loading}
              leftIcon={loading ? undefined : undefined}
            >
              {loading ? 'Entrando...' : 'Entrar'}
            </IndustrialButton>
          </form>

          <p className="mt-6 text-center text-xs text-industrial-medium">
            Problemas para acessar?{' '}
            <span className="font-semibold text-industrial-dark hover:underline cursor-pointer">
              Fale com o administrador
            </span>
          </p>
        </div>
      </div>
    </div>
  );
}
