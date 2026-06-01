# 07 — Decisões Abertas

> **Status:** Pós-consolidação estratégica (2026-06-01).
> Decisões D1, D2, D3, D6, D9, D10, D4, D5, D8, D11, D12 FECHADAS.
> Restam D7 (LGPD) e questões operacionais.

---

## ✅ DECIDIDAS (consolidadas na revisão)

### D1 — Quantas lojas no MVP?
**Valor:** 2 (Vendas + Locação).
**Justificativa:** Homologa roteamento dinâmico sem pesar o escopo.
Manutenção entra na Fase 2.

### D2 — Auth: Kratos ou simples?
**Valor:** Simples (bcrypt + JWT) no MVP.
**Justificativa:** Agiliza PWA. Migração para Kratos (`MOD-auth`)
planejada para Fase 2 se necessário.

### D3 — Banco de dados
**Valor:** Postgres via Docker Compose.
**Justificativa:** Suporte a leituras/escritas concorrentes de
múltiplos vendedores. SQLite não segura simultaneidade de
atendentes.

### D4 — Alocação: manual ou automatizada?
**Valor:** Manual (admin clica e move).
**Justificativa:** Atende ao caso de uso descrito pelo Filipe.
Sem data_fim no MVP.

### D5 — Tool apoio: função Go ou LLM?
**Valor:** Função Go direta.
**Justificativa:** Determinístico, rápido, barato. Consultas SQL
não precisam de inteligência linguística. Apenas Principal usa LLM.

### D6 — Integração ERP
**Valor:** Simulada via subsistema local/banco populado.
**Justificativa:** Evita dependência de API legada no MVP. Prova
valor da plataforma. Integração real na Fase 2.

### D8 — Mídia no WhatsApp
**Valor:**
- Receber: texto ✅, imagem ✅ (com descrição IA), áudio ✅
  (com transcrição STT), documento ✅ (salva URL).
- Enviar: texto ✅. Mídia ❌ (humano e IA).
**Justificativa:** Multimodalidade é requisito do MVP, mas envio
de mídia é feature secundária.

### D9 — Stack frontend
**Valor:** Next.js 15 + Tailwind 4, PWA responsivo.
**Justificativa:** Alinhado com `MOD-app-web`. Sem NativeWind
(não há app mobile nativo no MVP — PWA cobre).

### D10 — Tempo real
**Valor:** SSE (Server-Sent Events).
**Justificativa:** Unidirecional (server → client), nativo HTTP,
simples de implementar. Fallback para polling 5s se SSE falhar.

### D11 — Deploy
**Valor:** VM existente (192.168.15.97) no MVP.
**Justificativa:** Infra já pronta com Evolution. VPS dedicada
na produção real.

### D12 — Modelo LLM
**Valor:** gpt-4o-mini via `MOD-ai-gateway`.
**Justificativa:** Custo baixo (~$0.0004/interação), qualidade
suficiente. Fácil trocar depois.

---

## ⏳ EM ABERTO

### D7 — LGPD

| Aspecto | Decisão pendente | Recomendação |
|---|---|---|
| **Base legal** | Contrato de prestação de serviço? Legítimo interesse? | Documentar como "contrato de prestação" (Ciclo Norte contratou Titans). |
| **Retenção** | Quanto tempo guardar mensagens? | **2 anos** com arquivamento proativo. Confirmar com advogado. |
| **Direito de acesso** | Cliente final pode pedir cópia? | MVP: admin gera relatório. Fase 2: self-service. |
| **Direito de eliminação** | Cliente final pode pedir pra apagar? | MVP: admin deleta manualmente. Fase 2: automatizar. |
| **Consentimento** | Precisa de opt-in no WhatsApp? | WhatsApp Business já tem termos. Verificar se precisa cláusula adicional no contrato Ciclo Norte. |
| **Notificação de vazamento** | Processo se houver breach? | Documentar. Não implementar no MVP. |

**Recomendação:** Documentar política de privacidade básica
no README. Não implementar mecanismos de self-service no MVP.
Consultar advogado na Fase 2.

### D13 — Números WhatsApp reais

**Pergunta:** Os números de WhatsApp para Vendas e Locação
já existem? São números de telefone existentes do Ciclo Norte
ou precisam ser adquiridos?

**Impacto:** Se são números existentes com histórico de conversas,
precisamos considerar:
- Backfill de mensagens antigas? (Não no MVP)
- Número já tem WhatsApp Business API? (Se não, precisa migrar)
- Quem tem o celular com o QR code? (Precisa scanear para conectar
  ao Evolution)

**Recomendação:** Confirmar com Ciclo Norte antes de iniciar
configuração do Evolution.

### D14 — Quantos atendentes por loja no MVP?

**Pergunta:** Quantos atendentes humanos vão usar o sistema
inicialmente?

**Impacto:** Define se precisamos de otimizações de performance
ou se 2-3 atendentes por loja são suficientes para testar.

**Recomendação:** Assumir 2-3 atendentes por loja no MVP
(4-6 total). Escalar conforme adoção.

### D15 — Admin inicial

**Pergunta:** Quem é o admin inicial? Filipe configura tudo
ou alguém do Ciclo Norte?

**Impacto:** Se Filipe é admin, ele faz onboarding. Se é
alguém do Ciclo Norte, precisa de treinamento/documentação.

**Recomendação:** Filipe como admin inicial. Cria conta de
admin no seed do banco.

---

## Resumo por status

| # | Decisão | Status |
|---|---|---|
| D1 | Lojas no MVP (2) | ✅ FECHADA |
| D2 | Auth (bcrypt + JWT) | ✅ FECHADA |
| D3 | Banco (Postgres Docker) | ✅ FECHADA |
| D4 | Alocação (manual) | ✅ FECHADA |
| D5 | Tool apoio (função Go) | ✅ FECHADA |
| D6 | Integração ERP (simulada) | ✅ FECHADA |
| D7 | LGPD | ⏳ EM ABERTO |
| D8 | Mídia (recebe tudo, envia texto) | ✅ FECHADA |
| D9 | Frontend (Next.js 15 + TW4 PWA) | ✅ FECHADA |
| D10 | Tempo real (SSE) | ✅ FECHADA |
| D11 | Deploy (VM existente) | ✅ FECHADA |
| D12 | Modelo LLM (gpt-4o-mini) | ✅ FECHADA |
| D13 | Números WhatsApp | ⏳ EM ABERTO |
| D14 | Quantidade de atendentes | ⏳ EM ABERTO |
| D15 | Admin inicial | ⏳ EM ABERTO |

**Bloqueantes para implementação:** Nenhum. Todas as decisões
estratégicas estão fechadas. Os itens em aberto são operacionais
(LGPD documentação, números de telefone, treinamento).

## Próximas seções

- `08-escopo-mvp.md` — escopo consolidado.
- `09-debitos-da-fundacao.md` — o que reusa com decisões fechadas.
