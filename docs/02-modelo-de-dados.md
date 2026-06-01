# 02 — Modelo de Dados

> **Status:** Especificação consolidada pós-revisão estratégica.
> Schema relacional completo com desacoplamento canal/responsabilidade.

## Visão geral

6 entidades principais + tabelas de amarração:

```
                         +-- instancia_whatsapp (canal físico, imutável)
                         |
atendente ──(alocação)── loja ──(1:N)── agente ──(1:N)── agente_tool
                         │
                         ├──(1:N)── conversa ──(1:N)── mensagem
                         │              │
                         │              +--(1:N)── evento_agente
                         │              +--(1:N)── transferencia
                         │
                         +--(1:N)── atendente_loja (N:M)
```

**Regra de ouro:** `conversa.instancia_whatsapp_id` (imutável) ≠
`conversa.loja_responsavel_id` (mutável). O canal físico nunca muda;
o dono comercial pode mudar.

---

## Entidades

### 1. `loja`

Unidade de negócio. Cada divisão do Ciclo Norte é uma loja.

| Campo | Tipo | Constraints | Notas |
|---|---|---|---|
| `id` | uuid | PK | |
| `slug` | text | UNIQUE, NOT NULL | `vendas`, `locacao`, `manutencao` |
| `nome` | text | NOT NULL | "Vendas", "Locação de Ferramentas" |
| `descricao` | text | | Breve descrição interna |
| `ativo` | bool | NOT NULL, DEFAULT true | Desliga sem deletar |
| `created_at` | timestamptz | NOT NULL, DEFAULT now() | |
| `updated_at` | timestamptz | NOT NULL, DEFAULT now() | |

**MVP:** 2 lojas (`vendas`, `locacao`). Manutenção entra na Fase 2.

**Configurações por loja** (Fase 2, não MVP):
- Horário de atendimento.
- Tom de voz da IA (formal/descontraído).
- Frase de fallback quando não sabe responder.

### 2. `instancia_whatsapp`

Canal físico de entrada. Cada instância Evolution API é um canal
imutável. Uma loja pode ter N instâncias no futuro; hoje é 1:1.

| Campo | Tipo | Constraints | Notas |
|---|---|---|---|
| `id` | uuid | PK | |
| `loja_id` | uuid | FK → loja(id), NOT NULL | Dono inicial da instância |
| `nome` | text | NOT NULL, UNIQUE | `ciclo-norte-vendas` |
| `evolution_instance_name` | text | NOT NULL, UNIQUE | Nome no Evolution |
| `numero_telefone` | text | NOT NULL | E.164, ex: `+5511999999999` |
| `evolution_base_url` | text | NOT NULL | URL do Evolution (compartilhada entre instâncias) |
| `status` | enum | NOT NULL, DEFAULT 'connecting' | `connecting`, `connected`, `disconnected`, `destroyed` |
| `ativo` | bool | NOT NULL, DEFAULT true | |
| `created_at` | timestamptz | NOT NULL | |
| `updated_at` | timestamptz | NOT NULL | |

> **Por que separado de `loja`?**> No futuro uma loja pode ter múltiplos números (ex: vendas tem
> um número pra SP e outro pra RJ). O schema já acomoda N:1.

### 3. `atendente`

Usuário do sistema. Escopo global. Alocável em N lojas.

| Campo | Tipo | Constraints | Notas |
|---|---|---|---|
| `id` | uuid | PK | |
| `email` | text | UNIQUE, NOT NULL | Login |
| `nome` | text | NOT NULL | Label nas mensagens |
| `senha_hash` | text | NOT NULL | bcrypt (custo 12+) |
| `role` | enum | NOT NULL, DEFAULT 'atendente' | `admin` \| `atendente` |
| `ativo` | bool | NOT NULL, DEFAULT true | |
| `ultimo_acesso` | timestamptz | | Denormalizado pra UI |
| `created_at` | timestamptz | NOT NULL | |
| `updated_at` | timestamptz | NOT NULL | |

**Auth:** bcrypt + JWT. Não há Kratos no MVP. JWT expira em 24h,
refresh token em 7 dias.

**MFA:** Não no MVP. Fase 2 se necessário.

**Mudança de nome:** Admin pode editar. Mensagens antigas
preservam o nome do momento do envio (denormalizado em
`mensagem.autor_nome` para não retroceder histórico).

### 4. `atendente_loja` (alocação N:M)

| Campo | Tipo | Constraints | Notas |
|---|---|---|---|
| `atendente_id` | uuid | FK → atendente(id) | |
| `loja_id` | uuid | FK → loja(id) | |
| `alocado_em` | timestamptz | NOT NULL, DEFAULT now() | |
| `alocado_por` | uuid | FK → atendente(id) | Quem fez a alocação |
| PRIMARY KEY | | (atendente_id, loja_id) | |

**Alocação é manual** (admin clica e move). Sem data_fim no MVP.

### 5. `agente`

Configuração de um agente de IA. Pertence a 1 loja.

| Campo | Tipo | Constraints | Notas |
|---|---|---|---|
| `id` | uuid | PK | |
| `loja_id` | uuid | FK → loja(id), NOT NULL | |
| `slug` | text | NOT NULL, UNIQUE por loja | `principal`, `consulta-preco` |
| `nome` | text | NOT NULL | Label exibido. Ex: "Assistente Vendas" |
| `descricao` | text | | Só admin vê |
| `tipo` | enum | NOT NULL | `principal` \| `apoio` |
| `prompt_sistema` | text | NOT NULL | Instruções ao LLM |
| `modelo` | text | NOT NULL, DEFAULT 'gpt-4o-mini' | Via `MOD-ai-gateway` |
| `temperatura` | float | NOT NULL, DEFAULT 0.7 | 0.0–2.0 |
| `max_tokens` | int | NOT NULL, DEFAULT 1500 | |
| `multimodal` | bool | NOT NULL, DEFAULT true | Suporta áudio/imagem |
| `ativo` | bool | NOT NULL, DEFAULT true | |
| `created_at` | timestamptz | NOT NULL | |
| `updated_at` | timestamptz | NOT NULL | |

**Principal:** gerencia diálogo, multimodalidade, naturalidade.
**Apoio:** fornece dados estruturados via tool-calls. Não fala
com cliente.

### 6. `agente_tool` (registro de tools disponíveis por agente)

| Campo | Tipo | Constraints | Notas |
|---|---|---|---|
| `agente_id` | uuid | FK → agente(id) | |
| `tool_slug` | text | NOT NULL | Ex: `consultar_preco`, `transferir_setor` |
| `tool_config` | jsonb | NOT NULL, DEFAULT '{}' | Config específica |
| `habilitado` | bool | NOT NULL, DEFAULT true | |
| PRIMARY KEY | | (agente_id, tool_slug) | |

**Tools disponíveis no MVP:**

| Tool | Descrição | Implementação |
|---|---|---|
| `consultar_preco` | Busca preço de produto no catálogo | Função Go + query SQL |
| `consultar_estoque` | Verifica disponibilidade | Função Go + query SQL |
| `transferir_setor` | Transfere conversa para outra loja | Função Go + UPDATE `conversa` |

**Criação de tool nova:** Não no MVP. Lista é fixa no código.
Cliente habilita/desabilita por agente.

### 7. `conversa`

Thread de mensagens. **Entidade mais importante do sistema.**

| Campo | Tipo | Constraints | Notas |
|---|---|---|---|
| `id` | uuid | PK | |
| `instancia_whatsapp_id` | uuid | FK → instancia_whatsapp(id), NOT NULL, IMMUTABLE | Canal físico. Nunca muda. |
| `loja_responsavel_id` | uuid | FK → loja(id), NOT NULL | Dono comercial. **Mutável.** |
| `cliente_telefone` | text | NOT NULL | E.164 |
| `cliente_nome` | text | | Pode ser null até identificar |
| `status` | enum | NOT NULL, DEFAULT 'ia_ativa' | Ver tabela abaixo |
| `agente_principal_id` | uuid | FK → agente(id) | Qual agente principal responde |
| `atendente_id` | uuid | FK → atendente(id), nullable | Quem assumiu (se humano) |
| `iniciada_em` | timestamptz | NOT NULL, DEFAULT now() | |
| `ultima_msg_em` | timestamptz | NOT NULL, DEFAULT now() | Denormalizado pra ordenação |
| `transferida_em` | timestamptz | nullable | Quando foi transferida pela última vez |
| `created_at` | timestamptz | NOT NULL | |
| `updated_at` | timestamptz | NOT NULL | |

**UNIQUE (instancia_whatsapp_id, cliente_telefone)** — uma
conversa por cliente por instância. Cliente que mandou na loja
Vendas e na Loja Locação = 2 conversas distintas (cada uma com
sua própria `instancia_whatsapp_id`).

**Status:**

| Status | Significado | Quem pode intervir |
|---|---|---|
| `ia_ativa` | IA respondendo. Nenhum humano assumiu. | Atendente clica "Assumir". |
| `humano_assumiu` | Atendente humano em controle. IA pausada. | Atendente clica "Devolver". |
| `transferida` | Aguardando atendente da loja destino. | Atendente da loja destino assume. |
| `resolvida` | Conversa encerrada. | Atendente pode reabrir. |
| `arquivada` | Escondida da lista principal. | Admin pode desarquivar. |

### 8. `mensagem`

| Campo | Tipo | Constraints | Notas |
|---|---|---|---|
| `id` | uuid | PK | |
| `conversa_id` | uuid | FK → conversa(id), NOT NULL | |
| `autor_tipo` | enum | NOT NULL | `cliente` \| `ia` \| `humano` \| `sistema` |
| `autor_id` | uuid | nullable | FK condicional (atendente ou agente) |
| `autor_nome` | text | NOT NULL | Denormalizado (preserva histórico se nome mudar) |
| `conteudo` | text | | Texto da mensagem |
| `midia_url` | text | | URL temporária da mídia |
| `midia_tipo` | enum | DEFAULT 'text' | `text` \| `image` \| `audio` \| `document` \| `video` |
| `transcricao` | text | | Transcrição STT (se áudio) |
| `descricao_imagem` | text | | Descrição gerada pela IA (se imagem) |
| `whatsapp_msg_id` | text | UNIQUE, nullable | ID único no WhatsApp (dedupe + status) |
| `metadata` | jsonb | NOT NULL, DEFAULT '{}' | tool_calls, tokens usados, etc. |
| `enviada_em` | timestamptz | | Quando WhatsApp entregou |
| `created_at` | timestamptz | NOT NULL | |

**autor_tipo = sistema:** mensagens automáticas ("Conversa
transferida para Locação") ou logs de evento.

**Mídia no MVP:**
- Recebe: texto ✅, imagem ✅ (com descrição gerada pela IA),
  áudio ✅ (com transcrição STT), documento ✅ (salva URL).
- Envia: texto ✅. Imagem/áudio/documento ❌ (humano e IA).

### 9. `transferencia` (audit trail de roteamento)

Log de toda transferência de conversa (automática ou manual).

| Campo | Tipo | Constraints | Notas |
|---|---|---|---|
| `id` | uuid | PK | |
| `conversa_id` | uuid | FK → conversa(id), NOT NULL | |
| `tipo` | enum | NOT NULL | `automatica` (IA) \| `manual` (humano) |
| `loja_origem_id` | uuid | FK → loja(id), NOT NULL | |
| `loja_destino_id` | uuid | FK → loja(id), NOT NULL | |
| `atendente_id` | uuid | FK → atendente(id), nullable | Quem transferiu (se manual) |
| `agente_id` | uuid | FK → agente(id), nullable | Qual agente engatilhou (se automática) |
| `motivo` | text | | "Cliente perguntou sobre locação" |
| `created_at` | timestamptz | NOT NULL | |

**Por que existe:** auditoria completa de roteamento. Admin vê
histórico de transferências por conversa.

### 10. `evento_agente` (audit log de execução da IA)

| Campo | Tipo | Constraints | Notas |
|---|---|---|---|
| `id` | uuid | PK | |
| `conversa_id` | uuid | FK → conversa(id), NOT NULL | |
| `agente_id` | uuid | FK → agente(id), NOT NULL | |
| `tipo` | enum | NOT NULL | `tool_call` \| `tool_result` \| `decisao` \| `erro` \| `transferencia` |
| `payload` | jsonb | NOT NULL | Conteúdo específico |
| `created_at` | timestamptz | NOT NULL | |

**Exemplo payload (`tool_call`):**
```json
{"tool": "consultar_preco", "args": {"produto": "furadeira"}, "latency_ms": 45}
```

**Exemplo payload (`transferencia`):**
```json
{"loja_destino": "locacao", "motivo": "intencao_identificada", "confianca": 0.94}
```

## Diagrama relacional completo

```
loja
├── 1:N instancia_whatsapp
├── 1:N agente
│   └── 1:N agente_tool
├── 1:N conversa
│   ├── 1:N mensagem
│   ├── 1:N evento_agente
│   └── 1:N transferencia
└── N:M atendente (via atendente_loja)

instancia_whatsapp
└── 1:N conversa (imutável)

atendente
├── N:M loja (via atendente_loja)
└── 1:N conversa (quando assume)
```

## Índices recomendados

```sql
-- Conversas por loja (query principal do painel)
CREATE INDEX idx_conversa_loja_status ON conversa(loja_responsavel_id, status, ultima_msg_em DESC);

-- Conversas por instância (webhook)
CREATE INDEX idx_conversa_instancia ON conversa(instancia_whatsapp_id, cliente_telefone);

-- Mensagens por conversa
CREATE INDEX idx_mensagem_conversa ON mensagem(conversa_id, created_at DESC);

-- Transferências por conversa
CREATE INDEX idx_transferencia_conversa ON transferencia(conversa_id, created_at DESC);

-- Eventos por conversa
CREATE INDEX idx_evento_conversa ON evento_agente(conversa_id, created_at DESC);

-- WhatsApp dedupe
CREATE UNIQUE INDEX idx_mensagem_whatsapp ON mensagem(whatsapp_msg_id) WHERE whatsapp_msg_id IS NOT NULL;
```

## Próximas seções

- `03-roles-e-multi-loja.md` — quem vê o quê, transferência manual.
- `04-agentes-de-ia.md` — runtime multi-agente, multimodalidade.
