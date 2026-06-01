package evolution

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"

	"github.com/Titans-Ag/ciclo-norte/internal/agent"
	"github.com/Titans-Ag/ciclo-norte/internal/config"
	"github.com/Titans-Ag/ciclo-norte/internal/conversation"
	"github.com/google/uuid"
)

// WebhookEvent is the canonical shape parsed from an Evolution webhook payload.
type WebhookEvent struct {
	EventType         string
	InstanceName      string
	MessageID         string
	FromNumber        string
	FromMe            bool
	Kind              string
	Text              string
	MediaEvolutionRef string
	MimeType          string
	Timestamp         time.Time
	Raw               json.RawMessage
}

// Handler handles Evolution webhook requests.
type Handler struct {
	cfg *config.Config
}

// NewHandler creates a new webhook handler.
func NewHandler(cfg *config.Config) *Handler {
	return &Handler{cfg: cfg}
}

// RegisterRoutes registers webhook routes.
func (h *Handler) RegisterRoutes(mux *http.ServeMux) {
	mux.HandleFunc("POST /api/webhook/evolution", h.Receive)
}

// Receive processes an Evolution webhook payload.
func (h *Handler) Receive(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeError(w, http.StatusMethodNotAllowed, "method not allowed")
		return
	}

	body, err := io.ReadAll(r.Body)
	if err != nil {
		writeError(w, http.StatusBadRequest, "failed to read body")
		return
	}
	defer r.Body.Close()

	event, err := ParseWebhook(body)
	if err != nil {
		writeError(w, http.StatusBadRequest, fmt.Sprintf("parse webhook: %v", err))
		return
	}

	if !event.IsInboundUserMessage() {
		writeJSON(w, http.StatusOK, map[string]string{"status": "ignored"})
		return
	}

	ctx := r.Context()

	// Load instance by name
	inst, err := conversation.GetInstanciaByName(ctx, event.InstanceName)
	if err != nil {
		writeError(w, http.StatusNotFound, "instance not found")
		return
	}

	// Dedupe: check if message already exists
	existing, _ := conversation.GetMensagemByWhatsappID(ctx, event.MessageID)
	if existing != nil {
		writeJSON(w, http.StatusOK, map[string]string{"status": "deduped"})
		return
	}

	// Find or create conversation
	conv, err := conversation.GetByInstanciaETelefone(ctx, inst.ID, event.FromNumber)
	if err != nil {
		// Create new conversation
		now := time.Now().UTC()
		conv = &conversation.Conversa{
			ID:                  uuid.New(),
			InstanciaWhatsappID: inst.ID,
			LojaResponsavelID:   inst.LojaID,
			ClienteTelefone:     event.FromNumber,
			Status:              "ia_ativa",
			IniciadaEm:          now,
			UltimaMsgEm:         now,
		}
		// Try to set principal agent
		if agente, err := conversation.GetAgentePrincipal(ctx, inst.LojaID); err == nil {
			conv.AgentePrincipalID = &agente.ID
		}
		conv, err = conversation.CreateConversa(ctx, conv)
		if err != nil {
			writeError(w, http.StatusInternalServerError, "failed to create conversation")
			return
		}
	}

	// Save customer message
	midiaTipo := event.Kind
	if midiaTipo == "" {
		midiaTipo = "text"
	}
	msg := &conversation.Mensagem{
		ConversaID:    conv.ID,
		AutorTipo:     "cliente",
		AutorNome:     event.FromNumber,
		Conteudo:      strPtrOrNil(event.Text),
		MidiaURL:      strPtrOrNil(event.MediaEvolutionRef),
		MidiaTipo:     midiaTipo,
		WhatsappMsgID: &event.MessageID,
		Metadata: map[string]any{
			"evolution_instance": event.InstanceName,
			"mime_type":        event.MimeType,
			"raw_event":        string(event.Raw),
		},
	}
	if !event.Timestamp.IsZero() {
		msg.EnviadaEm = &event.Timestamp
	}

	msg, err = conversation.CreateMensagem(ctx, msg)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to save message")
		return
	}

	// Invoke AI agent asynchronously
	go func() {
		bgCtx := context.Background()
		if err := agent.ProcessConversation(bgCtx, h.cfg, conv.ID, msg); err != nil {
			fmt.Printf("agent process error: %v\n", err)
		}
	}()

	writeJSON(w, http.StatusOK, map[string]string{"status": "ok"})
}

// ParseWebhook decodes a raw Evolution webhook payload into a WebhookEvent.
func ParseWebhook(raw []byte) (WebhookEvent, error) {
	var envelope struct {
		Event    string          `json:"event"`
		Instance string          `json:"instance"`
		Data     json.RawMessage `json:"data"`
	}
	if err := json.Unmarshal(raw, &envelope); err != nil {
		return WebhookEvent{}, fmt.Errorf("evolution: parse webhook envelope: %w", err)
	}
	we := WebhookEvent{
		EventType:    envelope.Event,
		InstanceName: envelope.Instance,
		Raw:          json.RawMessage(append([]byte(nil), raw...)),
	}

	if len(envelope.Data) == 0 {
		return we, nil
	}

	var messages []messageData
	if err := json.Unmarshal(envelope.Data, &messages); err != nil {
		var single messageData
		if err2 := json.Unmarshal(envelope.Data, &single); err2 != nil {
			return we, fmt.Errorf("evolution: parse webhook data: %w", err2)
		}
		messages = []messageData{single}
	}

	var data *messageData
	for i := range messages {
		if !messages[i].Key.FromMe {
			data = &messages[i]
			break
		}
	}
	if data == nil {
		return we, nil
	}

	var msgMap map[string]json.RawMessage
	if len(data.MessageRaw) > 0 {
		if data.MessageRaw[0] == '"' {
			var msgStr string
			if err := json.Unmarshal(data.MessageRaw, &msgStr); err == nil {
				_ = json.Unmarshal([]byte(msgStr), &msgMap)
			}
		} else {
			_ = json.Unmarshal(data.MessageRaw, &msgMap)
		}
	}

	we.MessageID = data.Key.ID
	we.FromMe = data.Key.FromMe
	we.FromNumber = jidToPhone(data.Key.RemoteJid)
	if data.MessageTimestamp > 0 {
		we.Timestamp = time.Unix(data.MessageTimestamp, 0).UTC()
	}

	switch data.MessageType {
	case "conversation":
		we.Kind = "text"
		if raw, ok := msgMap["conversation"]; ok {
			var s string
			_ = json.Unmarshal(raw, &s)
			we.Text = s
		}
	case "extendedTextMessage":
		we.Kind = "text"
		if raw, ok := msgMap["extendedTextMessage"]; ok {
			var v struct{ Text string `json:"text"` }
			_ = json.Unmarshal(raw, &v)
			we.Text = v.Text
		}
	case "audioMessage":
		we.Kind = "audio"
		if raw, ok := msgMap["audioMessage"]; ok {
			var v struct {
				URL      string `json:"url"`
				Mimetype string `json:"mimetype"`
			}
			_ = json.Unmarshal(raw, &v)
			we.MediaEvolutionRef = v.URL
			we.MimeType = v.Mimetype
		}
	case "imageMessage":
		we.Kind = "image"
		if raw, ok := msgMap["imageMessage"]; ok {
			var v struct {
				URL      string `json:"url"`
				Mimetype string `json:"mimetype"`
				Caption  string `json:"caption"`
			}
			_ = json.Unmarshal(raw, &v)
			we.MediaEvolutionRef = v.URL
			we.MimeType = v.Mimetype
			we.Text = v.Caption
		}
	case "videoMessage":
		we.Kind = "video"
		if raw, ok := msgMap["videoMessage"]; ok {
			var v struct {
				URL      string `json:"url"`
				Mimetype string `json:"mimetype"`
				Caption  string `json:"caption"`
			}
			_ = json.Unmarshal(raw, &v)
			we.MediaEvolutionRef = v.URL
			we.MimeType = v.Mimetype
			we.Text = v.Caption
		}
	case "documentMessage":
		we.Kind = "document"
		if raw, ok := msgMap["documentMessage"]; ok {
			var v struct {
				URL      string `json:"url"`
				Mimetype string `json:"mimetype"`
				FileName string `json:"fileName"`
			}
			_ = json.Unmarshal(raw, &v)
			we.MediaEvolutionRef = v.URL
			we.MimeType = v.Mimetype
			we.Text = v.FileName
		}
	default:
		we.Kind = "unknown"
	}
	return we, nil
}

// IsInboundUserMessage reports whether the event should trigger the agent loop.
func (e WebhookEvent) IsInboundUserMessage() bool {
	return e.EventType == "messages.upsert" &&
		!e.FromMe &&
		e.FromNumber != "" &&
		(e.Kind == "text" || e.Kind == "audio" || e.Kind == "image" ||
			e.Kind == "video" || e.Kind == "document")
}

type messageData struct {
	Key struct {
		ID        string `json:"id"`
		RemoteJid string `json:"remoteJid"`
		FromMe    bool   `json:"fromMe"`
	} `json:"key"`
	MessageType      string          `json:"messageType"`
	MessageRaw       json.RawMessage `json:"message"`
	MessageTimestamp int64           `json:"messageTimestamp"`
}

func jidToPhone(jid string) string {
	if jid == "" {
		return ""
	}
	at := strings.IndexByte(jid, '@')
	if at < 0 {
		return ""
	}
	num := jid[:at]
	host := jid[at+1:]
	if host == "g.us" {
		return ""
	}
	if !strings.HasPrefix(num, "+") {
		return "+" + num
	}
	return num
}

func writeJSON(w http.ResponseWriter, code int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(code)
	json.NewEncoder(w).Encode(v)
}

func writeError(w http.ResponseWriter, code int, message string) {
	writeJSON(w, code, map[string]string{"error": message})
}

func strPtrOrNil(s string) *string {
	if s == "" {
		return nil
	}
	return &s
}
