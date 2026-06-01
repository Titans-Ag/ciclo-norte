export interface Loja {
  id: string;
  nome: string;
  slug: string;
  tipo: 'vendas' | 'locacao' | 'manutencao';
  endereco?: string;
  telefone?: string;
  created_at: string;
}

export interface Atendente {
  id: string;
  nome: string;
  email: string;
  role: 'admin' | 'atendente';
  created_at: string;
  lojas?: LojaAlocacao[];
}

export interface LojaAlocacao {
  loja_id: string;
  loja_nome?: string;
}

export type ConversationStatus = 'ia_ativa' | 'humano' | 'transferida' | 'resolvida';
export type MessageType = 'texto' | 'imagem' | 'audio';
export type AuthorType = 'cliente' | 'ia' | 'atendente';

export interface Conversation {
  id: string;
  cliente_nome?: string;
  cliente_telefone: string;
  loja_responsavel_id: string;
  loja_nome?: string;
  loja_slug?: string;
  status: ConversationStatus;
  atendente_id?: string;
  atendente_nome?: string;
  ultima_mensagem?: string;
  mensagem_count?: number;
  transferida: boolean;
  transferencia_origem_loja_id?: string;
  transferencia_destino_loja_id?: string;
  updated_at: string;
  iniciada_em: string;
  ultima_msg_em: string;
  unread_count?: number;
}

export interface Message {
  id: string;
  conversa_id: string;
  autor_tipo: AuthorType;
  autor_nome: string;
  autor_id?: string;
  conteudo?: string;
  tipo_midia: string;
  midia_url?: string;
  transcricao?: string;
  descricao_imagem?: string;
  enviada_em?: string;
  created_at: string;
}

export interface AgenteConfig {
  id?: string;
  nome: string;
  prompt_sistema: string;
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
  expires_at: string;
  user_id: string;
  email: string;
  nome: string;
  role: 'admin' | 'atendente';
}

export interface SSEEvent {
  type: 'conversation_update' | 'new_message' | 'typing' | 'status_change' | 'transfer';
  payload: unknown;
}
