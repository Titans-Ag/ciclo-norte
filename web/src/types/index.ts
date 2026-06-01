export interface Loja {
  id: string;
  nome: string;
  tipo: 'vendas' | 'locacao' | 'manutencao';
  endereco?: string;
  telefone?: string;
  created_at: string;
}

export interface Atendente {
  id: string;
  nome: string;
  email: string;
  is_admin: boolean;
  created_at: string;
  lojas?: LojaAlocacao[];
}

export interface LojaAlocacao {
  loja_id: string;
  loja_nome?: string;
}

export type ConversationStatus = 'ia_ativa' | 'humano_assumiu' | 'transferida' | 'resolvida';
export type MessageType = 'texto' | 'imagem' | 'audio';
export type AuthorType = 'cliente' | 'ia' | 'humano';

export interface Conversation {
  id: string;
  cliente_nome: string;
  cliente_telefone: string;
  loja_id: string;
  loja_nome?: string;
  status: ConversationStatus;
  atendente_id?: string;
  atendente_nome?: string;
  ultima_mensagem?: string;
  ultima_mensagem_preview?: string;
  transferida: boolean;
  transferencia_origem_loja_id?: string;
  transferencia_destino_loja_id?: string;
  updated_at: string;
  unread_count?: number;
}

export interface Message {
  id: string;
  conversa_id: string;
  autor_tipo: AuthorType;
  autor_nome: string;
  autor_id?: string;
  conteudo: string;
  tipo_midia: MessageType;
  media_url?: string;
  transcricao?: string;
  descricao_imagem?: string;
  timestamp: string;
}

export interface AgenteConfig {
  id?: string;
  nome: string;
  prompt: string;
  modelo: string;
  temperatura: number;
  tools: string[];
  knowledge?: string;
  updated_at?: string;
}

export interface InstanciaWhatsApp {
  id: string;
  nome: string;
  numero: string;
  status: 'conectada' | 'desconectada' | 'conectando';
  qr_code?: string;
  updated_at: string;
}

export interface LoginResponse {
  token: string;
  user: Atendente;
}

export interface SSEEvent {
  type: 'conversation_update' | 'new_message' | 'typing' | 'status_change' | 'transfer';
  payload: unknown;
}
