# 08 — Escopo do MVP

> **Status:** Especificação consolidada pós-revisão estratégica.
> Todas as decisões arquiteturais estão fechadas.

## Definição de MVP

Mínimo que prova o valor pro cliente Ciclo Norte:

> "Atendente loga no PWA, vê conversas em tempo real (SSE),
> responde pelo painel, e a IA multimodal responde perguntas
> do catálogo sozinha. A IA pode transferir automaticamente
> pra outra loja quando identificar que o assunto é de outro
> setor. O atendente também pode transferir manualmente."

## O que ENTRA no MVP

### Backend (Go 1.23+)

| # | Feature | Complexidade | Notas |
|---|---|---|---|
| B1 | **Auth simples** (bcrypt + JWT) | Média | Login, logout, middleware JWT. Sem Kratos. |
| B2 | **CRUD Loja** | Baixa | 2 lojas (vendas, locação). Admin cria. |
| B3 | **CRUD Atendente** | Baixa | Admin cadastra. Senha hash bcrypt. |
| B4 | **Alocação atendente-loja** | Baixa | Manual (admin clica). Tabela N:M. |
| B5 | **Webhook WhatsApp** (receber) | Média | Evolution v2.3.x, identificar instância, dedupe. |
| B6 | **Enviar mensagem WhatsApp** | Baixa | Via Evolution API. Ordem FIFO garantida. |
| B7 | **Agente Principal multimodal** (1 por loja) | Média | Texto + áudio (STT) + imagem (Vision). |
| B8 | **Agentes de Apoio** (tool-calls) | Média | `consultar_preco`, `consultar_estoque`. Função Go. |
| B9 | **Tool `transferir_setor`** | Média | UPDATE `conversa.loja_responsavel_id`. Log em `transferencia`. |
| B10 | **Conversa + mensagens** (DB) | Baixa | Schema completo com desacoplamento. |
| B11 | **Transferência manual** | Média | Endpoint + SSE. Atendente → outra loja ou colega. |
| B12 | **SSE** (Server-Sent Events) | Média | `/api/events` com filtro por loja alocada. |
| B13 | **Espelhamento** (REST API) | Média | Endpoints pro PWA consumir. |
| B14 | **Assumir/devolver IA** | Baixa | Status machine. SSE broadcast. |
| B15 | **Subsistema ERP simulado** | Baixa | Tabelas `produtos`, `estoque` populadas manualmente. |
| B16 | **Healthz + métricas básicas** | Baixa | `/healthz` com info do app. |

### Frontend (Next.js 15 + Tailwind 4 + PWA)

| # | Feature | Complexidade | Notas |
|---|---|---|---|
| F1 | **Tela de login** (PWA) | Baixa | Email + senha. Instalação PWA. |
| F2 | **Lista de conversas** (SSE) | Média | Filtro por loja, busca, badge status, badge transferência. |
| F3 | **Painel de chat** (multimodal) | Média | Texto, imagem (com descrição), áudio (com transcrição), documento. |
| F4 | **Ações de conversa** | Baixa | Assumir, devolver, transferir (loja + atendente), resolver. |
| F5 | **SSE client** | Média | EventSource API, reconexão, fallback polling. |
| F6 | **Admin: CRUD loja** | Baixa | Formulário simples. |
| F7 | **Admin: CRUD atendente** | Baixa | Formulário simples. |
| F8 | **Admin: alocar atendente** | Baixa | Checkbox por loja. |
| F9 | **Admin: config agente** | Média | Formulário de prompt, modelo, temperatura, tools. |
| F10 | **Admin: tela de "fluxo"** | Baixa | Visualização SVG/Canvas (exibição, não editor). |
| F11 | **Admin: status instâncias WhatsApp** | Baixa | Lista com estado e ação reconectar. |
| F12 | **PWA manifest + service worker** | Baixa | `manifest.json`, offline básico, splash screen. |

### Infra

| # | Feature | Complexidade | Notas |
|---|---|---|---|
| I1 | **Postgres 16** (Docker Compose) | Baixa | `docker-compose.yml` com Postgres + app Go. |
| I2 | **Evolution API** (existente) | Zero | Já roda na VM. Criar 2 instâncias. |
| I3 | **Deploy na VM** | Baixa | Build Go + Next.js, serve com `next start`. |
| I4 | **SSL/TLS** (futuro) | — | Não no MVP. HTTP interno na LAN. |

---

## O que NÃO entra no MVP (Fase 2+)

| # | Feature | Por que ficou pra depois |
|---|---|---|
| F2.1 | **App mobile nativo** | PWA cobre. Expo/RN se necessário depois. |
| F2.2 | **Knowledge base upload** | Catálogo é tabela SQL no MVP. RAG na Fase 2. |
| F2.3 | **Editor visual de "fluxo"** | É exibição (gimmick), não editor. Formulário suficiente. |
| F2.4 | **Integração ERP real** | Simulada no MVP. Prova valor primeiro. |
| F2.5 | **MFA / reset de senha por email** | Auth simples. Fase 2 se necessário. |
| F2.6 | **Push notification nativo** | SSE + badge de aba suficiente. Web Push na Fase 2. |
| F2.7 | **Métricas dashboard** | Logs brutos no MVP. Dashboard na Fase 2. |
| F2.8 | **Arquivar conversas** | Apenas "resolvida" no MVP. Arquivar é cosmetic. |
| F2.9 | **LGPD self-service** | Admin deleta manualmente. Fase 2. |
| F2.10 | **Enviar mídia (foto/áudio)** | Recebe sim, envia só texto. |
| F2.11 | **TTS (texto pra áudio)** | IA responde em texto. Áudio é entrada, não saída. |
| F2.12 | **Mais de 2 lojas** | 2 prova multi-loja. Adicionar é trivial. |
| F2.13 | **Atendente ver outros online** | Não essencial pro MVP. |
| F2.14 | **Impersonação admin** | Não MVP. |
| F2.15 | **Horário de atendimento / SLA** | Configuração simples. Fase 2. |
| F2.16 | **Satisfação do cliente** | NPS, feedback. Fase 2. |

---

## Estimativa de esforço

Assumindo 1 dev (Filipe) com apoio da IA:

| Fase | Tempo | Entrega |
|---|---|---|
| **Fase 0: Setup infra** | 1 dia | Postgres Docker, Evolution instâncias, seed de dados. |
| **Fase 1: Fundação** | 3 dias | Auth (bcrypt+JWT), schema DB, migrations Go, deploy básico. |
| **Fase 2: WhatsApp + Conversa** | 4 dias | Webhook, dedupe, CRUD conversa/mensagem, REST API. |
| **Fase 3: Roteamento** | 3 dias | Transferência automática (tool), transferência manual, SSE. |
| **Fase 4: IA Multimodal** | 4 dias | Agente Principal (texto+audio+imagem), tools de apoio. |
| **Fase 5: UI PWA** | 5 dias | Login, lista, chat, admin, SSE client, PWA manifest. |
| **Fase 6: Integração + Teste** | 3 dias | Ligar tudo, teste end-to-end, polir, bugfix. |
| **Total** | **~23 dias** (~4-5 semanas) | MVP funcionando na VM. |

> **Chute.** Depende de disponibilidade do Filipe, número de
> horas/dia, e gaps na fundação Titans.

## Critérios de aceite do MVP

1. **Auth:** Atendente loga com email/senha no PWA. Admin loga e vê tudo.
2. **Multi-loja:** 2 lojas configuradas (vendas, locação). Cada uma com número WhatsApp.
3. **Conversa:** Cliente manda msg no WhatsApp → aparece no painel em <5s (SSE).
4. **Multimodalidade:** Cliente manda áudio → IA transcreve e responde. Cliente manda foto → IA descreve e responde.
5. **IA:** Pergunta "quanto custa X?" → IA consulta catálogo e responde corretamente.
6. **Transferência automática:** Cliente pergunta de locação na loja de vendas → IA identifica e transfere. Cliente não percebe.
7. **Transferência manual:** Atendente transfere conversa para outra loja. Aparece na fila da loja destino em <2s.
8. **Humano:** Atendente clica "Assumir" → envia msg → cliente recebe no WhatsApp.
9. **Label:** Mensagem da IA aparece como "Assistente Vendas". Mensagem do humano como "Fulano".
10. **Isolamento:** Atendente de Vendas não vê conversa de Locação (a menos que alocado em ambas).
11. **Config:** Admin edita prompt do agente e vê resultado em nova conversa sem deploy.
12. **PWA:** Instalável no celular. Funciona offline com tela de "sem conexão".
13. **Estável:** 24h rodando sem crash.

## Depois do MVP

1. **Fase 2:** Manutenção (3ª loja), Kratos auth, integração ERP real, knowledge base RAG, enviar mídia.
2. **Fase 3:** App mobile nativo (Expo), push notifications, métricas dashboard, LGPD self-service.
3. **Fase 4:** Novos módulos (financeiro, manutenção) — vender mais pro mesmo cliente.

## Próxima seção

- `09-debitos-da-fundacao.md` — o que reusa da stack Titans.
