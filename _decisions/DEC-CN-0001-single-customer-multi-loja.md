---
id: DEC-CN-0001
title: Ciclo Norte é single-customer, multi-loja interno, com roteamento dinâmico de conversas
status: active
created: 2026-06-01
updated: 2026-06-01
decided_by: PER-filipe
tags:
  - ciclo-norte
  - arquitetura
  - tenancy
  - roteamento
  - decisao
related:
  - ADR-0092
  - PRD-atendi
---

# DEC-CN-0001 — Ciclo Norte: Single-Customer, Multi-Loja, Roteamento Dinâmico

## Contexto

O cliente é **Ciclo Norte**, uma empresa com divisões de **locação de
ferramentas**, **vendas** e **manutenção de equipamentos**. A modelagem
inicial pensada foi "SaaS multi-tenant". Após conversa de briefing,
Filipe corrigiu:

> "Não é um sass. É para uma única empresa. [...] Ele não é multi-tenant,
> mas a gente precisa criar um cadastro [...] fácil, por exemplo, pegar
> um atendente da área de vendas e jogar ele pra parte de locação."

Posteriormente, em revisão estratégica (2026-06-01), foram fechadas
as diretrizes de arquitetura: PWA responsiva, roteamento híbrido
(automatizado pela IA + manual pelo atendente), conversa como ativo
desacoplado do canal físico, e multi-agente com multimodalidade no MVP.

## Decisão

### 1. Single-customer

- **UM cliente:** Ciclo Norte. Não há cadastro de "empresa" como entidade
de primeiro nível. Não há cobrança por empresa, não há onboarding de
novos clientes.

### 2. Multi-loja como agregado interno

"Loja" é a unidade de isolamento. Cada loja tem:
- 1 número de WhatsApp dedicado (instância Evolution API).
- 1 conjunto de agentes de IA.
- 1 conjunto de conversas sob sua responsabilidade (mutável).
- 1 conjunto de atendentes alocados.

### 3. Conversa como ativo desacoplado

A entidade `conversa` é **desacoplada do canal físico de entrada**:

- **`instancia_whatsapp_id`** — **imutável**. Identifica a instância
  Evolution (e o número de telefone) por onde a mensagem trafega
  com o cliente final. Nunca muda para uma conversa.
- **`loja_responsavel_id`** — **mutável**. Indica qual departamento/loja
  detém o ativo comercial no momento. Pode mudar via transferência
  automática (IA) ou manual (atendente).

Isso permite que uma conversa iniciada no WhatsApp da loja de **Vendas**
seja transferida para a loja de **Locação** sem o cliente final
perceber — o número de WhatsApp continua o mesmo, mas o contexto
comercial muda de dono.

### 4. Roteamento híbrido

O sistema opera em **duas frentes**:

#### Automático (IA)
- O Agente Principal de uma loja pode identificar, via análise de
  intenção, que a pergunta do cliente pertence a outra divisão.
- Engatilha uma tool-call interna: `transferir_setor(loja_destino)`.
- O backend move `loja_responsavel_id` da conversa para a loja destino.
- A conversa aparece na fila da nova loja. Os atendentes alocados
  lá passam a vê-la.
- O cliente final **não percebe** — continua conversando no mesmo
  número de WhatsApp.
- Se a IA falhar ou for pausada, status muda para indicar que a
  conversa aguarda operador da loja atualmente responsável.

#### Manual (atendente humano)
- No painel PWA, o atendente pode transferir uma conversa:
  - **Para outra Loja** — move `loja_responsavel_id`. A conversa
    entra na fila da loja destino.
  - **Para outro Atendente** — dentro da mesma loja, repassa a
    conversa para um colega específico.

### 5. Atendentes globais, alocação N:M

- Atendentes cadastrados **uma vez** (escopo global).
- Alocados em **N lojas** via tabela `atendente_loja`.
- Alocação é **manual** (admin clica) no MVP, sem data de fim.

### 6. PWA (Progressive Web App)

- A plataforma é uma **Web App responsiva** com suporte a PWA.
- Pode ser instalada no celular/computador do atendente.
- Notificações push via Web Push (futuro) ou SSE no MVP.

## Consequências

### O que isso HABILITA

- Transferência de conversas entre divisões sem fricção pro cliente.
- IA que entende contexto e roteia inteligentemente.
- Alocação flexível de força de trabalho (mesmo atendente em N lojas).
- Fundação pra módulos futuros (financeiro, manutenção) respeitando
  fronteira por loja.

### O que isso BLOQUEIA (e está ok)

- Venda do sistema como SaaS multi-tenant pra outro cliente.
- White-label / multi-branding.
- Cobrança por empresa.

### Implicações técnicas imediatas

- **Schema:** `conversa` tem `instancia_whatsapp_id` (imutável) e
  `loja_responsavel_id` (mutável). Não há `empresa`.
- **Auth:** usuário (atendente) é global. Loja é um "scope" de acesso.
- **Roteamento:** query de conversas visíveis usa `loja_responsavel_id`,
  não `instancia_whatsapp_id`.
- **URLs/rotas:** `/ciclo-norte/<loja>/conversations/...` ou similar
  — ainda a definir.
- **Audit trail:** toda transferência (automática ou manual) é logada
  em `evento_agente` (tipo `transferencia`) ou tabela dedicada.

## Não-objetivos

- Multi-tenant SaaS.
- Cobrança por empresa.
- Onboarding self-service de clientes.
- Whitelabel / multi-branding.

## Procedência

- Conversa de briefing com Filipe (2026-06-01).
- Revisão estratégica do projeto Ciclo Norte (2026-06-01).
- Linhagem técnica: `PRD-atendi` (single-app por vertical, diferente).
- Estrutura de apps: `ADR-0092`.

## Próximos passos

- Refletir em `docs/02-modelo-de-dados.md` (schema com instancia
  desacoplada).
- Refletir em `docs/03-roles-e-multi-loja.md` (transferência manual).
- Refletir em `docs/04-agentes-de-ia.md` (tool `transferir_setor`).
- Refletir em `docs/05-whatsapp-e-roteamento.md` (instancia imutável).
