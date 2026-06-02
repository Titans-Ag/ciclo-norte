# Análise do Pipeline de Mensagens — Ciclo Norte

## Data: 2026-06-01
## Analista: Generator Agent

---

## 1. Resumo Executivo

Foram identificados **3 problemas críticos (P0/P1)** no pipeline de mensagens que afetam tanto a experiência do atendente (frontend) quanto a entrega ao cliente final (WhatsApp).

| # | Problema | Severidade | Status |
|---|----------|------------|--------|
| 1 | Mensagens inbound do cliente **não disparam SSE broadcast** | P0 | Corrigido |
| 2 | `SendMessage` do atendente **não envia para Evolution API** | P0 | Corrigido |
| 3 | Pool de conexões pgx **sem limite configurado** | P1 | Corrigido |
| 4 | Payload SSE incompleto (faltam `enviada_em`, `midia_url`) | P1 | Corrigido |
| 5 | **Frontend: `useSSE.ts` não escuta eventos nomeados** (`nova_mensagem`, etc.) | P0 | Corrigido |
| 6 | **Frontend: payload SSE incompatível** entre backend e `chat/page.tsx` / `conversations/page.tsx` | P0 | Corrigido |

---

## 2. Arquitetura do Pipeline

```
[Cliente WhatsApp] ←→ [Evolution API] ←→ [Webhook /api/webhook/evolution]
                                        ↓
                                    [PostgreSQL]
                                        ↓
                                    [SSE Hub] ←→ [Frontend Next.js]
                                        ↑
                                    [conversation/handler.go]
                                        ↓
                                    [Evolution API] → [Cliente WhatsApp]
```

---

## 3. Diagnóstico Detalhado

### 3.1 Webhook Evolution → Backend (webhook.go)

**O que funciona:**
- Recebe evento `messages.upsert` ✅
- Deduplica via `whatsapp_msg_id` ✅
- Parsing do payload v2.3.7 ✅ (conversão de JID para telefone, extração de text/audio/image/video/document)
- Cria conversa nova se não existir ✅
- Salva mensagem no banco ✅

**O que está quebrado:**
- ❌ **NÃO chama `sse.PublishNovaMensagem`** após salvar mensagem do cliente. O frontend só recebe atualizações quando o agente responde ou quando o atendente envia mensagem. Isso explica a "taxa de atualização baixa".
- ❌ **Não há retry/backoff**. Se o servidor estiver fora no momento do webhook, a mensagem é perdida. A Evolution API não reenvia automaticamente se receber 5xx; precisamos garantir resposta rápida (2xx) para não forçar retry desnecessário, mas também logar falhas.

**Código problemático (linha 137-141):**
```go
msg, err = conversation.CreateMensagem(ctx, msg)
if err != nil {
    writeError(w, http.StatusInternalServerError, "failed to save message")
    return
}
// FALTA: sse.PublishNovaMensagem(...)
```

### 3.2 Backend → Banco → SSE → Frontend

**O que funciona:**
- `CreateMensagem` atualiza `ultima_msg_em` na conversa ✅
- `PublishNovaMensagem` é chamado no `SendMessage` (atendente) ✅
- Polling fallback (`/api/events/poll`) retorna eventos recentes ✅

**O que está quebrado:**
- ❌ **Broadcast SSE para mensagens inbound ausente** (ver 3.1)
- ❌ **Payload SSE incompleto** em `conversation/handler.go:246`. O payload enviado não inclui `enviada_em`, `created_at`, `midia_url`, `id` (mensagem_id é enviado mas não `id`). O frontend pode ter dificuldade de renderizar ou ordenar corretamente.

**Código problemático (handler.go:246-254):**
```go
sse.PublishNovaMensagem(conv.LojaResponsavelID, map[string]any{
    "conversa_id": conv.ID,
    "mensagem_id": msg.ID,
    "autor_tipo":  msg.AutorTipo,
    "autor_nome":  msg.AutorNome,
    "conteudo":    msg.Conteudo,
    "midia_tipo":  msg.MidiaTipo,
})
```

### 3.3 Envio Frontend → Backend → Evolution → WhatsApp (CRÍTICO)

**O que está quebrado:**
- ❌ **`SendMessage` em `conversation/handler.go` NÃO envia mensagem para a Evolution API.** O atendente envia mensagem pelo dashboard, ela é salva no banco, aparece no SSE, mas **nunca chega ao WhatsApp do cliente**.

**Código problemático (handler.go:179-256):**
O handler chama `CreateMensagem` e `PublishNovaMensagem`, mas **nunca chama `evolution.Client.SendTextMessage` ou `SendMediaMessage`**.

**Solução necessária:**
- Integrar `evolution.Client` no `conversation.Handler`
- Usar `instance.EvolutionURL` e `instance.EvolutionInstanceName` da instância vinculada à conversa
- Enviar texto via `POST /message/sendText/:instance`
- Enviar mídia via `POST /message/sendMedia/:instance`

### 3.4 Latência e Performance

**Problemas:**
- ❌ **Pool pgx sem configuração** (`db.go:12-23`). `pgxpool.New` usa configuração padrão do ambiente, que pode ter `max_conns` muito baixo ou muito alto. Sem controle, pode haver esgotamento de conexões sob carga.
- ⚠️ **N+1 queries** em `ListConversasByLoja` (2 subqueries por conversa). Para `limit=50`, gera 100 queries extras. Impacto médio para listagem, mas pode ser otimizado com JOIN + `jsonb_agg` no futuro.
- ✅ **SSE não bloqueia goroutines** — `select` com `default` no channel write evita deadlock.

### 3.5 Frontend — SSE (useSSE.ts / chat/page.tsx / conversations/page.tsx)

**Problemas:**
- ❌ **`useSSE.ts` usa `es.onmessage`** que só captura eventos **sem nome** (`event: message` ou ausente). O backend envia `event: nova_mensagem`, `event: conversa_transferida`, etc. Esses eventos **nunca eram processados** pelo frontend. O polling fallback funcionava, mas com delay de 5s.
- ❌ **`chat/page.tsx` espera payload `{ conversa_id, message: Message }`**, mas o backend enviava os campos flat (`id`, `conversa_id`, `autor_tipo`, ...). `payload.message` era `undefined`.
- ❌ **`conversations/page.tsx` trata `new_message` como `Conversation`**, mas o payload é uma mensagem. `updateConversation(c)` falhava silenciosamente.

---

## 4. Correções Implementadas

### 4.1 webhook.go — Adicionar SSE broadcast após salvar mensagem inbound

```go
// Após CreateMensagem
sse.PublishNovaMensagem(conv.LojaResponsavelID, buildMensagemPayload(msg, conv.ID))
```

### 4.2 conversation/handler.go — Integrar Evolution API no SendMessage

```go
// 1. Carregar instância da conversa
inst, err := GetInstanciaByID(ctx, conv.InstanciaWhatsappID)
// 2. Enviar para Evolution
evoClient := evolution.NewClient(inst.EvolutionURL, cfg.EvolutionAPIKey)
if msg.MidiaTipo == "text" {
    err = evoClient.SendTextMessage(ctx, inst.EvolutionInstanceName, conv.ClienteTelefone, *msg.Conteudo)
} else {
    err = evoClient.SendMediaMessage(ctx, inst.EvolutionInstanceName, conv.ClienteTelefone, msg.MidiaTipo, *msg.MidiaURL, *msg.Conteudo)
}
// 3. Tratar erro (logar mas não falhar o request)
```

### 4.3 Melhorar payload SSE

Incluir todos os campos necessários para o frontend renderizar sem precisar fazer fetch adicional:
- `id`, `conversa_id`, `autor_tipo`, `autor_nome`, `conteudo`, `midia_tipo`, `midia_url`, `enviada_em`, `created_at`

### 4.4 Configurar pool pgx

```go
config, err := pgxpool.ParseConfig(databaseURL)
config.MaxConns = 20
config.MinConns = 5
config.MaxConnLifetime = time.Hour
pool, err := pgxpool.NewWithConfig(ctx, config)
```

### 4.5 Frontend — Corrigir `useSSE.ts`

- Substituir `es.onmessage` por `es.addEventListener('nova_mensagem', ...)` para cada tipo de evento nomeado.
- Mapear nomes do backend (`nova_mensagem` → `new_message`, `conversa_transferida` → `transfer`, `status_mudou` → `status_change`, `atendente_assumiu` → `conversation_update`).
- Encapsular payload de `new_message` no formato esperado: `{ conversa_id, message: payload }`.
- Aplicar mesmo mapeamento no fallback polling.

### 4.6 Frontend — Corrigir `conversations/page.tsx`

- `new_message`, `transfer`, `status_change` agora disparam `fetchConversations()` para recarregar a lista com dados atualizados do backend.

### 4.7 Frontend — Corrigir `chat/page.tsx`

- Manter lógica existente que espera `{ conversa_id, message }` — agora compatível com o payload encapsulado pelo `useSSE.ts`.

---

## 5. Testes End-to-End

### Cenário 1: Cliente envia mensagem
1. Cliente envia "Oi" pelo WhatsApp
2. Evolution dispara webhook → POST /api/webhook/evolution
3. Backend salva mensagem no PostgreSQL
4. Backend publica SSE `nova_mensagem`
5. Frontend recebe evento em < 1s
6. Conversa aparece na lista com preview atualizado

### Cenário 2: Atendente envia mensagem
1. Atendente digita "Olá, como posso ajudar?" no dashboard
2. Frontend POST /api/conversations/{id}/messages
3. Backend salva mensagem no PostgreSQL
4. Backend envia para Evolution API (POST /message/sendText)
5. Cliente recebe mensagem no WhatsApp
6. Backend publica SSE `nova_mensagem`
7. Frontend atualiza thread em < 1s

---

## 6. Recomendações Futuras

1. **Retry com backoff no webhook**: Se o processamento falhar (ex: DB fora), retornar 500 para que a Evolution reenvie. Adicionar circuit breaker se necessário.
2. **Otimizar N+1**: Refatorar `ListConversasByLoja` para usar CTE + `jsonb_agg` em vez de subqueries.
3. **Métricas**: Adicionar `prometheus` ou `expvar` para latência webhook→SSE e taxa de sucesso Evolution API.
4. **Idempotência no envio outbound**: Gerar `whatsapp_msg_id` no envio e deduplicar se a Evolution reenviar webhook de confirmação.

---

## 7. Referências

- Evolution API v2.3.7 Docs: https://doc.evolution-api.com/v2/api-reference/messages/send-text
- Arquivos analisados / modificados:
  - `/Users/filipe/Oficina/projetos/titans/apps/ciclo-norte/go/internal/evolution/webhook.go`
  - `/Users/filipe/Oficina/projetos/titans/apps/ciclo-norte/go/internal/conversation/handler.go`
  - `/Users/filipe/Oficina/projetos/titans/apps/ciclo-norte/go/internal/conversation/repository.go`
  - `/Users/filipe/Oficina/projetos/titans/apps/ciclo-norte/go/internal/sse/sse.go`
  - `/Users/filipe/Oficina/projetos/titans/apps/ciclo-norte/go/internal/agent/agent.go`
  - `/Users/filipe/Oficina/projetos/titans/apps/ciclo-norte/go/internal/evolution/client.go`
  - `/Users/filipe/Oficina/projetos/titans/apps/ciclo-norte/go/internal/db/db.go`
  - `/Users/filipe/Oficina/projetos/titans/apps/ciclo-norte/go/internal/api/api.go`
  - `/Users/filipe/Oficina/projetos/titans/apps/ciclo-norte/web/src/hooks/useSSE.ts`
  - `/Users/filipe/Oficina/projetos/titans/apps/ciclo-norte/web/src/app/conversations/page.tsx`
  - `/Users/filipe/Oficina/projetos/titans/apps/ciclo-norte/web/src/app/conversations/chat/page.tsx`
