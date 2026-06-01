package conversation

import (
	"time"

	"github.com/google/uuid"
)

// Conversa represents a conversation with a customer.
type Conversa struct {
	ID                   uuid.UUID  `json:"id"`
	InstanciaWhatsappID  uuid.UUID  `json:"instancia_whatsapp_id"`
	LojaResponsavelID    uuid.UUID  `json:"loja_responsavel_id"`
	ClienteTelefone      string     `json:"cliente_telefone"`
	ClienteNome          *string    `json:"cliente_nome,omitempty"`
	Status               string     `json:"status"`
	AgentePrincipalID    *uuid.UUID `json:"agente_principal_id,omitempty"`
	AtendenteID          *uuid.UUID `json:"atendente_id,omitempty"`
	IniciadaEm           time.Time  `json:"iniciada_em"`
	UltimaMsgEm          time.Time  `json:"ultima_msg_em"`
	TransferidaEm        *time.Time `json:"transferida_em,omitempty"`
	CreatedAt            time.Time  `json:"created_at"`
	UpdatedAt            time.Time  `json:"updated_at"`
}

// Mensagem represents a message in a conversation.
type Mensagem struct {
	ID              uuid.UUID `json:"id"`
	ConversaID      uuid.UUID `json:"conversa_id"`
	AutorTipo       string    `json:"autor_tipo"`
	AutorID         *uuid.UUID `json:"autor_id,omitempty"`
	AutorNome       string    `json:"autor_nome"`
	Conteudo        *string   `json:"conteudo,omitempty"`
	MidiaURL        *string   `json:"midia_url,omitempty"`
	MidiaTipo       string    `json:"midia_tipo"`
	Transcricao     *string   `json:"transcricao,omitempty"`
	DescricaoImagem *string   `json:"descricao_imagem,omitempty"`
	WhatsappMsgID   *string   `json:"whatsapp_msg_id,omitempty"`
	Metadata        map[string]any `json:"metadata,omitempty"`
	EnviadaEm       *time.Time `json:"enviada_em,omitempty"`
	CreatedAt       time.Time `json:"created_at"`
}

// Transferencia represents a conversation transfer between stores.
type Transferencia struct {
	ID             uuid.UUID  `json:"id"`
	ConversaID     uuid.UUID  `json:"conversa_id"`
	Tipo           string     `json:"tipo"`
	LojaOrigemID   uuid.UUID  `json:"loja_origem_id"`
	LojaDestinoID  uuid.UUID  `json:"loja_destino_id"`
	AtendenteID    *uuid.UUID `json:"atendente_id,omitempty"`
	AgenteID       *uuid.UUID `json:"agente_id,omitempty"`
	Motivo         *string    `json:"motivo,omitempty"`
	CreatedAt      time.Time  `json:"created_at"`
}

// EventoAgente represents an agent event log.
type EventoAgente struct {
	ID          uuid.UUID      `json:"id"`
	ConversaID  uuid.UUID      `json:"conversa_id"`
	AgenteID    uuid.UUID      `json:"agente_id"`
	Tipo        string         `json:"tipo"`
	Payload     map[string]any `json:"payload"`
	CreatedAt   time.Time      `json:"created_at"`
}

// ConversaSummary is used for listing conversations with last message preview.
type ConversaSummary struct {
	Conversa
	ClienteNome     *string `json:"cliente_nome,omitempty"`
	UltimaMensagem  *string `json:"ultima_mensagem,omitempty"`
	MensagemCount   int     `json:"mensagem_count"`
	LojaSlug        string  `json:"loja_slug"`
	LojaNome        string  `json:"loja_nome"`
}

// SendMessageRequest is the payload for sending a message.
type SendMessageRequest struct {
	Conteudo  string `json:"conteudo"`
	MidiaURL  string `json:"midia_url,omitempty"`
	MidiaTipo string `json:"midia_tipo,omitempty"`
}

// TransferRequest is the payload for transferring a conversation.
type TransferRequest struct {
	LojaDestinoID uuid.UUID `json:"loja_destino_id"`
	Motivo        string    `json:"motivo,omitempty"`
}

// AgenteInfo holds agent configuration loaded from DB.
type AgenteInfo struct {
	ID            uuid.UUID `json:"id"`
	Nome          string    `json:"nome"`
	PromptSistema string    `json:"prompt_sistema"`
	Modelo        string    `json:"modelo"`
	Temperatura   float64   `json:"temperatura"`
	MaxTokens     int       `json:"max_tokens"`
}
