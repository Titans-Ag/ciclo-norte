import Link from 'next/link';
import { IndustrialLogo } from '@/components/IndustrialLogo';
import { IndustrialButton } from '@/components/IndustrialButton';
import { ArrowRight } from 'lucide-react';

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-industrial-black px-6">
      <div className="mb-8 flex h-24 w-24 items-center justify-center rounded-2xl bg-industrial-yellow shadow-industrial-lg">
        <IndustrialLogo size="lg" showText={false} />
      </div>

      <h1 className="text-center text-4xl font-black tracking-tight text-white md:text-5xl">
        Ciclo Norte
      </h1>
      <p className="mt-2 text-center text-base font-medium text-industrial-light">
        Plataforma de Atendimento Inteligente
      </p>

      <div className="mt-8 flex flex-col gap-3 sm:flex-row">
        <Link href="/login">
          <IndustrialButton variant="primary" size="lg" rightIcon={<ArrowRight className="h-4 w-4" />}>
            Acessar o Painel
          </IndustrialButton>
        </Link>
      </div>

      <p className="mt-8 text-xs text-industrial-gray">
        © {new Date().getFullYear()} Ciclo Norte. Todos os direitos reservados.
      </p>
    </div>
  );
}
