# BRIEF — Ciclo Norte

> Briefing original (2026-06-01), atualizado com decisões de revisão
> estratégica. Linguagem informal preservada onde relevante.

## Cliente

- **Nome:** Ciclo Norte
- **Tipo:** Empresa com múltiplas divisões (locação de ferramentas,
  vendas, manutenção de equipamentos).
- **Contexto:** Empresa em crescimento. Procuraram primeiro outro
  profissional, que ofereceu um template de N8N. **Não resolve** —
  template pronto trava a evolução.
- **Pedido específico:** IA de atendimento, mas não um bot simples —
  um sistema que vai crescer junto com eles (integração com ERP/R&P
  interno, financeiro, etc.).

## O que eles precisam (na voz do Filipe)

1. **Sistema com login e senha.** Cada atendente tem conta própria.
2. **Plataforma, não template.** A ideia é que a gente venda mais
   coisas pra eles depois (financeiro, manutenção). O atendimento
   é a porta de entrada.
3. **Atendentes podem ser realocados** entre divisões (vendas ↔
   locação ↔ manutenção) sem perder histórico, sem criar conta nova.
4. **WhatsApp espelhado** na web — exatamente como funciona no
   atendi-dentista: o atendente vê a conversa do cliente final,
   responde pelo painel, e a mensagem sai pelo WhatsApp.
5. **Time de agentes de IA**, não um agente só:
   - 1 agente **Principal** (multimodal — texto, áudio, imagem).
   - N agentes **de Apoio** (provedores de dados estruturados:
     catálogo, preços, estoque).
   - Principal delega pros de apoio via tool-calls.
6. **Configuração dos agentes pela interface** — prompt, tools,
   knowledge, parâmetros. **NÃO é editor de fluxo visual tipo N8N.**
   É formulário. O "fluxo" é só uma tela de exibição.
7. **Cada divisão/loja tem seu próprio número de WhatsApp.** Por
   baixo, cada loja joga conversa num banco e tem sua própria IA.
8. **Label claro de quem falou:**
   - Humano: "**Filipe**" em negrito + mensagem.
   - IA: "**Assistente tal**" + resposta.
9. **Roteamento dinâmico** — IA deve conseguir transferir a conversa
   pra outra loja se identificar que o cliente tá falando do assunto
   errado. Atendente também deve conseguir transferir manualmente.

## Anti-objetivos (coisas que NÃO estamos fazendo)

- Não é SaaS multi-tenant. É pra Ciclo Norte, ponto.
- Não é editor visual de fluxo (drag-and-drop, condicionais,
  fallbacks). É configuração por formulário.
- Não é N8N. Não é template.
- Não é app da família Atendi.

## Decisões Arquiteturais Fechadas (Revisão 2026-06-01)

| # | Decisão | Valor |
|---|---|---|
| D1 | Lojas no MVP | 2 (Vendas, Locação) |
| D2 | Auth | Simples (bcrypt + JWT). Migração Kratos na Fase 2 se necessário. |
| D3 | Banco de dados | Postgres via Docker Compose |
| D6 | Integração ERP | Simulada via subsistema local/banco de dados populado. Integração real na Fase 2. |
| D9 | Frontend | Next.js 15 + Tailwind 4, PWA responsivo |
| D10 | Tempo real | SSE (Server-Sent Events) |
| D5 | Tool de apoio | Função Go direta (não LLM) |
| D4 | Alocação | Manual (admin clica e move) |
| D8 | Mídia WhatsApp | Recebe texto/imagem/áudio; envia só texto (MVP). Áudio transcrito pela IA. |
| D12 | Modelo LLM | gpt-4o-mini |
| D11 | Deploy | VM existente no MVP, VPS dedicada na produção |

## Perguntas em aberto (resumo; ver `docs/07-decisoes-abertas.md`)

- LGPD: base legal, retenção, direito de eliminação (documentar, não implementar no MVP).
- Quantos atendentes por loja? (impacta alocação e performance).
- Números WhatsApp reais: já existem? Precisa comprar? (impacta infra).
- Quem é o admin inicial? (Filipe ou alguém do Ciclo Norte?)
