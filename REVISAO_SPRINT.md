# REVISAO_SPRINT — Ciclo Norte MVP

> Arquivo vivo. Toda decisão tomada durante a sprint longa é anotada aqui.
> Formato: `[DATA HORA] DECISÃO: ... MOTIVO: ...`

---

## Decisões pré-implementação (Filipe presente)

### [2026-06-01] D7 — LGPD
**DECISÃO:** Mínimo possível no MVP.
**MOTIVO:** Documentar política básica no README, sem mecanismos de self-service.
Não implementar eliminação/apagamento automatizado. Admin deleta manualmente se necessário.

### [2026-06-01] D13 — Números WhatsApp
**DECISÃO:** Uma única instância Evolution + um único número (do Filipe).
**MOTIVO:** É uma versão de demonstração pro cliente. Não temos número do Ciclo Norte ainda.
**IMPACTO:** Modelagem `instancia_whatsapp` ainda existe mas há apenas 1 registro. A separação entre lojas é puramente via `loja_responsavel_id` (atribuída no momento da criação da conversa ou via transferência).

### [2026-06-01] D14 — Quantidade de atendentes
**DECISÃO:** 3 atendentes para teste.
**MOTIVO:** Filipe confirmou.

### [2026-06-01] D15 — Admin inicial
**DECISÃO:** O primeiro a criar conta é o admin.
**MOTIVO:** Filipe confirmou. Vou criar endpoint de registro inicial protegido (só funciona quando banco está vazio) para o primeiro admin.

### [2026-06-01] Chave OpenAI
**DECISÃO:** Usar chave atual do handoff (`sk-proj-RXsYsOw...`) mas sistema deve permitir trocar via env var + admin config.
**MOTIVO:** Teste, precisa ser facilmente substituível quando fechar contrato.

### [2026-06-01] Catálogo
**DECISÃO:** Gerar dados fictícios de produtos/equipamentos (10-20 itens).
**MOTIVO:** Filipe não tem lista real ainda. Dados de demonstração: furadeiras, betoneiras, andaimes, etc.

---

## Decisões tomadas durante implementação (IA autônoma)

### [2026-06-01] D16 — Rota do painel de chat com static export
**DECISÃO:** Painel de chat usa `/conversations/chat?id=<id>` (query param) em vez de `/conversations/[id]` (rota dinâmica).
**MOTIVO:** Next.js 15 `output: export` não suporta `dynamicParams` nem rotas dinâmicas sem `generateStaticParams` preenchido no build time. Como não temos IDs de conversa no build, a alternativa é query param, que funciona perfeitamente como SPA.
**IMPACTO:** Links da lista de conversas apontam para `/conversations/chat?id=...`. Botão voltar do chat vai para `/conversations`.

### [2026-06-01] D17 — Auth: bcrypt + JWT
**DECISÃO:** Hash de senha com bcrypt (cost 12). JWT com `github.com/golang-jwt/jwt/v5`. Middleware extrai token do header `Authorization`, valida e injeta claims customizadas (UserID, Email, Role) no `context.Context`.
**MOTIVO:** Padrão robusto, biblioteca bem mantida, claims customizadas permitem controle de acesso por role.
**IMPACTO:** Todos os handlers protegidos chamam `auth.ClaimsFromContext(r.Context())`. `RequireRole("admin")` rejeita não-admins com 403.

### [2026-06-01] D18 — Primeiro registro = admin
**DECISÃO:** Endpoint `/api/auth/register` só aceita criar conta quando o banco de usuários está vazio. O primeiro usuário criado recebe role `admin` automaticamente.
**MOTIVO:** Evita necessidade de seed manual de admin. Após o primeiro, registros precisam de admin existente (ou endpoint de criação por admin).
**IMPACTO:** Setup do MVP é zero-touch: banco vazio → primeiro POST /api/auth/register vira admin.

### [2026-06-01] D19 — Ciclo de importação agent↔conversation
**DECISÃO:** `AgenteInfo` foi movido de `internal/agent` para `internal/conversation/models.go`.
**MOTIVO:** `agent` precisa importar `conversation` (para salvar mensagens). `conversation` precisava de `AgenteInfo` (para retornar dados do agente na API). Isso criava ciclo. `AgenteInfo` é um DTO de conversa, não pertence ao package agent.
**IMPACTO:** `conversation/models.go` define `AgenteInfo`. `agent` importa `conversation` sem ciclo.

### [2026-06-01] D20 — SSE auth via query param
**DECISÃO:** Conexões SSE usam `?token=<jwt>` na URL em vez de header `Authorization`.
**MOTIVO:** `EventSource` do browser não permite setar headers customizados (incluindo Authorization). O único jeito de passar JWT é via query string.
**IMPACTO:** `GET /api/events?token=...`. O handler extrai o token de `r.URL.Query().Get("token")` antes de cair no JWTMiddleware padrão (que olha header).

### [2026-06-01] D21 — Parser tolerante webhook Evolution
**DECISÃO:** `ParseWebhook` em `internal/evolution/webhook.go` aceita múltiplos formatos de payload: `messages.upsert` como array ou objeto único; JSON direto ou string-wrapped JSON (`"{...}"`); `data` aninhado ou direto.
**MOTIVO:** A API do Evolution não tem documentação rigorosa de schema; em produção o payload varia. Parser defensivo evita perda de mensagens.
**IMPACTO:** Todas as mensagens inbound são parseadas com fallback; se não conseguir extrair `remoteJid`/`pushName`/texto, loga e retorna erro 400.

### [2026-06-01] D22 — Dedupe WhatsApp via whatsapp_msg_id
**DECISÃO:** Campo `whatsapp_msg_id` na tabela `mensagens` é UNIQUE. No pipeline do webhook e do agente, se `whatsapp_msg_id` já existe, a mensagem é ignorada (skip).
**MOTIVO:** Webhooks de WhatsApp são entregados com retry; sem dedupe o mesmo inbound vira múltiplas mensagens no chat.
**IMPACTO:** Zero duplicação de mensagens inbound. O `whatsapp_msg_id` vem do `message.id` do payload Evolution.

### [2026-06-01] D23 — OpenAI REST direto (sem MOD-AI-GATEWAY)
**DECISÃO:** O agente chama a API REST da OpenAI diretamente via `net/http` (chat completions, Whisper, Vision). Não usa MOD-AI-GATEWAY da Titans.
**MOTIVO:** O MVP é standalone; não há infraestrutura da Titans rodando. Integração direta é mais simples e elimina dependência de serviço externo não provisionado.
**IMPACTO:** `internal/agent/agent.go` tem `callOpenAIBasic` (sem tools) e `callOpenAIChat` (com tools). Chave via env var `OPENAI_API_KEY`.

### [2026-06-01] D24 — Multimodal: audio → Whisper, imagem → Vision
**DECISÃO:** Mensagens de áudio são transcritas via Whisper-1 (`TranscribeAudio`). Imagens são descritas via GPT-4o Vision (`DescribeImage` com base64 data URL).
**MOTIVO:** Clientes enviam fotos de equipamentos e áudios perguntando preço. O agente precisa entender o conteúdo para responder.
**IMPACTO:** No pipeline do agente: se `mediaType == "audio"` → transcricao → texto vai pro contexto. Se `mediaType == "image"` → descrição → texto vai pro contexto. Se não houver chave OpenAI, retorna mensagem padrão pedindo texto.

### [2026-06-01] D25 — SSE broadcast filtrado por loja
**DECISÃO:** Cada conexão SSE armazena `LojaID` (do JWT claims). Broadcast publica eventos com `LojaID`; somente conexões da mesma loja recebem.
**MOTIVO:** Um atendente da loja de vendas não deve ver eventos da loja de locação.
**IMPACTO:** `sse.PublishNovaMensagem`, `PublishConversaTransferida`, etc. recebem `lojaID` e filtram conexões.

### [2026-06-01] D26 — Histórico circular SSE + reconexão
**DECISÃO:** Hub SSE mantém histórico circular dos últimos 1000 eventos. Reconexão via `Last-Event-ID` reenvia eventos perdidos desde aquele ID.
**MOTIVO:** Se o browser perder conexão (troca de rede, sleep do laptop), o `EventSource` reconecta automaticamente com `Last-Event-ID`. Sem histórico, mensagens enviadas durante a queda são perdidas.
**IMPACTO:** `Hub.GetHistorySince(lastID)` retorna eventos pendentes. Cliente não perde mensagens em reconexão.

### [2026-06-01] D27 — Tools do agente (fictícios para demo)
**DECISÃO:** 3 tools: `consultar_preco`, `consultar_estoque`, `transferir_setor`. Implementações buscam no banco local (produtos fictícios) ou retornam instrução de transferência.
**MOTIVO:** Demonstrar function calling real ao cliente. Dados fictícios são suficientes para MVP; serão substituídos por integração real depois.
**IMPACTO:** `internal/agent/tools.go` define `ToolDef` e `ExecuteTool`. OpenAI recebe schema das 3 funções. Quando LLM chama `transferir_setor`, o backend marca conversa como `transferida` e publica SSE.

### [2026-06-01] D28 — Transferência automática do agente
**DECISÃO:** Se o LLM invocar tool `transferir_setor` OU se a intenção do usuário for "falar com atendente" (detectado pelo próprio LLM sem tool), o agente marca conversa como `transferida` e para de responder.
**MOTIVO:** Requisito de negócio: cliente deve conseguir escalar para humano. Não depende só da tool; LLM pode inferir intenção.
**IMPACTO:** `ProcessMessage` verifica se resposta do LLM contém "transferir" ou se houve tool call de `transferir_setor`. Em ambos os casos, chama `repo.MarcarTransferida` + `sse.PublishConversaTransferida`.

### [2026-06-01] D29 — Cleanup de código legado do template
**DECISÃO:** Removidos arquivos `internal/server/server.go`, `internal/httpd/httpd.go`, `internal/api/handlers.go`, `internal/api/admin.go`, `internal/api/webhook.go`, `internal/api/sse.go` (método `SSEHandler` no tipo `Server` que não existia mais).
**MOTIVO:** Arquivos legados do template geravam erros de compilação (`undefined: Server`, `undefined: SSEBroadcaster`). Código novo vive em packages dedicados (`internal/auth`, `internal/conversation`, `internal/agent`, `internal/evolution`, `internal/sse`).
**IMPACTO:** Build limpo. `cmd/main.go` importa apenas `internal/api` (função `NewRouter`).

### [2026-06-01] D30 — Polling fallback para SSE
**DECISÃO:** Endpoint `/api/events/poll` retorna eventos pendentes como JSON (long-polling simples) para clients que não suportam EventSource.
**MOTIVO:** Alguns ambientes ( corporate proxies, old browsers) bloqueiam SSE. Fallback garante funcionalidade.
**IMPACTO:** `internal/sse/sse.go` tem `PollingHandler`. Cliente faz GET com `?token=` e `?lastId=`; recebe array de eventos.

### [2026-06-01] D31 — CORS aberto para desenvolvimento
**DECISÃO:** `Access-Control-Allow-Origin: *` em todas as respostas do backend.
**MOTIVO:** Frontend (Next.js dev server na porta 3000) e backend (Go na porta 8080) rodam em origens diferentes durante desenvolvimento.
**IMPACTO:** CORS middleware em `internal/api/api.go`. Em produção, deve ser restrito ao domínio do frontend.

### [2026-06-01] D32 — Deploy na VPS 192.168.15.97
**DECISÃO:** Backend Go na porta 8085. Frontend Next.js static export servido por Python custom server na porta 3002 (com suporte a clean URLs `.html`).
**MOTIVO:** Nginx requer sudo para configuração (não disponível sem senha). Python custom handler resolve `login` → `login.html` e `conversations/chat?id=...` funciona como SPA.
**IMPACTO:** Acesso via `http://192.168.15.97:3002` (frontend) → API proxy não necessário pois `NEXT_PUBLIC_API_BASE=http://192.168.15.97:8085` foi embedado no build.

### [2026-06-01] D33 — Admin endpoints criados inline
**DECISÃO:** Package `internal/admin` com handlers para `/api/lojas`, `/api/atendentes`, `/api/admin/agent-config`, `/api/admin/whatsapp-status`.
**MOTIVO:** Frontend já tinha painel admin completo; faltavam os endpoints no backend. Criados de forma minimalista mas funcional (CRUD real no Postgres).
**IMPACTO:** Painel admin funcional: criar/editar lojas, alocar atendentes, editar prompt do agente, ver status WhatsApp.

### [2026-06-01] D34 — Seed com senha bcrypt real
**DECISÃO:** Hash `$2a$12$mLKsryZAqHD3KO.LZulNx.FGEyu.YAZP6ILDk/K4joYOOszcPtto.` gerado via `bcrypt.GenerateFromPassword([]byte("senha123"), 12)`.
**MOTIVO:** Seed original tinha hash falso (placeholder) que impedia login. Usuários de teste (admin, joao, maria, pedro) conseguem fazer login com "senha123".
**IMPACTO:** 4 usuários seed + 2 lojas + 1 instância WhatsApp + 2 agentes principais + 15 produtos fictícios + estoque aleatório.

---

## Status deploy (2026-06-01 21:50)

| Serviço | Porta | Status | URL |
|---------|-------|--------|-----|
| Backend Go | 8085 | 🟢 Running | `http://192.168.15.97:8085` |
| Frontend Next.js | 3002 | 🟢 Running | `http://192.168.15.97:3002` |
| Evolution API | 8080 | 🟢 Running (pre-existente) | `http://192.168.15.97:8080` |
| Postgres | 5432 | 🟢 Running (pre-existente) | socket local |

- Banco `ciconorte` criado, migração aplicada, seed inserido.
- Login testado com `joao@ciclonorte.com` / `senha123` → token JWT válido.
- `/api/me` retorna `id`, `email`, `nome`, `role`.
- `/api/lojas` retorna 2 lojas (Vendas, Locação).
- `/api/conversations` retorna vazio (null → frontend trata como `|| []`).

## Dúvidas / Pendências pós-deploy

1. **Evolution instance:** A instância `ciclo-norte-demo` está no seed com status `connecting`. Precisa configurar no painel do Evolution API (porta 8080) e escanear QR code para conectar o número WhatsApp real.
2. **Nginx/porta 80:** Sem sudo não foi possível expor na porta 80. Acesso atual é `:3002` para frontend e `:8085` para API. Filipe pode querer configurar Nginx + Cloudflare tunnel depois.
3. **HTTPS:** Não configurado. Em rede local (192.168.x.x) não é crítico, mas para acesso externo precisará.
4. **PM/systemd:** Backend e frontend são `nohup` processos. Não há restart automático em caso de crash. Recomendado criar systemd units ou usar `pm2`/`supervisor`.
5. **OpenAI key:** Seed usa a chave antiga do handoff. Se expirar/atingir quota, o agente para de responder. Filipe deve monitorar uso.
6. **Migrations down:** Não existe `001_schema.down.sql`. Se precisar dropar o banco, usar `DROP DATABASE ciconorte` manualmente.

