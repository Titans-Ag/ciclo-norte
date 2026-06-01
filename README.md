# Ciclo Norte — Plataforma de Atendimento Inteligente

> **Status:** Decisões estratégicas fechadas (2026-06-01). Documentação
> em fase de consolidação técnica. MVP com 2 lojas (Vendas, Locação).
>
> Apps de cliente são repos próprios dentro de `apps/` (gitignored,
> conforme `ADR-0092`).

## O que é

Plataforma PWA de atendimento via WhatsApp para **Ciclo Norte**, com:

- **Multi-loja** — Vendas, Locação, Manutenção (2 no MVP).
- **Conversa como ativo desacoplado** — canal físico (instância WhatsApp)
  imutável; responsabilidade comercial (loja) mutável via transferência.
- **Roteamento híbrido** — automático pela IA Principal (tool-call
  `transferir_setor`) + manual pelo atendente humano.
- **Time de agentes de IA por loja** — Agente Principal multimodal
  (texto, áudio, imagem) + Agentes de Apoio como provedores de dados
  estruturados via tool-calls.
- **Espelho de conversa PWA** — atendente humano escreve pelo painel,
  IA responde automaticamente, ambas com label claro de quem falou.
- **Configuração visual** — prompt, tools, knowledge, parâmetros via
  formulário (não canvas visual tipo N8N).

## Linhagem

Não é app da família Atendi (single-app de negócio local agendável).
É **produto dedicado para cliente único** construído sobre a stack
Titans. Línhagem técnica: aproveita `MOD-advanced-atendimento-ia-whatsapp`
como referência de integração WhatsApp + IA, mas modelagem própria
(multi-loja, roteamento dinâmico, multi-agente multimodal).

## Decisões Arquiteturais Fechadas

| # | Decisão | Valor |
|---|---|---|
| D1 | Lojas no MVP | 2 (Vendas, Locação) |
| D2 | Auth | Simples (bcrypt + JWT), migração Kratos na Fase 2 se necessário |
| D3 | Banco | Postgres via Docker Compose |
| D6 | Integração ERP | Simulada via subsistema local/banco de dados populado |
| D9 | Frontend | Next.js 15 + Tailwind 4, PWA responsivo |
| D10 | Tempo real | SSE (Server-Sent Events) |

## Mapa de Leitura

| Se você quer... | Leia |
|---|---|
| Entender o briefing original | `BRIEF.md` |
| Entender o produto (contexto, personas, princípios) | `docs/01-contexto-e-produto.md` |
| Entender os dados (schema, entidades, FKs) | `docs/02-modelo-de-dados.md` |
| Entender roles e transferência | `docs/03-roles-e-multi-loja.md` |
| Entender a IA (multi-agente, multimodalidade, tools) | `docs/04-agentes-de-ia.md` |
| Entender WhatsApp e roteamento desacoplado | `docs/05-whatsapp-e-roteamento.md` |
| Entender a UI PWA (chat, SSE, transferência) | `docs/06-conversa-espelhada.md` |
| Ver decisões em aberto (pós-consolidação) | `docs/07-decisoes-abertas.md` |
| Ver o que entra no MVP | `docs/08-escopo-mvp.md` |
| Ver o que reusa da Titans | `docs/09-debitos-da-fundacao.md` |
| Ver decisões crystallizadas | `_decisions/` |

## Estrutura de Pastas

```
apps/ciclo-norte/
├── README.md                          ← você está aqui
├── BRIEF.md                           ← briefing original
├── docs/
│   ├── 01-contexto-e-produto.md
│   ├── 02-modelo-de-dados.md
│   ├── 03-roles-e-multi-loja.md
│   ├── 04-agentes-de-ia.md
│   ├── 05-whatsapp-e-roteamento.md
│   ├── 06-conversa-espelhada.md
│   ├── 07-decisoes-abertas.md
│   ├── 08-escopo-mvp.md
│   └── 09-debitos-da-fundacao.md
└── _decisions/
    └── DEC-CN-0001-single-customer-multi-loja.md
```

## Próximo Passo

Revisão técnica do schema e APIs → implementação da fundação
(auth, banco, schema Go + migrations).
