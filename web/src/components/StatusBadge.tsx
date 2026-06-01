import { ConversationStatus } from '@/types';

const config: Record<ConversationStatus, { label: string; dot: string; bg: string; text: string }> = {
  ia_ativa: { label: 'IA', dot: 'bg-blue-500', bg: 'bg-blue-50', text: 'text-blue-700' },
  humano: { label: 'Humano', dot: 'bg-green-500', bg: 'bg-green-50', text: 'text-green-700' },
  transferida: { label: 'Transferida', dot: 'bg-yellow-500', bg: 'bg-yellow-50', text: 'text-yellow-700' },
  resolvida: { label: 'Resolvida', dot: 'bg-gray-400', bg: 'bg-gray-100', text: 'text-gray-600' },
};

export function StatusBadge({ status }: { status: ConversationStatus }) {
  const c = config[status] || config.ia_ativa;
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${c.bg} ${c.text}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${c.dot}`} />
      {c.label}
    </span>
  );
}
