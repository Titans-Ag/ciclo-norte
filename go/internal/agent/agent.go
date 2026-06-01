package agent

import (
	"bytes"
	"context"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"mime/multipart"
	"net/http"
	"time"

	"github.com/Titans-Ag/ciclo-norte/internal/config"
	"github.com/Titans-Ag/ciclo-norte/internal/conversation"
	"github.com/Titans-Ag/ciclo-norte/internal/db"
	"github.com/google/uuid"
)

// ProcessConversation processes an inbound message through the AI agent.
// It loads the active agent for the store, builds context, calls OpenAI,
// saves the agent response as a message, and optionally sends via Evolution.
func ProcessConversation(ctx context.Context, cfg *config.Config, convID uuid.UUID, inboundMsg *conversation.Mensagem) error {
	// Load conversation with store/agent context
	conv, err := conversation.GetByID(ctx, convID)
	if err != nil {
		return fmt.Errorf("agent: load conversation: %w", err)
	}

	// If conversation is not handled by IA, do nothing
	if conv.Status != "ia_ativa" {
		return nil
	}

	// Load agent principal for the store
	agente, err := conversation.GetAgentePrincipal(ctx, conv.LojaResponsavelID)
	if err != nil {
		return fmt.Errorf("agent: load agent: %w", err)
	}

	// Build recent message history (last 20)
	msgs, err := conversation.ListMensagensRecentes(ctx, convID, 20)
	if err != nil {
		return fmt.Errorf("agent: load messages: %w", err)
	}

	// Call OpenAI
	reply, err := callOpenAIBasic(ctx, cfg, agente.PromptSistema, agente.Modelo, msgs)
	if err != nil {
		return fmt.Errorf("agent: openai call: %w", err)
	}

	// Save agent response as message
	agentMsg := &conversation.Mensagem{
		ConversaID: convID,
		AutorTipo:  "agente",
		AutorID:    &agente.ID,
		AutorNome:  agente.Nome,
		Conteudo:   &reply,
		MidiaTipo:  "text",
	}
	if _, err := conversation.CreateMensagem(ctx, agentMsg); err != nil {
		return fmt.Errorf("agent: save response: %w", err)
	}

	// Log event
	_ = conversation.LogEventoAgente(ctx, convID, agente.ID, "resposta_gerada", map[string]any{
		"modelo":       agente.Modelo,
		"resposta_len": len(reply),
		"mensagem_id":  inboundMsg.ID,
	})

	return nil
}

// openAIMessage is the chat message shape.
type openAIMessage struct {
	Role    string `json:"role"`
	Content string `json:"content"`
}

// openAIResponse is the response body.
type openAIResponse struct {
	Choices []struct {
		Message openAIMessage `json:"message"`
	} `json:"choices"`
	Error *struct {
		Message string `json:"message"`
	} `json:"error"`
}

func callOpenAIBasic(ctx context.Context, cfg *config.Config, systemPrompt, model string, msgs []*conversation.Mensagem) (string, error) {
	if cfg.OpenAIAPIKey == "" {
		return "Olá! Sou o assistente virtual da Ciclo Norte. Em que posso ajudar?", nil
	}

	apiMessages := []openAIMessage{
		{Role: "system", Content: systemPrompt},
	}
	for _, m := range msgs {
		role := "user"
		switch m.AutorTipo {
		case "agente":
			role = "assistant"
		case "atendente":
			role = "assistant"
		}
		content := ""
		if m.Conteudo != nil {
			content = *m.Conteudo
		}
		apiMessages = append(apiMessages, openAIMessage{Role: role, Content: content})
	}

	payload := map[string]any{
		"model":       model,
		"messages":    apiMessages,
		"temperature": 0.7,
		"max_tokens":  1500,
	}
	body, _ := json.Marshal(payload)

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, "https://api.openai.com/v1/chat/completions", bytes.NewReader(body))
	if err != nil {
		return "", err
	}
	req.Header.Set("Authorization", "Bearer "+cfg.OpenAIAPIKey)
	req.Header.Set("Content-Type", "application/json")

	client := &http.Client{Timeout: 30 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return "", fmt.Errorf("openai request: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return "", fmt.Errorf("openai status %d", resp.StatusCode)
	}

	var result openAIResponse
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return "", fmt.Errorf("openai decode: %w", err)
	}
	if result.Error != nil {
		return "", fmt.Errorf("openai error: %s", result.Error.Message)
	}
	if len(result.Choices) == 0 {
		return "", fmt.Errorf("openai empty choices")
	}
	return result.Choices[0].Message.Content, nil
}

// ---------------------------------------------------------------------------
// Multimodal + Tools + Handler (advanced agent)
// ---------------------------------------------------------------------------

// ProcessRequest is the payload for the agent process endpoint.
type ProcessRequest struct {
	ConversaID    uuid.UUID `json:"conversa_id"`
	Conteudo      string    `json:"conteudo"`
	MidiaTipo     string    `json:"midia_tipo,omitempty"`
	MidiaURL      string    `json:"midia_url,omitempty"`
	MidiaBytes    []byte    `json:"-"`
	AutorNome     string    `json:"autor_nome,omitempty"`
	AutorTipo     string    `json:"autor_tipo,omitempty"`
	AutorID       uuid.UUID `json:"autor_id,omitempty"`
	WhatsappMsgID string    `json:"whatsapp_msg_id,omitempty"`
}

// ProcessResult holds the result of processing a message.
type ProcessResult struct {
	Resposta   string     `json:"resposta"`
	MensagemID uuid.UUID  `json:"mensagem_id"`
	ToolCalls  []ToolCall `json:"tool_calls,omitempty"`
	Transferiu bool       `json:"transferiu,omitempty"`
	NovaLojaID uuid.UUID  `json:"nova_loja_id,omitempty"`
}

// Message represents a chat message for OpenAI API (multimodal + tools).
type Message struct {
	Role       string      `json:"role"`
	Content    interface{} `json:"content"`
	ToolCalls  []ToolCall  `json:"tool_calls,omitempty"`
	ToolCallID string      `json:"tool_call_id,omitempty"`
	Name       string      `json:"name,omitempty"`
}

// ToolCall represents a tool call from the assistant.
type ToolCall struct {
	ID       string `json:"id"`
	Type     string `json:"type"`
	Function struct {
		Name      string `json:"name"`
		Arguments string `json:"arguments"`
	} `json:"function"`
}

// OpenAIChatRequest is the request body for chat completions.
type OpenAIChatRequest struct {
	Model       string    `json:"model"`
	Messages    []Message `json:"messages"`
	Temperature float64   `json:"temperature,omitempty"`
	MaxTokens   int       `json:"max_tokens,omitempty"`
	Tools       []ToolDef `json:"tools,omitempty"`
}

// OpenAIChatResponse is the response body for chat completions.
type OpenAIChatResponse struct {
	ID      string `json:"id"`
	Choices []struct {
		Message struct {
			Role      string     `json:"role"`
			Content   string     `json:"content"`
			ToolCalls []ToolCall `json:"tool_calls"`
		} `json:"message"`
		FinishReason string `json:"finish_reason"`
	} `json:"choices"`
	Error *struct {
		Message string `json:"message"`
		Type    string `json:"type"`
	} `json:"error"`
}

// ToolDef defines a tool for OpenAI function calling.
type ToolDef struct {
	Type     string   `json:"type"`
	Function Function `json:"function"`
}

// Function describes a callable function.
type Function struct {
	Name        string      `json:"name"`
	Description string      `json:"description"`
	Parameters  interface{} `json:"parameters"`
}

// ContentPart is used for multimodal messages.
type ContentPart struct {
	Type     string    `json:"type"`
	Text     string    `json:"text,omitempty"`
	ImageURL *ImageURL `json:"image_url,omitempty"`
}

// ImageURL holds a data URL or http URL for vision.
type ImageURL struct {
	URL string `json:"url"`
}

// ProcessMessage handles the full agent pipeline for a single incoming message.
func ProcessMessage(ctx context.Context, cfg *config.Config, req ProcessRequest) (*ProcessResult, error) {
	if cfg.OpenAIAPIKey == "" {
		return nil, fmt.Errorf("OPENAI_API_KEY not configured")
	}

	// 1. Fetch conversation details
	var lojaID uuid.UUID
	var agenteID uuid.UUID
	err := db.Pool.QueryRow(ctx, `
		SELECT loja_responsavel_id, agente_principal_id FROM conversa WHERE id = $1
	`, req.ConversaID).Scan(&lojaID, &agenteID)
	if err != nil {
		return nil, fmt.Errorf("conversa not found: %w", err)
	}

	// 2. Fetch agent config
	agente, err := conversation.GetAgentePrincipal(ctx, lojaID)
	if err != nil {
		return nil, fmt.Errorf("agent not found: %w", err)
	}

	// 3. Save incoming user message first
	msgID := uuid.New()
	var transcricao, descricaoImagem *string
	if req.MidiaTipo == "audio" && len(req.MidiaBytes) > 0 {
		txt, err := TranscribeAudio(cfg.OpenAIAPIKey, req.MidiaBytes, "audio.ogg")
		if err != nil {
			transcricao = strPtr("(erro na transcrição: " + err.Error() + ")")
		} else {
			transcricao = &txt
		}
	}
	if req.MidiaTipo == "image" && len(req.MidiaBytes) > 0 {
		desc, err := DescribeImage(cfg.OpenAIAPIKey, req.MidiaBytes, agente.Modelo)
		if err != nil {
			descricaoImagem = strPtr("(erro na descrição: " + err.Error() + ")")
		} else {
			descricaoImagem = &desc
		}
	}
	autorTipo := req.AutorTipo
	if autorTipo == "" {
		autorTipo = "cliente"
	}
	autorNome := req.AutorNome
	if autorNome == "" {
		autorNome = "Cliente"
	}
	_, err = db.Pool.Exec(ctx, `
		INSERT INTO mensagem (id, conversa_id, autor_tipo, autor_id, autor_nome, conteudo, midia_tipo, midia_url, transcricao, descricao_imagem, whatsapp_msg_id)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
	`, msgID, req.ConversaID, autorTipo, req.AutorID, autorNome, req.Conteudo, req.MidiaTipo, req.MidiaURL, transcricao, descricaoImagem, req.WhatsappMsgID)
	if err != nil {
		return nil, fmt.Errorf("save user message: %w", err)
	}

	// Update conversa ultima_msg_em
	_, _ = db.Pool.Exec(ctx, `UPDATE conversa SET ultima_msg_em = now() WHERE id = $1`, req.ConversaID)

	// 4. Build messages for LLM
	history, err := loadHistoryForLLM(ctx, req.ConversaID, 20)
	if err != nil {
		return nil, fmt.Errorf("load history: %w", err)
	}

	messages := []Message{
		{Role: "system", Content: agente.PromptSistema},
	}
	messages = append(messages, history...)

	// Build user content depending on media
	if req.MidiaTipo == "image" && len(req.MidiaBytes) > 0 {
		b64 := base64.StdEncoding.EncodeToString(req.MidiaBytes)
		mimeType := http.DetectContentType(req.MidiaBytes)
		if mimeType == "" {
			mimeType = "image/jpeg"
		}
		dataURL := fmt.Sprintf("data:%s;base64,%s", mimeType, b64)
		var parts []ContentPart
		if req.Conteudo != "" {
			parts = append(parts, ContentPart{Type: "text", Text: req.Conteudo})
		}
		parts = append(parts, ContentPart{Type: "image_url", ImageURL: &ImageURL{URL: dataURL}})
		messages = append(messages, Message{Role: "user", Content: parts})
	} else {
		userContent := req.Conteudo
		if transcricao != nil && *transcricao != "" {
			userContent = *transcricao
		}
		if descricaoImagem != nil && *descricaoImagem != "" {
			if userContent != "" {
				userContent += "\n[Imagem: " + *descricaoImagem + "]"
			} else {
				userContent = "[Imagem: " + *descricaoImagem + "]"
			}
		}
		if userContent == "" {
			userContent = "(sem texto)"
		}
		messages = append(messages, Message{Role: "user", Content: userContent})
	}

	// 5. Build tools
	tools := BuildTools(agente.ID)

	// 6. Call OpenAI
	chatReq := OpenAIChatRequest{
		Model:       agente.Modelo,
		Messages:    messages,
		Temperature: agente.Temperatura,
		MaxTokens:   agente.MaxTokens,
		Tools:       tools,
	}
	if chatReq.Model == "" {
		chatReq.Model = "gpt-4o-mini"
	}

	respBody, err := callOpenAIChat(cfg.OpenAIAPIKey, chatReq)
	if err != nil {
		return nil, fmt.Errorf("openai call: %w", err)
	}
	var chatResp OpenAIChatResponse
	if err := json.Unmarshal(respBody, &chatResp); err != nil {
		return nil, fmt.Errorf("unmarshal openai: %w", err)
	}
	if chatResp.Error != nil {
		return nil, fmt.Errorf("openai error: %s (%s)", chatResp.Error.Message, chatResp.Error.Type)
	}
	if len(chatResp.Choices) == 0 {
		return nil, fmt.Errorf("no choices from openai")
	}

	choice := chatResp.Choices[0]
	assistantMsg := choice.Message

	// 7. Handle tool calls
	if len(assistantMsg.ToolCalls) > 0 {
		// Append assistant message with tool_calls
		messages = append(messages, Message{
			Role:      "assistant",
			Content:   assistantMsg.Content,
			ToolCalls: assistantMsg.ToolCalls,
		})

		var transfer bool
		var novaLoja uuid.UUID
		for _, tc := range assistantMsg.ToolCalls {
			result, err := ExecuteTool(ctx, tc.Function.Name, tc.Function.Arguments)
			if err != nil {
				result = fmt.Sprintf(`{"error": "%s"}`, err.Error())
			}
			messages = append(messages, Message{
				Role:       "tool",
				ToolCallID: tc.ID,
				Name:       tc.Function.Name,
				Content:    result,
			})
			if tc.Function.Name == "transferir_setor" {
				transfer = true
				// Try to extract loja from result
				var r struct {
					LojaID string `json:"loja_id"`
				}
				_ = json.Unmarshal([]byte(result), &r)
				if r.LojaID != "" {
					novaLoja, _ = uuid.Parse(r.LojaID)
				}
			}
		}

		// Re-call OpenAI with tool results
		chatReq.Messages = messages
		chatReq.Tools = nil // second call usually doesn't need tools
		respBody2, err := callOpenAIChat(cfg.OpenAIAPIKey, chatReq)
		if err != nil {
			return nil, fmt.Errorf("openai second call: %w", err)
		}
		var chatResp2 OpenAIChatResponse
		if err := json.Unmarshal(respBody2, &chatResp2); err != nil {
			return nil, fmt.Errorf("unmarshal openai second: %w", err)
		}
		if len(chatResp2.Choices) > 0 {
			assistantMsg = chatResp2.Choices[0].Message
		}

		if transfer && novaLoja != uuid.Nil {
			// Update conversation
			_, _ = db.Pool.Exec(ctx, `UPDATE conversa SET loja_responsavel_id = $1, transferida_em = now() WHERE id = $2`, novaLoja, req.ConversaID)
			_, _ = db.Pool.Exec(ctx, `
				INSERT INTO transferencia (conversa_id, tipo, loja_origem_id, loja_destino_id, agente_id, motivo)
				VALUES ($1, 'automatica', $2, $3, $4, 'Transferencia solicitada pelo agente')
			`, req.ConversaID, lojaID, novaLoja, agente.ID)
			return &ProcessResult{
				Resposta:   assistantMsg.Content,
				MensagemID: uuid.Nil,
				Transferiu: true,
				NovaLojaID: novaLoja,
			}, nil
		}
	}

	// 8. Save assistant response
	respID := uuid.New()
	_, err = db.Pool.Exec(ctx, `
		INSERT INTO mensagem (id, conversa_id, autor_tipo, autor_id, autor_nome, conteudo, midia_tipo)
		VALUES ($1, $2, 'agente', $3, $4, $5, 'text')
	`, respID, req.ConversaID, agente.ID, agente.Nome, assistantMsg.Content)
	if err != nil {
		return nil, fmt.Errorf("save agent response: %w", err)
	}
	_, _ = db.Pool.Exec(ctx, `UPDATE conversa SET ultima_msg_em = now() WHERE id = $1`, req.ConversaID)

	// 9. Log event
	_ = conversation.LogEventoAgente(ctx, req.ConversaID, agente.ID, "resposta", map[string]any{"resposta": assistantMsg.Content})

	return &ProcessResult{
		Resposta:   assistantMsg.Content,
		MensagemID: respID,
	}, nil
}

// loadHistoryForLLM returns recent messages from a conversation formatted for the LLM.
func loadHistoryForLLM(ctx context.Context, conversaID uuid.UUID, limit int) ([]Message, error) {
	if limit <= 0 {
		limit = 20
	}
	rows, err := db.Pool.Query(ctx, `
		SELECT autor_tipo, autor_nome, conteudo, transcricao, descricao_imagem
		FROM mensagem
		WHERE conversa_id = $1
		ORDER BY created_at ASC
		LIMIT $2
	`, conversaID, limit)
	if err != nil {
		return nil, fmt.Errorf("query history: %w", err)
	}
	defer rows.Close()

	var msgs []Message
	for rows.Next() {
		var autorTipo, autorNome, conteudo, transcricao, descricaoImagem *string
		if err := rows.Scan(&autorTipo, &autorNome, &conteudo, &transcricao, &descricaoImagem); err != nil {
			continue
		}
		role := "user"
		if autorTipo != nil && (*autorTipo == "agente" || *autorTipo == "atendente" || *autorTipo == "system") {
			role = "assistant"
		}
		content := ""
		if conteudo != nil {
			content = *conteudo
		}
		if transcricao != nil && *transcricao != "" {
			content = *transcricao
		}
		if descricaoImagem != nil && *descricaoImagem != "" {
			if content != "" {
				content += "\n[Imagem: " + *descricaoImagem + "]"
			} else {
				content = "[Imagem: " + *descricaoImagem + "]"
			}
		}
		if content == "" {
			content = "(sem texto)"
		}
		msgs = append(msgs, Message{Role: role, Content: content})
	}
	return msgs, rows.Err()
}

// TranscribeAudio sends audio bytes to OpenAI Whisper and returns transcription.
func TranscribeAudio(apiKey string, audioBytes []byte, filename string) (string, error) {
	var body bytes.Buffer
	writer := multipart.NewWriter(&body)
	part, err := writer.CreateFormFile("file", filename)
	if err != nil {
		return "", fmt.Errorf("create form file: %w", err)
	}
	if _, err := part.Write(audioBytes); err != nil {
		return "", fmt.Errorf("write audio: %w", err)
	}
	_ = writer.WriteField("model", "whisper-1")
	_ = writer.Close()

	req, err := http.NewRequest("POST", "https://api.openai.com/v1/audio/transcriptions", &body)
	if err != nil {
		return "", fmt.Errorf("new request: %w", err)
	}
	req.Header.Set("Authorization", "Bearer "+apiKey)
	req.Header.Set("Content-Type", writer.FormDataContentType())

	client := &http.Client{Timeout: 60 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return "", fmt.Errorf("whisper request: %w", err)
	}
	defer resp.Body.Close()

	respBody, _ := io.ReadAll(resp.Body)
	if resp.StatusCode != http.StatusOK {
		return "", fmt.Errorf("whisper error %d: %s", resp.StatusCode, string(respBody))
	}

	var result struct {
		Text string `json:"text"`
	}
	if err := json.Unmarshal(respBody, &result); err != nil {
		return "", fmt.Errorf("unmarshal whisper: %w", err)
	}
	return result.Text, nil
}

// DescribeImage sends an image to OpenAI vision model and returns a description.
func DescribeImage(apiKey string, imageBytes []byte, model string) (string, error) {
	if model == "" {
		model = "gpt-4o-mini"
	}
	b64 := base64.StdEncoding.EncodeToString(imageBytes)
	mimeType := http.DetectContentType(imageBytes)
	if mimeType == "" {
		mimeType = "image/jpeg"
	}
	dataURL := fmt.Sprintf("data:%s;base64,%s", mimeType, b64)

	payload := OpenAIChatRequest{
		Model: model,
		Messages: []Message{
			{Role: "user", Content: []ContentPart{
				{Type: "text", Text: "Descreva brevemente esta imagem em português."},
				{Type: "image_url", ImageURL: &ImageURL{URL: dataURL}},
			}},
		},
		MaxTokens: 300,
	}

	respBody, err := callOpenAIChat(apiKey, payload)
	if err != nil {
		return "", err
	}
	var result OpenAIChatResponse
	if err := json.Unmarshal(respBody, &result); err != nil {
		return "", fmt.Errorf("unmarshal vision: %w", err)
	}
	if len(result.Choices) == 0 {
		return "", fmt.Errorf("no vision response")
	}
	return result.Choices[0].Message.Content, nil
}

func callOpenAIChat(apiKey string, req OpenAIChatRequest) ([]byte, error) {
	body, err := json.Marshal(req)
	if err != nil {
		return nil, fmt.Errorf("marshal: %w", err)
	}
	httpReq, err := http.NewRequest("POST", "https://api.openai.com/v1/chat/completions", bytes.NewReader(body))
	if err != nil {
		return nil, fmt.Errorf("new request: %w", err)
	}
	httpReq.Header.Set("Authorization", "Bearer "+apiKey)
	httpReq.Header.Set("Content-Type", "application/json")

	client := &http.Client{Timeout: 60 * time.Second}
	resp, err := client.Do(httpReq)
	if err != nil {
		return nil, fmt.Errorf("request: %w", err)
	}
	defer resp.Body.Close()

	respBody, _ := io.ReadAll(resp.Body)
	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("openai http %d: %s", resp.StatusCode, string(respBody))
	}
	return respBody, nil
}

func strPtr(s string) *string {
	return &s
}
