import { Wrench } from 'lucide-react';

interface IndustrialLogoProps {
  size?: 'sm' | 'md' | 'lg';
  showText?: boolean;
}

const sizeConfig = {
  sm: { icon: 'h-6 w-6', text: 'text-lg', sub: 'text-[10px]' },
  md: { icon: 'h-10 w-10', text: 'text-2xl', sub: 'text-xs' },
  lg: { icon: 'h-16 w-16', text: 'text-4xl', sub: 'text-sm' },
};

export function IndustrialLogo({ size = 'md', showText = true }: IndustrialLogoProps) {
  const cfg = sizeConfig[size];
  return (
    <div className="flex items-center gap-3">
      <div className={`flex items-center justify-center rounded-xl bg-industrial-yellow p-2.5 shadow-industrial ${size === 'lg' ? 'p-4' : ''}`}>
        <Wrench className={`${cfg.icon} text-industrial-black`} strokeWidth={2.5} />
      </div>
      {showText && (
        <div>
          <h1 className={`font-black tracking-tight text-industrial-black ${cfg.text}`}>
            Ciclo Norte
          </h1>
          <p className={`font-medium uppercase tracking-widest text-industrial-medium ${cfg.sub}`}>
            Atendimento Inteligente
          </p>
        </div>
      )}
    </div>
  );
}
