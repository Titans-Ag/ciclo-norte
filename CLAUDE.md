# Ciclo Norte — Diretrizes da Sprint Longa

> Criado em 2026-06-01. Este arquivo é a fonte da verdade para esta sessão
> de implementação contínua. Se o contexto for compactado, recarregue este
> arquivo antes de continuar.

## Objetivo único

Construir o MVP do Ciclo Norte até estar **rodando na VPS**
(192.168.15.97) e acessível pelo navegador. Não parar antes disso.

## O que foi decidido (irreversível nesta sprint)

- 2 lojas: Vendas, Locação (slug: `vendas`, `locacao`).
- Auth simples: bcrypt + JWT (sem Kratos no MVP).
- Banco: Postgres 16 via Docker Compose na mesma VM.
- Frontend: Next.js 15 + Tailwind 4, PWA responsivo.
- Tempo real: SSE (Server-Sent Events).
- LLM: OpenAI gpt-4o-mini via `MOD-ai-gateway`.
- WhatsApp: Evolution API v2.3.x self-hosted (já roda na VM).
- 1 instância Evolution por loja (número dedicado).
- Integração ERP: simulada via subsistema local (tabelas produtos/estoque).
- Deploy: VM existente (192.168.15.97).
- Derrubar na VPS: apps `atendi-dentista` e `atendi-oficina`. Manter Evolution.

## Decisões operacionais tomadas (anotar no REVISAO_SPRINT.md)

Se travar em algo não decidido, **tome a decisão, implemente, e anote**
no `REVISAO_SPRINT.md` com timestamp. Não parar para perguntar.

Exemplo de formato:
```
[2026-06-01 14:30] DECISÃO: Usei porta 8085 pro backend porque 8080/8090/8091 estavam ocupados.
MOTIVO: Evitar conflito com Evolution e apps legados.
```

## Anti-padrões proibidos

- Não commitar/pushar na branch `main` do monorepo Titans.
- Não mergear em `main` de nenhum repo.
- Não editar `.env` real sem confirmar com operador (mas pode criar `.env.example`).
- Não rodar `rm -rf` sem confirmação do operador.
- Não parar no meio — a meta é a aplicação rodando na VPS.

## Checkpoints obrigatórios antes de declarar "pronto"

1. Backend Go compila (`go build`) e roda sem panic.
2. Frontend Next.js builda (`next build`) sem erro.
3. Postgres está up com migrations aplicadas.
4. Evolution instâncias criadas e conectadas.
5. 2 lojas seedadas no banco.
6. Admin seedado (email/senha).
7. Backend e frontend rodando na VPS.
8. Login funciona.
9. Conversa WhatsApp chega no painel.
10. IA responde automaticamente.

## Próxima ação após esta leitura

Se você (IA) está lendo este arquivo após compactação de contexto:
1. Leia o `REVISAO_SPRINT.md` para ver decisões tomadas.
2. Continue da última task marcada como completa.
3. Se não souber onde parou, execute `cortex_wake` ou cheque git status.
