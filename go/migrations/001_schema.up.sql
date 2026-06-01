-- Ciclo Norte — Schema MVP
-- Criado em 2026-06-01

-- Extensões
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. loja
CREATE TABLE IF NOT EXISTS loja (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    slug TEXT NOT NULL UNIQUE,
    nome TEXT NOT NULL,
    descricao TEXT,
    tipo TEXT,
    endereco TEXT,
    telefone TEXT,
    ativo BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. instancia_whatsapp
CREATE TABLE IF NOT EXISTS instancia_whatsapp (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    loja_id UUID REFERENCES loja(id) NOT NULL,
    nome TEXT NOT NULL UNIQUE,
    evolution_instance_name TEXT NOT NULL UNIQUE,
    numero_telefone TEXT NOT NULL,
    evolution_base_url TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'connecting',
    ativo BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. atendente
CREATE TABLE IF NOT EXISTS atendente (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email TEXT NOT NULL UNIQUE,
    nome TEXT NOT NULL,
    senha_hash TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'atendente',
    ativo BOOLEAN NOT NULL DEFAULT true,
    ultimo_acesso TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 4. atendente_loja
CREATE TABLE IF NOT EXISTS atendente_loja (
    atendente_id UUID REFERENCES atendente(id) ON DELETE CASCADE,
    loja_id UUID REFERENCES loja(id) ON DELETE CASCADE,
    alocado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
    alocado_por UUID REFERENCES atendente(id),
    PRIMARY KEY (atendente_id, loja_id)
);

-- 5. agente
CREATE TABLE IF NOT EXISTS agente (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    loja_id UUID REFERENCES loja(id) NOT NULL,
    slug TEXT NOT NULL,
    nome TEXT NOT NULL,
    descricao TEXT,
    tipo TEXT NOT NULL DEFAULT 'principal',
    prompt_sistema TEXT NOT NULL,
    modelo TEXT NOT NULL DEFAULT 'gpt-4o-mini',
    temperatura FLOAT NOT NULL DEFAULT 0.7,
    max_tokens INT NOT NULL DEFAULT 1500,
    multimodal BOOLEAN NOT NULL DEFAULT true,
    ativo BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(loja_id, slug)
);

-- 6. agente_tool
CREATE TABLE IF NOT EXISTS agente_tool (
    agente_id UUID REFERENCES agente(id) ON DELETE CASCADE,
    tool_slug TEXT NOT NULL,
    tool_config JSONB NOT NULL DEFAULT '{}',
    habilitado BOOLEAN NOT NULL DEFAULT true,
    PRIMARY KEY (agente_id, tool_slug)
);

-- 7. conversa
CREATE TABLE IF NOT EXISTS conversa (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    instancia_whatsapp_id UUID REFERENCES instancia_whatsapp(id) NOT NULL,
    loja_responsavel_id UUID REFERENCES loja(id) NOT NULL,
    cliente_telefone TEXT NOT NULL,
    cliente_nome TEXT,
    status TEXT NOT NULL DEFAULT 'ia_ativa',
    agente_principal_id UUID REFERENCES agente(id),
    atendente_id UUID REFERENCES atendente(id),
    iniciada_em TIMESTAMPTZ NOT NULL DEFAULT now(),
    ultima_msg_em TIMESTAMPTZ NOT NULL DEFAULT now(),
    transferida_em TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(instancia_whatsapp_id, cliente_telefone)
);

-- 8. mensagem
CREATE TABLE IF NOT EXISTS mensagem (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    conversa_id UUID REFERENCES conversa(id) ON DELETE CASCADE NOT NULL,
    autor_tipo TEXT NOT NULL,
    autor_id UUID,
    autor_nome TEXT NOT NULL,
    conteudo TEXT,
    midia_url TEXT,
    midia_tipo TEXT NOT NULL DEFAULT 'text',
    transcricao TEXT,
    descricao_imagem TEXT,
    whatsapp_msg_id TEXT UNIQUE,
    metadata JSONB NOT NULL DEFAULT '{}',
    enviada_em TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 9. transferencia
CREATE TABLE IF NOT EXISTS transferencia (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    conversa_id UUID REFERENCES conversa(id) NOT NULL,
    tipo TEXT NOT NULL,
    loja_origem_id UUID REFERENCES loja(id) NOT NULL,
    loja_destino_id UUID REFERENCES loja(id) NOT NULL,
    atendente_id UUID REFERENCES atendente(id),
    agente_id UUID REFERENCES agente(id),
    motivo TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 10. evento_agente
CREATE TABLE IF NOT EXISTS evento_agente (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    conversa_id UUID REFERENCES conversa(id) NOT NULL,
    agente_id UUID REFERENCES agente(id) NOT NULL,
    tipo TEXT NOT NULL,
    payload JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 11. produtos (catálogo fictício)
CREATE TABLE IF NOT EXISTS produtos (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    sku TEXT NOT NULL UNIQUE,
    nome TEXT NOT NULL,
    descricao TEXT,
    categoria TEXT NOT NULL,
    preco_venda NUMERIC(12,2),
    preco_locacao_dia NUMERIC(12,2),
    ativo BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 12. estoque
CREATE TABLE IF NOT EXISTS estoque (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    produto_id UUID REFERENCES produtos(id) NOT NULL,
    quantidade INT NOT NULL DEFAULT 0,
    local TEXT,
    prazo_reposicao_dias INT,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(produto_id)
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_conversa_loja_status ON conversa(loja_responsavel_id, status, ultima_msg_em DESC);
CREATE INDEX IF NOT EXISTS idx_conversa_instancia ON conversa(instancia_whatsapp_id, cliente_telefone);
CREATE INDEX IF NOT EXISTS idx_mensagem_conversa ON mensagem(conversa_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_transferencia_conversa ON transferencia(conversa_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_evento_conversa ON evento_agente(conversa_id, created_at DESC);
