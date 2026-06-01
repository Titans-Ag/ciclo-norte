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

