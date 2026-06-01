# 06 — Conversa Espelhada (PWA)

> **Status:** Especificação consolidada pós-revisão estratégica.
> PWA responsivo com SSE. Multimodalidade visualizada.

## O que é

A tela principal do **atendente humano** — PWA instalável em
celular e computador. Mostra conversas do WhatsApp em tempo real,
atualizadas via SSE. Suporta multimodalidade (texto, áudio,
imagem, documento).

## Layout desktop

```
+----------------------------------------------------------+
|  [Logo] Ciclo Norte    [🔔] [Perfil: Filipe ▼]         |
+----------------------------------------------------------+
| Lojas      | Conversas            | Chat               |
|            |                       |                    |
| ○ Todas    | 🔴 João (+55...)     | João Silva         |
| ● Vendas   |   "Oi, vocês têm..." |                    |
| ○ Locação  |   2 min              | João: Oi, vocês   |
|            |                      | têm furadeira?    |
|            | 🟡 Maria (+55...)    |                    |
|            |   [↔ Transferida     | Assistente Vendas: |
|            |    de Locação]       | Olá! Temos sim...   |
|            |   5 min              |                    |
|            |                      | 🎵 Áudio (12s)      |
|            |                      | "Quanto é a locação?"|
|            |                      |                    |
|            |                      | [Caixa de texto]   |
|            |                      | [Anexar] [Enviar]  |
+----------------------------------------------------------+
```

## Componentes

### 1. Lista de lojas (sidebar esquerda)

- Atendente vê só as lojas em que está alocado.
- Modo "Todas" (default): conversas de todas as lojas misturadas.
- Badge com contador de conversas não lidas por loja.
- Clicou numa loja → filtra conversas daquela loja.

### 2. Lista de conversas (centro)

- Ordenada por `ultima_msg_em` DESC.
- Cada item:
  - **Avatar** (iniciais do cliente ou genérico).
  - **Nome** do cliente (ou número se não identificado).
  - **Preview** da última mensagem (truncado).
    - Se áudio: "🎵 Áudio (12s)"
    - Se imagem: "📷 Foto"
    - Se documento: "📄 Documento"
  - **Timestamp** relativo ("2 min", "1h", "ontem").
  - **Badge de status:**
    - 🔵 `ia_ativa`
    - 🟢 `humano_assumiu`
    - 🟡 `transferida`
    - ⚪ `resolvida`
  - **Badge de loja** (se modo "Todas").
  - **Badge de transferência** (↔) se veio de outra loja.

- **Filtros:**
  - Por loja.
  - Por status.
  - Por busca (nome, telefone, conteúdo de mensagem).

### 3. Painel de chat (direita)

#### Cabeçalho

- Nome do cliente + número de telefone.
- Badge da loja atualmente responsável.
- Badge de transferência (se aplicável):
  - "↔ Transferida de Locação por Fulano (manual)"
  - "↔ Transferida de Vendas pela IA (automática)"
- Botões:
  - **"Assumir"** — se IA estiver respondendo.
  - **"Devolver pra IA"** — se humano assumiu.
  - **"Transferir para outra Loja"** — seletor de lojas.
  - **"Transferir para Atendente"** — seletor de colegas na mesma loja.
  - **"Marcar como resolvida"**.
  - **"Arquivar"** (admin apenas).

#### Área de mensagens (scroll reversível)

- **Top** = mensagens antigas. **Bottom** = mensagens novas.
- Scroll automático pra nova mensagem, a menos que usuário
  tenha scrollado pra cima (lendo histórico).

**Renderização por tipo de mensagem:**

| Tipo | Renderização |
|---|---|
| **Texto** | Texto simples, com quebra de linha. Links clicáveis. |
| **Imagem** | Miniatura clicável → lightbox. Abaixo: descrição gerada pela IA. |
| **Áudio** | Player com waveform simplificado. Botão play/pause. Transcrição expandida abaixo. |
| **Documento** | Ícone + nome do arquivo. Link para download. |
| **Sistema** | Mensagem centralizada, fundo cinza claro. "Conversa transferida para Locação" |

**Separação visual:**

| Origem | Alinhamento | Fundo | Borda |
|---|---|---|---|
| Cliente | Esquerda | #f0f0f0 | — |
| IA | Direita | #e3f2fd | Azul claro |
| Humano | Direita | #e8f5e9 | Verde claro |
| Sistema | Centro | #fafafa | Cinza |

**Cada mensagem mostra:**
- Avatar (IA: ícone robô; Humano: iniciais; Cliente: genérico).
- **Nome em negrito** (conforme briefing do Filipe).
- Conteúdo/timestamp.
- **Ações no hover:**
  - Copiar texto.
  - Reportar resposta ruim (só mensagens da IA).

### 4. Caixa de entrada (bottom)

- Campo de texto multilinha (Enter = nova linha, Ctrl+Enter = enviar).
- Botão **"Enviar"** (ícone avião).
- Botão **"Anexar"** (futuro — não MVP):
  - 📎 Anexar arquivo.
  - 📷 Tirar foto (mobile).
  - 🎤 Gravar áudio (mobile).

## SSE (Server-Sent Events)

### Como funciona

1. PWA abre conexão SSE: `GET /api/events?token=JWT`.
2. Backend mantém conexão aberta (usando `http.Flusher` no Go).
3. Quando evento acontece no backend:
   - Nova mensagem chega.
   - Conversa transferida.
   - Status muda.
4. Backend envia evento JSON pela conexão SSE.
5. PWA recebe e atualiza UI sem polling.

### Tipos de evento SSE

```typescript
type SSEEvent =
  | { type: 'nova_mensagem'; conversa_id: string; mensagem: Mensagem }
  | { type: 'conversa_transferida'; conversa_id: string; loja_origem: string; loja_destino: string; tipo: 'automatica' | 'manual' }
  | { type: 'status_mudou'; conversa_id: string; status: 'ia_ativa' | 'humano_assumiu' | 'transferida' }
  | { type: 'atendente_assumiu'; conversa_id: string; atendente_id: string; atendente_nome: string }
  | { type: 'conversa_resolvida'; conversa_id: string }
```

### Reconexão

- Se conexão SSE cair, PWA reconecta automaticamente a cada 3s.
- Envia header `Last-Event-ID` para não perder eventos.
- Fallback: se SSE falhar após 3 tentativas, ativa polling 5s
  como backup.

### Filtro de eventos por atendente

Backend só envia eventos SSE para conexões de atendentes
alocados na `loja_responsavel_id` da conversa. Admin recebe
todos.

## Ações de conversa

### "Assumir"
- Muda `status` pra `humano_assumiu`.
- `conversa.atendente_id = atendente_logado`.
- IA para de responder nesta conversa.
- SSE: `atendente_assumiu` para outros atendentes da loja.

### "Devolver pra IA"
- Muda `status` pra `ia_ativa`.
- `conversa.atendente_id = null`.
- IA volta a responder.
- SSE: `status_mudou` para atendentes da loja.

### "Transferir para outra Loja"
- Modal: seletor de lojas (exclui atual).
- Campo opcional: motivo.
- Backend: UPDATE `loja_responsavel_id`.
- INSERT em `transferencia`.
- SSE: `conversa_transferida` para ambas as lojas.
- Conversa some do painel atual, aparece na fila da destino.

### "Transferir para Atendente"
- Modal: seletor de colegas alocados na mesma loja.
- Backend: UPDATE `atendente_id`.
- SSE: `atendente_assumiu` para o atendente destino.

### "Marcar como resolvida"
- Muda `status` pra `resolvida`.
- Some da lista principal.
- Cliente ainda pode mandar msg → reabre automaticamente
  (`ia_ativa`).

## Notificações

### No PWA (SSE ativo)
- Badge na aba do navegador: `(3) Ciclo Norte`.
- Som leve (opcional, desligável).
- Toast notification quando nova msg chega de conversa não
  selecionada.

### Mobile (PWA instalado)
- Push notification via Web Push (futuro, não MVP).
- Badge no ícone do app.
- Vibração curta.

## Estados da conversa no painel

| Estado | Cor | Badge | Ações disponíveis |
|---|---|---|---|
| `ia_ativa` | 🔵 | "IA" | Assumir, Transferir |
| `humano_assumiu` | 🟢 | "Humano" | Devolver, Transferir, Resolver |
| `transferida` | 🟡 | "Transferida" | Assumir (loja destino) |
| `resolvida` | ⚪ | "Resolvida" | Reabrir |

## Resposta da IA em tempo real

Quando IA está processando:
1. Mensagem do cliente aparece (SSE).
2. Indicador "Assistente está digitando..." com animação de
   bolinhas pulando.
3. Quando IA responde, mensagem aparece suavemente (fade-in).
4. Se demorar >10s, mostra "Processando áudio/imagem...".

## Mobile (PWA)

### Layout mobile

```
+----------------------------------+
| [≡] Ciclo Norte    [🔔] [👤]    |
+----------------------------------+
| Lista de Conversas               |
|                                  |
| João Silva              2min    |
| "Oi, vocês têm..."      🔵      |
|                                  |
| Maria Souza             5min    |
| [↔ Transferida]         🟡      |
|                                  |
+----------------------------------+
```

Clicou numa conversa → tela cheia de chat.

- Swipe direita: marcar como resolvida.
- Swipe esquerda: transferir.
- Pull-to-refresh: reconecta SSE.
- Botão flutuante (+): nova ação rápida.

### Instalação PWA

- Prompt de instalação quando usuário acessa pela segunda vez.
- Ícone na home screen.
- Splash screen com logo Ciclo Norte.
- Modo standalone (sem barra de endereço do navegador).
- Offline básico: tela "Sem conexão" com botão "Tentar reconectar".

## Diferença do atendi-dentista/oficina

| Aspecto | Atendi-* | Ciclo Norte |
|---|---|---|
| **Loja** | 1 (implícita) | N (explícita, seletor, filtro) |
| **IA** | 1 agente | Time de agentes (principal + apoio) |
| **Multimodal** | Texto apenas | Texto + áudio + imagem |
| **Transferência** | Não existe | Automática (IA) + Manual (humano) |
| **Tempo real** | Polling 5s | SSE (instantâneo) |
| **PWA** | Web normal | PWA instalável |
| **Label de autor** | "Assistente" genérico | Nome do agente específico |
| **Mídia recebida** | Texto | Texto + imagem + áudio + documento |

## Próximas seções

- `07-decisoes-abertas.md` — decisões pós-consolidação.
- `08-escopo-mvp.md` — o que entra no MVP vs futuro.
