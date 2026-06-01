# 05 — WhatsApp e Roteamento

> **Status:** Especificação consolidada pós-revisão estratégica.
> Instância WhatsApp desacoplada da responsabilidade comercial.
> Evolution API v2.3.x self-hosted, multi-instance.

## Arquitetura de entrada

```
Cliente final (WhatsApp)
    |
    v
Número da Loja X (WhatsApp Business)
    |
    v
Evolution API self-hosted (container Docker, porta 8080)
    |
    v
Webhook POST /webhook/evolution (backend Go Ciclo Norte)
    |
    v
Identifica instância → recupera conversa →
verifica loja_responsavel → invoca agente da loja responsável
```

## Conceito-chave: Desacoplamento

A entidade `conversa` tem **duas chaves estrangeiras distintas**:

| Campo | Mutabilidade | Significado |
|---|---|---|
| `instancia_whatsapp_id` | **IMUTÁVEL** | Canal físico. Número de telefone por onde a mensagem chega. |
| `loja_responsavel_id` | **MUTÁVEL** | Dono comercial. Quem deve responder agora. |

**Exemplo prático:**

1. Cliente manda mensagem no número de **Vendas**.
2. Mensagem chega via webhook da instância `ciclo-norte-vendas`.
3. `instancia_whatsapp_id` = `vendas` (sempre).
4. Se conversa é nova, `loja_responsavel_id` = `vendas` (inicial).
5. IA Principal de Vendas identifica que cliente quer **locar**.
6. Tool-call `transferir_setor("locacao")`.
7. Backend: `UPDATE conversa SET loja_responsavel_id = 'locacao'`.
8. Próxima mensagem do cliente chega pela mesma instância
   `vendas`, mas agora é processada pela IA Principal de **Locação**.
9. Cliente nunca percebe — continua no mesmo número de WhatsApp.

## Multi-instância Evolution

### O que é

Cada loja tem **seu próprio número de WhatsApp** e, portanto,
sua própria instância no Evolution API.

**MVP:**
- `ciclo-norte-vendas` → número de Vendas
- `ciclo-norte-locacao` → número de Locação

**Futuro:**
- `ciclo-norte-manutencao` → número de Manutenção
- Pode ter múltiplas instâncias por loja (ex: SP e RJ).

### Container Evolution

Na VM (192.168.15.97), Evolution roda como container Docker único
na porta 8080. Todas as instâncias vivem dentro do mesmo container
(multi-instance).

- Cada instância criada via API do Evolution (`POST /instance/create`).
- Cada instância conectada ao WhatsApp via scan QR.
- Backend gerencia N instâncias via nome da instance.

### Criação de instâncias (MVP)

**Processo manual pelo admin:**

1. Admin acessa painel do Evolution (`http://vm:8080/manager`).
2. Cria instância com nome `ciclo-norte-vendas`.
3. Scaneia QR com número de telefone da loja.
4. Repete para `ciclo-norte-locacao`.
5. Registra em `instancia_whatsapp` no banco do Ciclo Norte.

**Fase 2:** automatizar criação via API do Evolution.

## Webhook — como identifica instância e loja

### Payload do Evolution v2.3.x

O webhook envia (simplificado):

```json
{
  "event": "messages.upsert",
  "instance": "ciclo-norte-vendas",
  "data": {
    "key": {
      "remoteJid": "5511999999999@s.whatsapp.net",
      "id": "MESSAGE_ID_WHATSAPP"
    },
    "message": {
      "conversation": "Oi, vocês têm furadeira?"
    },
    "messageTimestamp": 1717300000,
    "pushName": "João Silva"
  }
}
```

### Passo a passo do roteamento

1. **Webhook chega** com payload acima.
2. **Extrai `instance`** → `"ciclo-norte-vendas"`.
3. **Busca** `instancia_whatsapp` por `evolution_instance_name`.
4. **Obtém** `instancia_whatsapp_id`.
5. **Extrai** `remoteJid` → `5511999999999` (telefone do cliente).
6. **Busca conversa** por `(instancia_whatsapp_id, cliente_telefone)`.
   - Se achar → usa `loja_responsavel_id` da conversa existente.
   - Se não achar → cria nova com `loja_responsavel_id = instancia.loja_id`.
7. **Salva mensagem** do cliente:
   - `autor_tipo = 'cliente'`
   - `autor_nome = pushName` (ou número se null)
   - `whatsapp_msg_id = key.id`
8. **Recupera agente principal** da `loja_responsavel_id`.
9. **Invoca agente** (ver `04-agentes-de-ia.md`).

### Dedupe

```sql
INSERT INTO mensagem (conversa_id, autor_tipo, autor_nome,
  conteudo, whatsapp_msg_id, ...)
VALUES (...)
ON CONFLICT (whatsapp_msg_id) DO NOTHING;
```

Se `whatsapp_msg_id` já existe → ignora (webhook duplicado
pelo Evolution). Loga e segue.

## Saída (enviar mensagem pro cliente)

### Quem pode enviar

- **IA Principal** — resposta automática.
- **Atendente humano** — escreveu no painel PWA.

### Como envia

1. Backend recebe `POST /api/conversations/{id}/messages` com
   `conteudo` e `autor_tipo = 'humano'`.
2. Salva mensagem no banco.
3. Determina `instancia_whatsapp_id` da conversa (sempre o
   canal físico original, nunca muda).
4. Chama Evolution API:
   ```
   POST /message/sendText/{instance}
   Body: { "number": "5511999999999", "text": "Olá! ..." }
   ```
5. Evolution entrega pro WhatsApp do cliente.
6. Quando Evolution confirma, atualiza status.
7. Emite SSE para atendentes da `loja_responsavel_id`.

### Ordem garantida

Backend processa mensagens por conversa em ordem FIFO.
Mensagem do humano sempre depois da última mensagem conhecida.
Se cliente enviou msg enquanto humano digitava, humano vê
a msg do cliente antes de enviar a sua.

## Mídia — recebimento e envio

### Recebimento (MVP completo)

| Tipo | Salvamento | Processamento |
|---|---|---|
| **Texto** | `conteudo` | Direto pro LLM |
| **Imagem** | `midia_url` + `descricao_imagem` | Vision API (`gpt-4o` mini vision) descreve conteúdo. Descrição vai pro LLM. |
| **Áudio** | `midia_url` + `transcricao` | STT (Whisper API ou `gpt-4o` audio) transcreve. Transcrição vai pro LLM. |
| **Documento** | `midia_url` | Salva URL. Não processa conteúdo no MVP. |
| **Vídeo** | `midia_url` | Salva URL. Não processa no MVP. |

### Envio (MVP)

| Tipo | Quem pode | Como |
|---|---|---|
| **Texto** | IA e Humano | ✅ Evolution API `sendText` |
| **Imagem** | Ninguém | ❌ Não no MVP |
| **Áudio** | Ninguém | ❌ Não no MVP (humano manda texto) |
| **Documento** | Ninguém | ❌ Não no MVP |

**Fase 2:**
- Humano envia imagem (upload no PWA → `MOD-files` → Evolution).
- IA envia imagem do catálogo (com link).
- Humano grava áudio no PWA.

## Estados de conexão WhatsApp

| Estado | Significado | Ação |
|---|---|---|
| `connecting` | Instância criada, QR não scaneado | Aguardar scan |
| `connected` | WhatsApp conectado, funciona | ✅ Normal |
| `disconnected` | Perdeu conexão (telefone sem internet) | Retry automático, notificar admin |
| `destroyed` | Instância removida | Recriar |

Backend verifica estado antes de enviar. Se `disconnected`:
- Fila mensagem em memória (ou Redis futuro).
- Retry a cada 30s.
- Se >5 min desconectado, notifica admin.

## Tela de status (painel admin)

Admin vê estado de cada instância:

| Instância | Número | Estado | Ação |
|---|---|---|---|
| ciclo-norte-vendas | +55 11 9999-9999 | 🟢 connected | — |
| ciclo-norte-locacao | +55 11 8888-8888 | 🟢 connected | — |

Se desconectado: botão "Reconectar" (gera novo QR code).

## Rate limits e filas

- Política MVP: fila de envio por instância.
- Max 5 mensagens/segundo por instância (evitar limitação
  da Meta).
- Se exceder, fila e processa em batch.

## LGPD e retenção

- Ciclo Norte é **controlador** dos dados.
- Titans é **operador** (processa por conta deles).
- Política MVP:
  - Retenção: 2 anos (padrão comercial).
  - Acesso: admin gera relatório.
  - Eliminação: admin deleta manualmente (não MVP).
  - Consentimento: termos do WhatsApp Business já cobrem.

**Fase 2:** consultar advogado, implementar self-service.

## Próximas seções

- `06-conversa-espelhada.md` — UI PWA com SSE, multimodalidade,
  transferência manual.
