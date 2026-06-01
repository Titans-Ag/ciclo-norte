# 09 — Débitos da Fundação

> **Status:** Especificação consolidada pós-revisão estratégica.
> Auth simples (não Kratos no MVP). Postgres Docker. PWA. SSE.

## Mapa de reuso

```
┌─────────────────────────────────────────────────────────────┐
│                    CICLO NORTE (app)                        │
├─────────────────────────────────────────────────────────────┤
│  REUSA DIRETO          ADAPTA              CRIA DO ZERO     │
│  ─────────────         ───────             ─────────────    │
│  MOD-core              MOD-auth (*)          Modelo multi-   │
│  MOD-ai-gateway        MOD-agents              loja desacoplado│
│  MOD-messaging         MOD-ui                Alocação N:M  │
│  MOD-files             advanced/atendi-      Transferência  │
│  MOD-app-web             ia-whatsapp           híbrida     │
│                        (referência)          SSE por loja    │
│                                              Auth simples    │
│                                              (bcrypt+JWT)   │
│                                              Subsistema ERP  │
│                                                simulado      │
└─────────────────────────────────────────────────────────────┘

(*) MOD-auth não reuso direto no MVP — migração Fase 2
```

---

## 1. REUSA DIRETO (copia/importa, pouca ou nenhuma mudança)

### `MOD-core`
- **O que:** Config, logging, erros canônicos, HTTP server/client, IDs, observability.
- **Como:** Importa como módulo Go (`replace => ../modules/core`).
- **Esforço:** Zero. Leaf da árvore de dependências.
- **ID:** `MOD-core`

### `MOD-ai-gateway`
- **O que:** Provider abstraction LLM (OpenAI, Anthropic, etc.).
- **Como:** Usa pra chamar GPT-4o-mini (texto), Whisper (STT), Vision (imagem).
- **Esforço:** Baixo. Configurar provider e model. Quota e fallback já abstraídos.
- **IDs:** `MOD-ai-gateway`, `ADR-0020`
- **Nota:** Finalmente integra de verdade, quitando débito do `openai_adapter.go` solto nos atendis.

### `MOD-messaging`
- **O que:** Integração WhatsApp (Evolution API).
- **Como:** Usa como referência. O `advanced/atendimento-ia-whatsapp/go/` tem webhook real que serve de base.
- **Esforço:** Médio. Adaptar para instância desacoplada (`instancia_whatsapp_id` imutável).
- **IDs:** `MOD-messaging`, `MOD-advanced-atendimento-ia-whatsapp`

### `MOD-files`
- **O que:** Storage de mídia (upload/download com expiração).
- **Como:** Usa quando receber foto/áudio/documento do WhatsApp. Salva temporariamente, gera URL.
- **Esforço:** Baixo. Integrar quando precisar.
- **ID:** `MOD-files`

### `MOD-app-web`
- **O que:** Template single-app web (Next.js 15 + Tailwind 4).
- **Como:** Ponto de partida para PWA. Copia estrutura de pastas, configuração.
- **Esforço:** Baixo. Adapta pra PWA (manifest, service worker).
- **ID:** `MOD-app-web`

---

## 2. ADAPTA (usa como base, muda comportamento)

### `MOD-auth` → **NÃO REUSA DIRETO NO MVP**
- **Decisão:** Auth simples (bcrypt + JWT) no MVP, não Kratos.
- **Por que:** Agiliza PWA. `MOD-auth` (Ory Kratos) é complexo de configurar.
- **Migração:** Planejada para Fase 2 se necessário.
- **O que fazemos no MVP:** Implementação própria de bcrypt + JWT, mas seguindo padrões do `MOD-auth` (sessão, middleware, entitlements).
- **IDs:** `MOD-auth`

### `MOD-agents`
- **O que:** Configuração e orquestração de agentes (Definition + Instance, prompt, tools, memória).
- **Como adapta:** Usa como biblioteca para criar agente, invocar, gerenciar prompt/tools.
- **Gap:** `MOD-agents` não tem conceito de "principal vs apoio" nem "time por loja". Isso é layer de domínio do Ciclo Norte.
- **Esforço:** Médio-Alto. Precisa ler `MODULE.md` do agents em detalhe.
- **IDs:** `MOD-agents`, `ADR-0020`

### `MOD-ui`
- **O que:** Design system (tokens, componentes base, hooks).
- **Como adapta:** Reusa tokens (cores, tipografia, spacing) e componentes base (Button, Input, Card). Mas componentes de domínio (chat, lista de conversas, badge transferência) são novos.
- **Esforço:** Médio. Reusa primitives, cria componentes de domínio.
- **ID:** `MOD-ui`

### `advanced/atendimento-ia-whatsapp` (go + web)
- **O que:** Código real da sprint v0 — webhook, conversa, UI espelho.
- **Como adapta:** Copia como ponto de partida, mas muda:
  - Modelo de dados (multi-loja, instância desacoplada).
  - Auth (de nenhum para bcrypt+JWT).
  - UI (PWA, SSE, multimodalidade, transferência).
- **Esforço:** Médio-Alto. É a base mais próxima, mas adaptações são significativas.
- **IDs:** `MOD-advanced-atendimento-ia-whatsapp`, `MOD-advanced-atendimento-ia-whatsapp-web`

---

## 3. CRIA DO ZERO

### Auth simples (bcrypt + JWT)
- **O que:** Login, logout, middleware JWT, hash de senha.
- **Por que novo:** Decisão de não usar `MOD-auth` (Kratos) no MVP.
- **Implementação:**
  - `POST /api/auth/login` → valida email/senha (bcrypt), gera JWT.
  - `POST /api/auth/logout` → invalida token (blacklist simples ou TTL).
  - Middleware JWT em endpoints protegidos.
  - JWT expira em 24h, refresh token em 7 dias.
- **Esforço:** Baixo-Médio. Padrão, mas precisa ser seguro.

### Modelo multi-loja desacoplado
- **O que:** `loja`, `instancia_whatsapp`, `conversa` com `instancia_whatsapp_id` (imutável) + `loja_responsavel_id` (mutável).
- **Por que novo:** Nenhum app/módulo da Titans modela desacoplamento canal/responsabilidade.
- **Esforço:** Baixo-Médio. CRUD + JOIN. Complexidade na lógica de permissão.

### SSE por loja alocada
- **O que:** Server-Sent Events filtrados por `atendente_loja`.
- **Por que novo:** `advanced/atendimento-ia-whatsapp` usa polling 5s.
- **Implementação:**
  - Go: `http.Flusher` com conexão persistente.
  - Filtro: só envia eventos de `loja_responsavel_id` nas quais o atendente está alocado.
  - Reconexão com `Last-Event-ID`.
- **Esforço:** Médio. Gerenciamento de conexões, reconexão, fallback.

### Transferência híbrida (automática + manual)
- **O que:**
  - Automática: tool-call `transferir_setor` no agente Principal.
  - Manual: endpoint + UI para atendente transferir.
- **Por que novo:** Não existe em nenhum app/módulo.
- **Esforço:** Médio. UPDATE em `conversa`, INSERT em `transferencia`, SSE broadcast.

### Multimodalidade (STT + Vision)
- **O que:**
  - Áudio → transcrição Whisper.
  - Imagem → descrição gpt-4o mini vision.
- **Por que novo:** Atendis são texto apenas.
- **Esforço:** Médio. Integração com `MOD-ai-gateway` para endpoints de STT/Vision.

### Subsistema ERP simulado
- **O que:** Tabelas `produtos`, `estoque` populadas manualmente.
- **Por que novo:** Evita integração com ERP legado no MVP.
- **Esforço:** Baixo. Schema simples, seed com dados de exemplo.

### Tela de gestão de agentes
- **O que:** Formulário para editar prompt, tools, parâmetros.
- **Por que novo:** Atendis têm prompt hardcoded. Não existe tela de config.
- **Esforço:** Médio. Formulário com tabs, validação, preview.

### Tela de "fluxo" (visualização)
- **O que:** SVG/Canvas exibindo nós (Principal + Apoio) e setas.
- **Por que novo:** Não existe. É gimmick pro cliente.
- **Esforço:** Baixo. Renderização estática, não editor.

---

## Resumo de esforço

| Categoria | Itens | Esforço total |
|---|---|---|
| **Reusa direto** | 5 módulos | Baixo (~15%) |
| **Adapta** | 3 módulos + advanced | Médio-Alto (~45%) |
| **Cria do zero** | 8 features | Médio-Alto (~40%) |

**Conclusão:** O Ciclo Norte é **~60% reaproveitamento** da stack
Titans (considerando `advanced/atendimento-ia-whatsapp` como base
adaptável). O trabalho pesado está em:
1. **Desacoplamento** (instância vs responsabilidade).
2. **Multimodalidade** (STT + Vision).
3. **Transferência** (automática + manual + SSE).
4. **PWA** (SSE client, service worker, offline básico).

## Riscos da fundação

| Risco | Probabilidade | Mitigação |
|---|---|---|
| `MOD-agents` não expõe API adequada para tool-calls | Média | Implementar layer própria de tool-calling se necessário. |
| `MOD-ai-gateway` não tem endpoints STT/Vision prontos | Média | Usar OpenAI SDK direto como fallback, migrar depois. |
| `advanced/atendimento-ia-whatsapp` tem bugs não descobertos | Baixa | Testar end-to-end antes de copiar código. |
| SSE com muitas conexões simultâneas na VM | Baixa | VM tem recursos limitados. Monitorar. |
| Auth simples (bcrypt+JWT) pode ser insuficiente para produção | Média | Planejar migração Kratos desde o início (estrutura modular). |

## Migração planejada (Fase 2)

| Do que | Para que | Quando |
|---|---|---|
| Auth simples (bcrypt+JWT) | `MOD-auth` + Kratos | Se necessário (múltiplos admins, MFA) |
| Catálogo manual (tabelas SQL) | Integração ERP real | Quando Ciclo Norte disponibilizar API/acesso |
| SSE | WebSocket (se bidirecional necessário) | Se precisar de typing indicator em tempo real mais robusto |
| 2 lojas | 3 lojas (+ Manutenção) | Quando Ciclo Norte adotar |

## Próximos passos

1. **Revisão técnica** do `MODULE.md` do `MOD-agents` e `MOD-ai-gateway`.
2. **Criar ADR do app** quando modelo de dados estiver validado.
3. **Implementar Fase 0:** Setup infra (Postgres Docker, Evolution, seed).
4. **Implementar Fase 1:** Fundação (auth, schema, migrations).
