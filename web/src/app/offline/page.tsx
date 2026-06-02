'use client';

import { Wrench, WifiOff } from 'lucide-react';
import { IndustrialButton } from '@/components/IndustrialButton';

export default function OfflinePage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-industrial-surface px-6">
      <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-2xl bg-industrial-yellow shadow-industrial-md">
        <Wrench className="h-10 w-10 text-industrial-black" />
      </div>

      <div className="mb-2 flex items-center gap-2">
        <WifiOff className="h-5 w-5 text-industrial-red" />
        <h1 className="text-2xl font-black text-industrial-black">
          Sem conexão
        </h1>
      </div>

      <p className="mb-8 max-w-sm text-center text-sm text-industrial-medium">
        Você está offline. Verifique sua conexão com a internet e tente
        novamente.
      </p>

      <IndustrialButton
        variant="dark"
        size="md"
        onClick={() => window.location.reload()}
      >
        Tentar novamente
      </IndustrialButton>
    </div>
  );
}
