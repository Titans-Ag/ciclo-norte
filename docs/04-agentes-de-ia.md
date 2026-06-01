# 04 — Agentes de IA

> **Status:** Especificação consolidada pós-revisão estratégica.
> Multi-agente com multimodalidade. Tool `transferir_setor`.

## Conceito

Cada loja tem um **time de agentes de IA**:

- **1 Agente PRINCIPAL** — gerencia o diálogo, foca na máxima
  naturalidade da experiência. É multimodal desde o MVP (texto,
  áudio transcrito, imagem analisada). Fala com o cliente final.
- **N Agentes DE APOIO** — provedores de dados estruturados
  (backoffice). Não falam com o cliente. São invocados via
  tool-calls pelo Principal para fornecer dados (preços,
  estoque, catálogo).

## O que é "time de agentes" na prática

### Cenário 1: Cliente pergunta preço

1. Cliente (WhatsApp): "Quanto custa uma furadeira Bosch?"
2. Principal recebe mensagem de texto.
3. Principal decide: "preciso de preço" → tool-call:
   `consultar_preco({"produto": "furadeira Bosch"})`.
4. Backend invoca função Go que consulta tabela `produtos`.
5. Retorna: `{"preco": "R$ 450,00", "disponibilidade": "em_estoque"}`.
6. Principal recebe resultado e monta resposta natural:
   "A furadeira Bosch Professional custa R$ 450,00 e está
   disponível para retirada imediata!"
7. Cliente vê apenas a resposta do Principal.

### Cenário 2: Cliente manda áudio

1. Cliente (WhatsApp): 🎵 "Oi, eu queria saber se vocês têm
   andaime pra locação..." [áudio 8s]
2. Backend recebe áudio do Evolution.
3. `MOD-ai-gateway` transcreve via STT (Whisper API).
4. Transcrição vai pro Principal: "Oi, eu queria saber se vocês
   têm andaime pra locação..."
5. Principal processa como texto → tool-call `consultar_estoque`
   → responde.

### Cenário 3: Cliente manda foto

1. Cliente (WhatsApp): 📷 [foto de uma ferramenta quebrada]
2. Backend recebe imagem.
3. `MOD-ai-gateway` descreve via Vision API (gpt-4o mini vision).
4. Descrição vai pro Principal: "Foto de uma esmerilhadeira
   angular Bosch, aparentemente com disco danificado..."
5. Principal processa → responde: "Pelo que vejo na foto, o
   disco da sua esmerilhadeira está bastante desgastado..."

### Cenário 4: Transferência automática (tool `transferir_setor`)

1. Cliente (WhatsApp Vendas): "Oi, eu queria alugar uma
   betoneira por 3 dias."
2. Principal de Vendas processa.
3. Principal identifica intenção = **locação** (não compra).
4. Principal faz tool-call: `transferir_setor({"setor": "locacao", "motivo": "cliente quer alugar, não comprar"})`.
5. Backend:
   - UPDATE `conversa` SET `loja_responsavel_id` = 'locacao'.
   - INSERT em `transferencia` (tipo: `automatica`).
   - Emite SSE para atendentes de Locação.
6. Principal de Vendas envia mensagem de transição ao cliente:
   "Vou te passar para o nosso setor de locação, que vai te
   atender melhor sobre a betoneira!"
7. Backend direciona próximas mensagens para Principal de Locação.
8. Cliente continua no mesmo número de WhatsApp.

## Configuração por agente

### Agente Principal

| Campo | Edição | Exemplo |
|---|---|---|
| **Nome** | Admin | "Assistente Vendas" |
| **Descrição** | Admin | "Responde perguntas gerais e gerencia transferências" |
| **Tipo** | Fixo | `principal` |
| **Prompt do sistema** | Admin | Prompt completo com instruções de tom, transferência, etc. |
| **Modelo** | Admin | `gpt-4o-mini` (default) |
| **Temperatura** | Admin | 0.7 (mais natural) |
| **Max tokens** | Admin | 1500 |
| **Multimodal** | Fixo | `true` (sempre ativo no Principal) |

### Agente de Apoio

| Campo | Edição | Exemplo |
|---|---|---|
| **Nome** | Admin | "Consulta Preços e Estoque" |
| **Descrição** | Admin | "Fornece dados estruturados de preços e disponibilidade" |
| **Tipo** | Fixo | `apoio` |
| **Prompt do sistema** | Admin | "Você recebe nome de produto e retorna JSON com preço e estoque..." |
| **Modelo** | Admin | `gpt-4o-mini` |
| **Temperatura** | Admin | 0.0 (factual, determinístico) |
| **Max tokens** | Admin | 500 |
| **Multimodal** | Fixo | `false` (não recebe mídia) |

### Tela de "fluxo" (visualização)

Tela que exibe a relação entre agentes:

```
        ┌─────────────────────────┐
        │  🤖 Assistente Vendas   │  ← Principal
        │     (Principal)         │
        └───────────┬─────────────┘
                    │
        ┌───────────┴───────────┐
        │                       │
   ┌────▼────┐            ┌─────▼─────┐
   │ 💰 Preços│            │ 📦 Estoque │  ← Apoio
   │  (Apoio)│            │  (Apoio)   │
   └─────────┘            └────────────┘
```

- **Nó central** (maior): Principal.
- **Nós satélite** (menores): Apoio.
- **Setas:** indicam quais tools o Principal pode chamar.
- **Clicou no nó** → abre formulário de configuração do agente.
- **Não é editor.** Não arrasta, não conecta, não cria nós.
  As setas são derivadas das tools habilitadas no Principal.

## Tools disponíveis no MVP

### `consultar_preco`

**Input:** `{"produto": "string"}`
**Output:** `{"preco": "R$ X,00", "disponibilidade": "em_estoque|esgotado|sob_encomenda"}`
**Implementação:** Função Go que faz SELECT em tabela `produtos`.

### `consultar_estoque`

**Input:** `{"produto": "string"}`
**Output:** `{"quantidade": 42, "local": "Depósito Central", "prazo_reposicao": "3 dias"}`
**Implementação:** Função Go que consulta tabela `estoque`.

### `transferir_setor`

**Input:** `{"setor": "vendas|locacao|manutencao", "motivo": "string"}`
**Output:** `{"sucesso": true, "mensagem": "Transferido para Locação"}`
**Implementação:** Função Go que:
1. Valida se setor existe.
2. UPDATE `conversa.loja_responsavel_id`.
3. INSERT em `transferencia`.
4. Emite SSE.
5. Retorna confirmação para o Principal.

**Schema JSON das tools (OpenAI function-calling):**

```json
{
  "type": "function",
  "function": {
    "name": "consultar_preco",
    "description": "Consulta preço de um produto no catálogo",
    "parameters": {
      "type": "object",
      "properties": {
        "produto": {"type": "string", "description": "Nome do produto"}
      },
      "required": ["produto"]
    }
  }
}
```

## Runtime (como roda)

### Quando mensagem chega

1. Webhook do Evolution → backend Go.
2. Identifica instância → `instancia_whatsapp_id`.
3. Recupera conversa (usando `instancia_whatsapp_id` + telefone).
4. Obtém `loja_responsavel_id`.
5. Recupera **agente principal** da loja responsável.
6. Monta contexto para LLM:
   - Prompt do sistema do Principal.
   - Histórico da conversa (últimas 20 mensagens).
   - Tools habilitadas (com schemas JSON).
   - Se mídia: descrição/transcrição inclusa no contexto.
7. Chama `MOD-ai-gateway` → OpenAI.
8. LLM retorna:
   - `content` → resposta direta → envia pro cliente.
   - `tool_calls` → invoca tool → pega resultado → chama LLM
     de novo com resultado (ciclo tool → text).
9. Quando LLM retorna `content` final:
   - Salva mensagem `autor_tipo = 'ia'`, `autor_id = principal.id`.
   - Emite SSE para atendentes da loja responsável.

### Ciclo tool → text

```
Principal decide → tool_call (ex: consultar_preco)
         |
         v
Sistema executa função Go (não LLM)
         |
         v
Função retorna dados estruturados (JSON)
         |
         v
Principal recebe resultado → decide de novo
         |
         v
(content) → envia pro cliente
```

> **Agente de apoio é função Go, não outro LLM.** Isso é
> mais rápido, mais barato e determinístico para consultas
> de dados estruturados.

### Multimodalidade no runtime

**Texto:** Vai direto pro LLM.

**Áudio:**
1. Backend recebe áudio do Evolution.
2. Salva arquivo temporário.
3. Chama `MOD-ai-gateway` com STT (Whisper API).
4. Recebe transcrição.
5. Transcrição vai no contexto do Principal como mensagem do cliente.
6. Principal processa como texto.

**Imagem:**
1. Backend recebe imagem do Evolution.
2. Salva arquivo temporário.
3. Chama `MOD-ai-gateway` com Vision (gpt-4o mini vision).
4. Recebe descrição textual.
5. Descrição vai no contexto do Principal.
6. Principal processa.

**Documento:**
1. Backend recebe documento.
2. Salva URL via `MOD-files`.
3. Não processa conteúdo no MVP (apenas salva).
4. Principal recebe notificação "[Documento recebido]".

## Knowledge base (catálogo)

Cada Principal tem acesso a um **catálogo de produtos**:

### Dados carregados no MVP

- Tabela `produtos`: nome, descrição, preço_venda, preço_locacao_dia,
  categoria, disponibilidade.
- Tabela `estoque`: produto_id, quantidade, local.
- Dados **populados manualmente** no banco (não integração ERP real).

### Como o agente acessa

Via tools (`consultar_preco`, `consultar_estoque`), não via
RAG/embeddings no MVP. O catálogo é pequeno o suficiente para
consulta SQL direta.

**Fase 2:**
- Upload de documentos (PDF, CSV).
- Chunking + embeddings (RAG).
- Tool `buscar_knowledge(query)`.

## Fallbacks

### Quando IA não sabe

1. Principal não encontra tool adequada.
2. Retorna frase configurável: "Vou passar você para um
   de nossos atendentes, um momento!"
3. Status muda pra `humano_assumiu`.
4. SSE notifica atendentes alocados na `loja_responsavel_id`.
5. Conversa aparece na fila com badge 🟢.

### Quando IA erra

1. Cliente reclama no WhatsApp.
2. Atendente assume e corrige.
3. Admin pode editar prompt/agente.
4. Evento de erro logado em `evento_agente`.

## Métricas (futuro, não MVP)

- Taxa de resolução sem escalada.
- Taxa de acerto de transferência automática.
- Tempo médio de resposta.
- Tools mais chamadas.
- Custo por conversa (via `MOD-ai-gateway` tracking).

## Próximas seções

- `05-whatsapp-e-roteamento.md` — instância desacoplada.
- `06-conversa-espelhada.md` — UI PWA com multimodalidade visualizada.
