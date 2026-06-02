import { ConversationStatus } from '@/types';
import {
  Bot,
  UserCheck,
  ArrowLeftRight,
  CheckCircle2,
  Loader2,
} from 'lucide-react';

const STATUS_CONFIG: Record<
  ConversationStatus,
  {
    label: string;
    icon: React.ReactNode;
    classes: string;
  }
> = {
  ia_ativa: {
    label: 'IA Ativa',
    icon: <Bot className="h-3 w-3" />,
    classes:
      'bg-industrial-yellow-pale text-industrial-yellow-dark border-industrial-yellow/30',
  },
  humano: {
    label: 'Humano',
    icon: <UserCheck className="h-3 w-3" />,
    classes:
      'bg-industrial-blue-pale text-industrial-blue border-industrial-blue/20',
  },
  transferida: {
    label: 'Transferida',
    icon: <ArrowLeftRight className="h-3 w-3" />,
    classes:
      'bg-industrial-orange-pale text-industrial-orange border-industrial-orange/20',
  },
  resolvida: {
    label: 'Resolvida',
    icon: <CheckCircle2 className="h-3 w-3" />,
    classes:
      'bg-industrial-green-pale text-industrial-green border-industrial-green/20',
  },
};

interface StatusBadgeProps {
  status: ConversationStatus;
  loading?: boolean;
  size?: 'sm' | 'md';
}

export function StatusBadge({ status, loading, size = 'sm' }: StatusBadgeProps) {
  const config = STATUS_CONFIG[status] || STATUS_CONFIG.ia_ativa;
  const sizeClasses =
    size === 'md'
      ? 'px-2.5 py-1 text-xs gap-1.5'
      : 'px-2 py-0.5 text-[11px] gap-1';

  return (
    <span
      className={`inline-flex items-center rounded-md border font-semibold uppercase tracking-wide ${config.classes} ${sizeClasses}`}
    >
      {loading ? (
        <Loader2 className="h-3 w-3 animate-spin" />
      ) : (
        config.icon
      )}
      {config.label}
    </span>
  );
}
