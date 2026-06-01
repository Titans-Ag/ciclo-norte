# 03 — Roles e Multi-Loja

> **Status:** Especificação consolidada pós-revisão estratégica.
> Roteamento híbrido: automático (IA) + manual (humano).

## Roles (2)

### `admin`

- **Quem:** operador da plataforma (Filipe inicialmente, depois
  alguém interno do Ciclo Norte).
- **Escopo:** global. Vê e edita tudo.
- **Pode:**
  - CRUD de atendentes.
  - CRUD de lojas.
  - Alocar/desalocar atendentes em lojas.
  - CRUD de agentes (prompt, tools, parâmetros).
  - Ver todas as conversas de todas as lojas.
  - Ver logs de eventos e transferências.
  - Transferir conversas manualmente entre lojas.
  - Configurar instâncias WhatsApp.

### `atendente`

- **Quem:** vendedor, locador, técnico.
- **Escopo:** limitado às lojas alocadas.
- **Pode, dentro das lojas alocadas:**
  - Ver conversas (`loja_responsavel_id` nas lojas dele).
  - Ler e enviar mensagens.
  - Assumir/devolver controle da IA.
  - Transferir conversa para outra loja.
  - Transferir conversa para outro atendente da mesma loja.
  - Marcar como `resolvida`.
- **NÃO pode:**
  - Editar agentes.
  - Ver conversas de loja onde não está alocado.
  - Cadastrar novos atendentes.
  - Ver eventos de execução da IA (transparente pra operação).

---

## Roteamento Híbrido

O sistema opera em **duas frentes** que coexistem e se complementam:

### 1. Automático (IA Principal)

**Como funciona:**

1. Cliente manda mensagem no WhatsApp da loja de Vendas.
2. IA Principal da loja de Vendas processa a intenção.
3. IA identifica que o cliente perguntou sobre **locação**
   (ex: "quanto custa alugar uma betoneira?").
4. IA engatilha tool-call interna: `transferir_setor("locacao")`.
5. Backend executa:
   ```sql
   UPDATE conversa
   SET loja_responsavel_id = 'uuid-locacao',
       status = 'transferida',
       transferida_em = now()
   WHERE id = 'uuid-conversa';
   ```
6. Registra em `transferencia`:
   - tipo: `automatica`
   - loja_origem: vendas
   - loja_destino: locacao
   - agente_id: principal de vendas
   - motivo: "Cliente perguntou sobre locação"
7. Emite evento SSE para atendentes alocados em Locação.
8. Conversa aparece na fila da loja de Locação.
9. Cliente final **não percebe** — continua no mesmo número de
   WhatsApp. A mensagem dele já está salva; só muda quem responde.

**Quando IA falha em identificar:**
- Responde normalmente (como se fosse da loja atual).
- Se responder errado, cliente pode reclamar → atendente humano
  assume e corrige.
- Admin pode ajustar prompt do agente depois.

**Quando IA é pausada:**
- Status muda pra `humano_assumiu`.
- IA para de processar mensagens novas nesta conversa.
- Humano pode devolver pra IA depois.

### 2. Manual (Atendente Humano)

**Transferência para outra Loja:**

1. Atendente está na conversa, clica "Transferir" → seletor de
   lojas (exclui a atual).
2. Escolhe "Locação".
3. Opcional: preenche motivo ("cliente quer alugar, não comprar").
4. Backend executa UPDATE em `conversa` (mesmo que automático).
5. Registra em `transferencia`:
   - tipo: `manual`
   - atendente_id: quem transferiu
   - motivo: preenchido pelo atendente
6. Emite SSE para ambas as lojas (origem e destino).
7. Conversa some do painel do atendente atual, aparece na fila
   da loja destino.

**Transferência para outro Atendente (mesma loja):**

1. Atendente clica "Transferir para colega" → seletor de
   atendentes alocados na mesma loja.
2. Escolhe "Maria".
3. Backend atualiza `conversa.atendente_id = 'uuid-maria'`.
4. Status continua `humano_assumiu` (ou muda pra `transferida`
   se quiser sinalizar que Maria ainda não viu).
5. SSE notifica Maria.
6. Maria vê a conversa com badge "Transferida por Fulano".

---

## Visibilidade — regras concretas

### Query: "conversas que este atendente vê"

```sql
SELECT c.*
FROM conversa c
WHERE c.loja_responsavel_id IN (
  SELECT loja_id FROM atendente_loja WHERE atendente_id = $atendente_id
)
AND c.status IN ('ia_ativa', 'humano_assumiu', 'transferida')
ORDER BY c.ultima_msg_em DESC;
```

**Importante:** usa `loja_responsavel_id` (mutável), não
`instancia_whatsapp_id` (imutável). Uma conversa pode ter sido
iniciada na instância de Vendas mas estar na responsabilidade
de Locação — e o atendente de Locação precisa vê-la.

### Query: "conversas transferidas que chegaram na minha loja"

```sql
SELECT c.*, t.created_at as transferida_em, t.motivo
FROM conversa c
JOIN transferencia t ON t.conversa_id = c.id
WHERE c.loja_responsavel_id = $minha_loja_id
AND c.status = 'transferida'
AND t.id = (
  SELECT MAX(id) FROM transferencia WHERE conversa_id = c.id
)
ORDER BY t.created_at DESC;
```

### Admin vê tudo

Admin não precisa de `atendente_loja`. Query direta por
`loja_responsavel_id`.

---

## Permissões por endpoint

| Endpoint | Método | Admin | Atendente |
|---|---|---|---|
| `/api/atendentes` | POST | ✅ | ❌ |
| `/api/atendentes` | GET | ✅ | Só da(s) sua(s) loja(s) |
| `/api/lojas` | POST | ✅ | ❌ |
| `/api/lojas/{id}/alocar` | POST | ✅ | ❌ |
| `/api/conversations` | GET | ✅ todas | Só das lojas alocadas |
| `/api/conversations/{id}` | GET | ✅ | Só se loja dele |
| `/api/conversations/{id}/messages` | POST | ✅ | Só se loja dele |
| `/api/conversations/{id}/assumir` | POST | ✅ | Só se loja dele |
| `/api/conversations/{id}/transferir` | POST | ✅ | Só se loja dele |
| `/api/conversations/{id}/transferir-atendente` | POST | ✅ | Só se loja dele |
| `/api/agentes` | GET/POST/PATCH | ✅ | ❌ |
| `/api/transferencias` | GET | ✅ | Só das lojas dele |

---

## Alocação

### Quem aloca

**Admin.** Atendente não pode se alocar/desalocar.

### Cenário "mover atendente de vendas pra locação"

1. Admin acessa perfil do atendente.
2. Clica "Alocar em loja" → escolhe "Locação".
3. INSERT em `atendente_loja`.
4. A partir desse momento, atendente vê conversas de
   **ambas** as lojas (Vendas + Locação).
5. Conversas passadas continuam visíveis (query usa
   `loja_responsavel_id` atual, não histórico).

### Cenário "tirar atendente da loja de manutenção"

1. Admin clica "Desalocar de Manutenção".
2. DELETE de `atendente_loja`.
3. Atendente perde acesso a conversas de Manutenção.
4. **Conversas que ele tava respondindo:**
   - Se `humano_assumiu` com ele como `atendente_id` → status
     muda pra `ia_ativa` (IA volta a responder).
   - Admin é notificado (log, não push no MVP).

---

## Multi-loja na UI

### Conceito: "workspace" do atendente

Quando atendente loga no PWA:

- Sidebar esquerda: lista de lojas alocadas.
- Badge com contador de conversas não lidas por loja.
- Modo "Todas" (default): conversas de todas as lojas alocadas,
  misturadas, com badge da loja no header.
- Clicou numa loja → filtra só daquela.

### Badge de transferência

Conversa transferida aparece com:
- Ícone de seta (↔) no header.
- Tooltip: "Transferida de Vendas por Fulano" (se manual) ou
  "Transferida automaticamente pela IA" (se automática).
- Cor diferente (amarelo claro) até ser assumida.

---

## Casos especiais

### "Atendente é admin de uma loja e atendente de outra?"

**Não suportado no MVP.** Role é global. Se Filipe quer ser
admin, ele é admin (vê tudo). Se precisa também atender, cria
conta separada de atendente.

### "Atendente esquece a senha?"

Fluxo de "esqueci minha senha":
1. Clica link no login.
2. Digita email.
3. Admin recebe notificação e gera senha temporária (MVP).
   Fase 2: email automático com reset token.

### "Admin cadastra atendente mas esquece de alocar?"

Atendente loga, vê tela vazia com mensagem: "Você não está
alocado em nenhuma loja. Fale com o administrador."

## Próximas seções

- `04-agentes-de-ia.md` — como os agentes executam transferências
  e multimodalidade.
- `05-whatsapp-e-roteamento.md` — instância desacoplada.
