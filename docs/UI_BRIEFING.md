# Briefing Completo — Ciclo Norte App (WhatsApp AI Attendant)

## 1. O que é o produto

O **Ciclo Norte** é uma plataforma de atendimento ao cliente via WhatsApp com IA para uma empresa de aluguel e venda de ferramentas e equipamentos de construção.

**Fluxo real:**
1. Cliente manda mensagem no WhatsApp Business da empresa
2. A mensagem chega via webhook da Evolution API para o backend Go
3. O backend salva a mensagem e dispara SSE (Server-Sent Events)
4. Se o status da conversa for `ia_ativa`, a IA (OpenAI gpt-4o-mini) responde automaticamente
5. A resposta da IA é salva no banco, broadcast via SSE, e enviada de volta para o WhatsApp do cliente
6. O atendente humano pode acessar o app web, ver as conversas em tempo real, assumir conversas, responder, transferir entre lojas

**Não é SaaS.** É single-tenant, single-customer. Um único cliente (Ciclo Norte) com múltiplas lojas (Vendas, Locação).

---

## 2. Quem usa

| Persona | O que faz no app |
|---------|-----------------|
| **Admin** | Configura lojas, atendentes, agente IA, fluxo, instâncias WhatsApp. Vê tudo. |
| **Atendente** | Vê conversas das lojas alocadas. Responde clientes. Assume/devolve/resolve/transferir conversas. |

---

## 3. Stack Técnica

| Camada | Tecnologia |
|--------|-----------|
| Frontend | Next.js 15 (App Router), React 19, TypeScript, Tailwind CSS v4 |
| Backend | Go 1.23, chi router, pgx (PostgreSQL) |
| IA | OpenAI gpt-4o-mini (com function calling/tools) |
| WhatsApp | Evolution API v2.3.7 (self-hosted no Docker) |
| DB | PostgreSQL 16 (Docker na mesma VPS) |
| Deploy | VPS local (192.168.15.97), frontend servido por Python serve.py na porta 3002, backend Go na 8085 |
| Auth | JWT via localStorage, tokens passados via Header `Authorization: Bearer xxx` |
| SSE | Server-Sent Events para updates em tempo real + polling fallback |

**Limitações críticas do frontend:**
- `output: "export"` (static export) — **não pode usar SSR, API routes, ou rewrites em produção**
- PWA: manifest.json + service worker para instalação mobile
- Todas as chamadas API são client-side via `fetch()`

---

## 4. Telas / Rotas Atuais

### `/login`
- Form simples: email + senha
- Armazena token JWT no localStorage (`cn_token`)
- Redireciona para `/conversations`

### `/conversations` (tela principal)
- **Lista de conversas** em cards verticais
- Cada card mostra: avatar (inicial do nome), nome do cliente, telefone, status (badge), preview da última mensagem, nome da loja, tempo relativo ("há 2 min")
- **Filtros**: por status (todos, ia_ativa, humano, transferida, resolvida) e por loja
- **Busca**: por nome, telefone ou conteúdo de mensagem
- **SSE status**: indicador Online/Polling/Offline no header
- Botão "Atualizar" para forçar refresh

### `/conversations/chat?id={uuid}`
- **Chat em tempo real** com um cliente específico
- Mensagens do cliente à esquerda (cinza), IA à direita (amarelo/amarelo-pálido), humano à direita (azul)
- Suporte multimodal: texto, imagem (lightbox), áudio (player customizado), vídeo (native controls), documento (download)
- **Ações rápidas**: Assumir, Devolver, Transferir (modal com select de loja), Resolver
- **SSE**: recebe `nova_mensagem`, `status_change`, `transfer` em tempo real
- Input de texto + botão enviar

### `/admin`
- **Painel administrativo** com tabs:
  - **Lojas**: CRUD de lojas (nome, tipo: vendas/locação/manutenção, endereço, telefone)
  - **Atendentes**: CRUD de atendentes (nome, email, role admin/atendente) + alocação por loja (toggle)
  - **Agente IA**: Configuração do agente (nome, prompt do sistema, modelo, temperatura, tools)
  - **Fluxo**: Diagrama SVG estático mostrando Agente Principal → agentes de apoio (catálogo, preços, estoque)
  - **WhatsApp**: Lista de instâncias com status (conectada/conectando/desconectada) + botão reconectar

---

## 5. Design System Atual (Industrial)

A outra IA implementou um design system chamado "Industrial" com estas cores:

```
--industrial-black: #1A1A1A
--industrial-dark: #2D2D2D
--industrial-gray: #4A4A4A
--industrial-medium: #8A8A8A
--industrial-light: #B0B0B0
--industrial-pale: #E8E8E8
--industrial-surface: #F5F5F5
--industrial-white: #FFFFFF
--industrial-yellow: #F5C518      (cor primária — amarelo ferramenta)
--industrial-yellow-pale: #FFF8E1
--industrial-yellow-dark: #C29A10
--industrial-blue: #2563EB
--industrial-blue-pale: #EFF6FF
--industrial-green: #16A34A
--industrial-green-pale: #F0FDF4
--industrial-orange: #EA580C
--industrial-orange-pale: #FFF7ED
--industrial-red: #DC2626
--industrial-red-pale: #FEF2F2
```

**Componentes existentes:**
- `IndustrialButton` — botão com variantes (primary, secondary, ghost, dark) e ícone opcional
- `IndustrialCard` — card com borda e sombra
- `ConversationCard` — card de conversa com avatar, status badge, preview
- `StatusBadge` — badge de status com cores (ia_ativa=amarelo, humano=azul, transferida=laranja, resolvida=verde)
- `AudioPlayer`, `ImageLightbox` — multimodal

**Tipografia:** Inter (Google Fonts)

**Sombras:**
- `shadow-industrial`: `0 1px 3px rgba(0,0,0,0.08), 0 1px 2px rgba(0,0,0,0.04)`
- `shadow-industrial-md`: `0 4px 6px rgba(0,0,0,0.05), 0 2px 4px rgba(0,0,0,0.03)`
- `shadow-industrial-lg`: `0 10px 15px rgba(0,0,0,0.06), 0 4px 6px rgba(0,0,0,0.04)`

---

## 6. Estado Atual (O que funciona vs o que não)

### ✅ Funcionando
- Login/logout JWT
- Receber mensagens do WhatsApp → aparecem no app em tempo real (SSE)
- Atendente envia mensagem do app → chega no WhatsApp do cliente (via Evolution API)
- IA responde automaticamente → resposta chega no WhatsApp do cliente
- Lista de conversas com filtros
- Chat com histórico e multimodal
- Admin completo (CRUD lojas, atendentes, config IA, WhatsApp)
- PWA instalável
- Mobile-first responsivo

### ❌ Problemas conhecidos
- **O app está com scroll estranho desde a adição da navbar** — o layout que era fixo (h-screen) agora tem scroll duplo porque a navbar adicionou altura e o container principal não ajustou
- **O admin não tem botão de voltar** — quando entra no admin, não tem navegação clara para voltar às conversas
- **O visual está "quadradão"** — o operador acha que o design está muito pesado, blocos grandes, falta refinamento visual
- **A lista de conversas precisa de mais controle** — ordenação, agrupamento, ações em massa
- **Menu de contexto** foi implementado mas pode ser melhor (aparece em hover, não é ideal para touch)

---

## 7. Modelo de Dados (simplificado)

**Conversa:**
- `id`, `cliente_telefone`, `cliente_nome`, `status` (ia_ativa|humano|transferida|resolvida)
- `loja_responsavel_id`, `agente_principal_id`, `atendente_id`
- `ultima_msg_em`, `iniciada_em`, `transferida_em`

**Mensagem:**
- `id`, `conversa_id`, `autor_tipo` (cliente|agente|atendente)
- `autor_id`, `autor_nome`, `conteudo`, `midia_tipo`, `midia_url`
- `enviada_em`, `created_at`

**Loja:**
- `id`, `slug`, `nome`, `tipo` (vendas|locacao|manutencao), `endereco`, `telefone`

**Atendente:**
- `id`, `email`, `nome`, `role` (admin|atendente), `senha_hash`
- Relação N:N com loja via `atendente_loja`

**Instância WhatsApp:**
- `id`, `nome`, `evolution_instance_name`, `numero_telefone`, `status`

---

## 8. API Endpoints Relevantes

| Endpoint | Uso |
|----------|-----|
| `POST /api/auth/login` | Login |
| `GET /api/me` | Dados do usuário logado |
| `GET /api/conversations` | Lista conversas |
| `GET /api/conversations/{id}` | Detalhe + mensagens |
| `POST /api/conversations/{id}/messages` | Enviar mensagem |
| `POST /api/conversations/{id}/assumir` | Atendente assume |
| `POST /api/conversations/{id}/devolver` | Devolve para IA |
| `POST /api/conversations/{id}/resolve` | Marcar como resolvida |
| `GET /api/events?token=xxx` | SSE stream |
| `GET /api/events/poll?token=xxx` | Polling fallback |
| `GET /api/lojas` | Lista lojas |
| `GET /api/atendentes` | Lista atendentes |
| `GET/PUT /api/admin/agent-config` | Config da IA |
| `GET /api/admin/whatsapp-status` | Instâncias WhatsApp |

---

## 9. Requisitos do Operador (Filipe)

1. **O app não pode ter scroll duplo** — a lista de conversas e o chat devem ser áreas scrolláveis dentro de um layout fixo, não o body inteiro
2. **Navegação clara** — deve ser óbvio como ir de Conversas → Chat → Admin e voltar
3. **Visual refinado, não "quadradão"** — menos blocos pesados, mais respiro, espaçamento elegante, tipografia hierárquica
4. **Mobile-first** — a maioria dos atendentes vai usar no celular. O app deve ser instalável como PWA e funcionar bem em telas pequenas
5. **Ações de conversa** — reabrir, excluir, arquivar, assumir devem ser acessíveis e intuitivas
6. **Ordenação e filtros** — controle sobre como as conversas aparecem
7. **Cores industriais** — manter a paleta amarelo/preto/cinza que foi definida, mas aplicar com mais refinamento

---

## 10. Contexto da IA que vai fazer o design

A outra IA deve saber:
- O projeto está em `/Users/filipe/Oficina/projetos/titans/apps/ciclo-norte/web/`
- `npm run build` gera static export em `web/dist/`
- O deploy é via SCP para VPS (não use Vercel/Netlify)
- Tailwind CSS v4 usa `@import "tailwindcss"` em `globals.css` (não `@tailwind directives`)
- Todos os componentes devem ser em `web/src/components/`
- Páginas em `web/src/app/{rota}/page.tsx`
- Hooks compartilhados em `web/src/hooks/`
- Tipos em `web/src/types/index.ts`
- O operador é solo-dev, constrói tudo sozinho, prefere simplicidade radical
- Não deve quebrar funcionalidades existentes — o SSE, o chat, o envio de mensagens, tudo deve continuar funcionando
