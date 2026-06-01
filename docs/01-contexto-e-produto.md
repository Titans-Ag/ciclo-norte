# 01 — Contexto e Produto

> **Status:** Especificação consolidada pós-revisão estratégica (2026-06-01).

## O que é (definição de uma linha)

Plataforma PWA de atendimento WhatsApp multi-loja para Ciclo Norte,
com roteamento dinâmico de conversas, time de agentes de IA
multimodais por loja, atendentes humanos alocáveis, e conversa
espelhada em tempo real via SSE.

## Pra quem (cliente)

**Ciclo Norte** — empresa em crescimento com 3 divisões:

| Divisão | O que faz | Volume estimado |
|---|---|---|
| **Vendas** | Venda de equipamentos e ferramentas | A confirmar com cliente |
| **Locação** | Locação de ferramentas e equipamentos | A confirmar com cliente |
| **Manutenção** | Manutenção de equipamentos | A confirmar com cliente |

**MVP:** 2 lojas (Vendas + Locação) para homologar roteamento
dinâmico. Manutenção entra na Fase 2.

## O que resolve (problema)

Ciclo Norte está crescendo. Recebem mensagens WhatsApp de clientes
finais com perguntas que vão desde "vocês têm essa ferramenta?" até
"tenho alguma parcela pendente?". Hoje:

- A atendente **entra no sistema** (ERP/R&P deles) pra responder.
- O atendimento é feito **dentro do WhatsApp**, sem painel unificado.
- Não tem visibilidade de "o que foi respondido, por quem, quando".
- A integração com o sistema interno **não existe** — é tudo manual.
- Clientes mandam mensagem na loja errada e não há como redirecionar
  sem pedir pro cliente mandar em outro número.

O que entregamos:

1. **Painel PWA único** onde atendentes veem e respondem conversas
   (sem sair do app pra abrir WhatsApp Web). Instalável no celular.
2. **IA multimodal** que responde sozinha perguntas de catálogo
   (texto, áudio transcrito, imagem analisada) e escala pro humano
   quando precisa.
3. **Roteamento dinâmico** — IA identifica que cliente perguntou de
   locação na loja de vendas e **transfere automaticamente** a
   responsabilidade da conversa pra loja certa, sem o cliente
   perceber.
4. **Configuração visual** dos agentes — admin muda prompt, pluga
   tools, ajusta parâmetros, sem deploy.
5. **Fundação** pra integrar com ERP/R&P deles (parcelas, estoque)
   — simulada no MVP via subsistema local, integração real na Fase 2.

## O que NÃO é (anti-objetivos)

- **Não é SaaS multi-tenant.** É um produto pra Ciclo Norte, único
  cliente. Ver `DEC-CN-0001`.
- **Não é template/bot de WhatsApp.** É sistema com persistência,
  multi-role, multi-loja, roteamento dinâmico.
- **Não é editor de fluxo visual** (tipo N8N). Configuração de
  agentes é por formulário. A tela de "fluxo" é exibição, não execução.
- **Não é app da família Atendi.** Tem linhagem técnica, mas é
  produto dedicado. Atendi é pra negócios locais agendáveis
  (dentista, oficina); Ciclo Norte é empresa multi-divisão industrial.

## Personas

### Persona primária: Atendente humano

- Cadastrado pelo admin.
- Tem login/senha (auth simples, bcrypt + JWT).
- Pode estar alocado em 1 ou N lojas.
- Vê **só as conversas das lojas em que está alocado**.
- Lê e responde mensagens pelo painel PWA.
- Pode **transferir** a conversa manualmente para outra loja ou
  para outro atendente da mesma loja.
- Pode pausar/retomar a IA numa conversa específica (assumir
  controle manual).

### Persona secundária: Admin

- Cadastra atendentes e lojas.
- Aloca/desaloca atendentes em lojas.
- Configura os agentes de IA por loja (prompt, tools, knowledge).
- Vê logs/métricas de todas as lojas.
- Pode transferir conversas manualmente.

### Persona terciária: Cliente final (do Ciclo Norte)

- Manda mensagem no WhatsApp de uma das divisões.
- Não tem login no sistema.
- Interage só pelo WhatsApp.
- Vê como "Assistente [nome]" ou "[nome do atendente]".
- **Nunca percebe** quando a conversa é transferida entre lojas —
  o número de WhatsApp é o mesmo.

## Princípios de design

1. **Conversa é ativo desacoplado.** `instancia_whatsapp_id`
   (canal físico) é imutável; `loja_responsavel_id` (dono
   comercial) é mutável. Transferência é transparente pro cliente.
2. **Loja é unidade de isolamento.** Tudo que tem dados de
   cliente final tem FK em loja. Atendente vê só o que tá alocado.
3. **Configuração > código.** Cliente muda prompt, pluga tool,
   ajusta parâmetro sem deploy.
4. **Humano no loop por padrão.** IA responde o que dá, escala
   quando não dá. Humano pode pausar IA a qualquer momento.
5. **Espelhamento 1:1 + SSE.** O que o cliente vê no WhatsApp é
   exatamente o que aparece no painel, atualizado em tempo real.
6. **Multimodalidade no MVP.** IA lê texto, transcreve áudio,
   analisa imagem desde o início. Não é feature premium.
7. **Rastro de auditoria.** Toda mensagem, transferência e
   tool-call é logada com autor, timestamp, e contexto.

## Stack tecnológica (fechada)

| Camada | Tecnologia | Notas |
|---|---|---|
| Backend | Go 1.23+ | `MOD-core`, `MOD-agents`, `MOD-ai-gateway`, `MOD-messaging` |
| Frontend | Next.js 15 + Tailwind 4 | PWA responsivo, SSE |
| Banco | Postgres 16 | Docker Compose, WAL |
| Auth | bcrypt + JWT | Simples no MVP, migração Kratos na Fase 2 se necessário |
| WhatsApp | Evolution API v2.3.x | Self-hosted, 1 instância por loja |
| LLM | OpenAI gpt-4o-mini | Via `MOD-ai-gateway` |
| Tempo real | SSE (Server-Sent Events) | Fallback pra polling se SSE falhar |
| Deploy | VM existente (192.168.15.97) no MVP | VPS dedicada na produção |

## Métricas de sucesso (MVP)

- Atendente responde 80% das perguntas do catálogo sem precisar
  escalar pro humano.
- Transferência automática acerta >90% das vezes (via análise de
  intenção da IA Principal).
- Atendente gasta <2min pra responder manualmente quando escala.
- Cliente recebe resposta em <30s (IA) ou <5min (humano).
- Zero "vazamento" — conversa da loja A nunca aparece pra
  atendente alocado só na loja B.
- Conversa transferida manualmente reflete em <2s no painel
  do atendente destino (via SSE).

> Ajustar com dados reais após MVP rodar.

## Linhagem técnica

- `MOD-advanced-atendimento-ia-whatsapp` — referência de integração
  WhatsApp+IA, mas não é reuso direto (modelagem diferente).
- `MOD-agents` — reuso direto pro time de agentes + multimodalidade.
- `MOD-auth` — **não reuso direto no MVP** (usa auth simples).
  Migração planejada pra Fase 2.
- `MOD-ai-gateway` — reuso direto (quita débito do openai_adapter.go).
- `MOD-messaging` — reuso direto pro WhatsApp.
- `MOD-ui` — reuso parcial (tokens visuais, componentes base).
- `MOD-core` — reuso trivial (config, log, HTTP).
- `MOD-files` — reuso eventual (mídia do WhatsApp).

> Detalhe em `docs/09-debitos-da-fundacao.md`.

## Próximas seções

- `02-modelo-de-dados.md` — entidades, FKs, schema desacoplado.
- `03-roles-e-multi-loja.md` — quem vê o quê, transferência.
- `04-agentes-de-ia.md` — time de agentes, multimodalidade, tools.
