package conversation

import (
	"context"
	"fmt"

	"github.com/Titans-Ag/ciclo-norte/internal/db"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
)

// --- Conversa queries ---

// GetByID loads a conversation by ID.
func GetByID(ctx context.Context, id uuid.UUID) (*Conversa, error) {
	row := db.Pool.QueryRow(ctx, `
		SELECT id, instancia_whatsapp_id, loja_responsavel_id, cliente_telefone, cliente_nome,
		       status, agente_principal_id, atendente_id, iniciada_em, ultima_msg_em, transferida_em,
		       created_at, updated_at
		FROM conversa WHERE id = $1`, id)
	return scanConversa(row)
}

// GetByInstanciaETelefone loads a conversation by instance and phone (unique constraint).
func GetByInstanciaETelefone(ctx context.Context, instanciaID uuid.UUID, telefone string) (*Conversa, error) {
	row := db.Pool.QueryRow(ctx, `
		SELECT id, instancia_whatsapp_id, loja_responsavel_id, cliente_telefone, cliente_nome,
		       status, agente_principal_id, atendente_id, iniciada_em, ultima_msg_em, transferida_em,
		       created_at, updated_at
		FROM conversa WHERE instancia_whatsapp_id = $1 AND cliente_telefone = $2`, instanciaID, telefone)
	return scanConversa(row)
}

// CreateConversa creates a new conversation.
func CreateConversa(ctx context.Context, c *Conversa) (*Conversa, error) {
	if c.ID == uuid.Nil {
		c.ID = uuid.New()
	}
	_, err := db.Pool.Exec(ctx, `
		INSERT INTO conversa (id, instancia_whatsapp_id, loja_responsavel_id, cliente_telefone, cliente_nome,
		                    status, agente_principal_id, atendente_id, iniciada_em, ultima_msg_em)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
		c.ID, c.InstanciaWhatsappID, c.LojaResponsavelID, c.ClienteTelefone, c.ClienteNome,
		c.Status, c.AgentePrincipalID, c.AtendenteID, c.IniciadaEm, c.UltimaMsgEm)
	if err != nil {
		return nil, fmt.Errorf("create conversa: %w", err)
	}
	return c, nil
}

// UpdateConversa updates a conversation.
func UpdateConversa(ctx context.Context, c *Conversa) error {
	_, err := db.Pool.Exec(ctx, `
		UPDATE conversa SET
			loja_responsavel_id = $1,
			cliente_nome = $2,
			status = $3,
			agente_principal_id = $4,
			atendente_id = $5,
			ultima_msg_em = $6,
			transferida_em = $7,
			updated_at = now()
		WHERE id = $8`,
		c.LojaResponsavelID, c.ClienteNome, c.Status, c.AgentePrincipalID,
		c.AtendenteID, c.UltimaMsgEm, c.TransferidaEm, c.ID)
	if err != nil {
		return fmt.Errorf("update conversa: %w", err)
	}
	return nil
}

// ListConversasByLoja lists conversations for a store.
func ListConversasByLoja(ctx context.Context, lojaID uuid.UUID, limit, offset int) ([]*ConversaSummary, error) {
	if limit <= 0 {
		limit = 50
	}
	rows, err := db.Pool.Query(ctx, `
		SELECT c.id, c.instancia_whatsapp_id, c.loja_responsavel_id, c.cliente_telefone, c.cliente_nome,
		       c.status, c.agente_principal_id, c.atendente_id, c.iniciada_em, c.ultima_msg_em,
		       c.transferida_em, c.created_at, c.updated_at,
		       (SELECT conteudo FROM mensagem WHERE conversa_id = c.id ORDER BY created_at DESC LIMIT 1),
		       (SELECT COUNT(*) FROM mensagem WHERE conversa_id = c.id),
		       l.slug, l.nome
		FROM conversa c
		JOIN loja l ON l.id = c.loja_responsavel_id
		WHERE c.loja_responsavel_id = $1
		ORDER BY c.ultima_msg_em DESC
		LIMIT $2 OFFSET $3`, lojaID, limit, offset)
	if err != nil {
		return nil, fmt.Errorf("list conversas: %w", err)
	}
	defer rows.Close()

	out := make([]*ConversaSummary, 0)
	for rows.Next() {
		cs := &ConversaSummary{}
		var ultimaMsg *string
		var lojaSlug, lojaNome string
		err := rows.Scan(
			&cs.ID, &cs.InstanciaWhatsappID, &cs.LojaResponsavelID, &cs.ClienteTelefone, &cs.ClienteNome,
			&cs.Status, &cs.AgentePrincipalID, &cs.AtendenteID, &cs.IniciadaEm, &cs.UltimaMsgEm,
			&cs.TransferidaEm, &cs.CreatedAt, &cs.UpdatedAt,
			&ultimaMsg, &cs.MensagemCount, &lojaSlug, &lojaNome)
		if err != nil {
			return nil, fmt.Errorf("scan conversa: %w", err)
		}
		cs.UltimaMensagem = ultimaMsg
		cs.LojaSlug = lojaSlug
		cs.LojaNome = lojaNome
		out = append(out, cs)
	}
	return out, rows.Err()
}

// --- Mensagem queries ---

// GetMensagemByWhatsappID checks for duplicate messages.
func GetMensagemByWhatsappID(ctx context.Context, msgID string) (*Mensagem, error) {
	row := db.Pool.QueryRow(ctx, `
		SELECT id, conversa_id, autor_tipo, autor_id, autor_nome, conteudo, midia_url, midia_tipo,
		       transcricao, descricao_imagem, whatsapp_msg_id, metadata, enviada_em, created_at
		FROM mensagem WHERE whatsapp_msg_id = $1`, msgID)
	return scanMensagem(row)
}

// CreateMensagem inserts a message.
func CreateMensagem(ctx context.Context, m *Mensagem) (*Mensagem, error) {
	if m.ID == uuid.Nil {
		m.ID = uuid.New()
	}
	_, err := db.Pool.Exec(ctx, `
		INSERT INTO mensagem (id, conversa_id, autor_tipo, autor_id, autor_nome, conteudo, midia_url,
		                    midia_tipo, transcricao, descricao_imagem, whatsapp_msg_id, metadata, enviada_em)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
		m.ID, m.ConversaID, m.AutorTipo, m.AutorID, m.AutorNome, m.Conteudo, m.MidiaURL,
		m.MidiaTipo, m.Transcricao, m.DescricaoImagem, m.WhatsappMsgID, m.Metadata, m.EnviadaEm)
	if err != nil {
		return nil, fmt.Errorf("create mensagem: %w", err)
	}

	// Update conversation last message time
	_, _ = db.Pool.Exec(ctx, `UPDATE conversa SET ultima_msg_em = now() WHERE id = $1`, m.ConversaID)

	return m, nil
}

// ListMensagensRecentes returns recent messages for a conversation.
func ListMensagensRecentes(ctx context.Context, convID uuid.UUID, limit int) ([]*Mensagem, error) {
	if limit <= 0 {
		limit = 20
	}
	rows, err := db.Pool.Query(ctx, `
		SELECT id, conversa_id, autor_tipo, autor_id, autor_nome, conteudo, midia_url, midia_tipo,
		       transcricao, descricao_imagem, whatsapp_msg_id, metadata, enviada_em, created_at
		FROM mensagem WHERE conversa_id = $1 ORDER BY created_at ASC LIMIT $2`, convID, limit)
	if err != nil {
		return nil, fmt.Errorf("list mensagens: %w", err)
	}
	defer rows.Close()

	var out []*Mensagem
	for rows.Next() {
		m, err := scanMensagem(rows)
		if err != nil {
			return nil, err
		}
		out = append(out, m)
	}
	return out, rows.Err()
}

// --- Agente queries ---

// GetAgentePrincipal loads the principal agent for a store.
func GetAgentePrincipal(ctx context.Context, lojaID uuid.UUID) (*AgenteInfo, error) {
	row := db.Pool.QueryRow(ctx, `
		SELECT id, nome, prompt_sistema, modelo, temperatura, max_tokens
		FROM agente WHERE loja_id = $1 AND slug = 'principal' AND ativo = true LIMIT 1`, lojaID)
	a := &AgenteInfo{}
	err := row.Scan(&a.ID, &a.Nome, &a.PromptSistema, &a.Modelo, &a.Temperatura, &a.MaxTokens)
	if err != nil {
		return nil, fmt.Errorf("get agente principal: %w", err)
	}
	return a, nil
}

// --- Transferencia ---

// CreateTransferencia records a transfer.
func CreateTransferencia(ctx context.Context, t *Transferencia) (*Transferencia, error) {
	if t.ID == uuid.Nil {
		t.ID = uuid.New()
	}
	_, err := db.Pool.Exec(ctx, `
		INSERT INTO transferencia (id, conversa_id, tipo, loja_origem_id, loja_destino_id, atendente_id, agente_id, motivo)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
		t.ID, t.ConversaID, t.Tipo, t.LojaOrigemID, t.LojaDestinoID, t.AtendenteID, t.AgenteID, t.Motivo)
	if err != nil {
		return nil, fmt.Errorf("create transferencia: %w", err)
	}
	return t, nil
}

// --- EventoAgente ---

// LogEventoAgente records an agent event.
func LogEventoAgente(ctx context.Context, convID, agenteID uuid.UUID, tipo string, payload map[string]any) error {
	_, err := db.Pool.Exec(ctx, `
		INSERT INTO evento_agente (id, conversa_id, agente_id, tipo, payload)
		VALUES ($1, $2, $3, $4, $5)`,
		uuid.New(), convID, agenteID, tipo, payload)
	if err != nil {
		return fmt.Errorf("log evento: %w", err)
	}
	return nil
}

// --- Instancia WhatsApp ---

// GetInstanciaByName loads an instance by its Evolution name.
func GetInstanciaByName(ctx context.Context, name string) (*struct {
	ID                   uuid.UUID
	LojaID               uuid.UUID
	Numero               string
	EvolutionURL         string
	EvolutionInstanceName string
	Status               string
}, error) {
	row := db.Pool.QueryRow(ctx, `
		SELECT id, loja_id, numero_telefone, evolution_base_url, evolution_instance_name, status
		FROM instancia_whatsapp WHERE evolution_instance_name = $1 AND ativo = true`, name)
	var i struct {
		ID                   uuid.UUID
		LojaID               uuid.UUID
		Numero               string
		EvolutionURL         string
		EvolutionInstanceName string
		Status               string
	}
	err := row.Scan(&i.ID, &i.LojaID, &i.Numero, &i.EvolutionURL, &i.EvolutionInstanceName, &i.Status)
	if err != nil {
		return nil, fmt.Errorf("get instancia: %w", err)
	}
	return &i, nil
}

// --- Loja helpers ---

// GetLojaByID loads a store by ID.
func GetLojaByID(ctx context.Context, id uuid.UUID) (*struct {
	ID   uuid.UUID
	Slug string
	Nome string
}, error) {
	row := db.Pool.QueryRow(ctx, `SELECT id, slug, nome FROM loja WHERE id = $1`, id)
	var l struct {
		ID   uuid.UUID
		Slug string
		Nome string
	}
	if err := row.Scan(&l.ID, &l.Slug, &l.Nome); err != nil {
		return nil, fmt.Errorf("get loja: %w", err)
	}
	return &l, nil
}

// GetLojaBySlug loads a store by slug.
func GetLojaBySlug(ctx context.Context, slug string) (*struct {
	ID   uuid.UUID
	Nome string
}, error) {
	row := db.Pool.QueryRow(ctx, `SELECT id, nome FROM loja WHERE slug = $1`, slug)
	var l struct {
		ID   uuid.UUID
		Nome string
	}
	if err := row.Scan(&l.ID, &l.Nome); err != nil {
		return nil, fmt.Errorf("get loja by slug: %w", err)
	}
	return &l, nil
}

// --- Scanners ---

func scanConversa(row pgx.Row) (*Conversa, error) {
	c := &Conversa{}
	err := row.Scan(
		&c.ID, &c.InstanciaWhatsappID, &c.LojaResponsavelID, &c.ClienteTelefone, &c.ClienteNome,
		&c.Status, &c.AgentePrincipalID, &c.AtendenteID, &c.IniciadaEm, &c.UltimaMsgEm,
		&c.TransferidaEm, &c.CreatedAt, &c.UpdatedAt)
	if err != nil {
		return nil, fmt.Errorf("scan conversa: %w", err)
	}
	return c, nil
}

func scanMensagem(row pgx.Row) (*Mensagem, error) {
	m := &Mensagem{}
	var metadata any
	err := row.Scan(
		&m.ID, &m.ConversaID, &m.AutorTipo, &m.AutorID, &m.AutorNome, &m.Conteudo, &m.MidiaURL,
		&m.MidiaTipo, &m.Transcricao, &m.DescricaoImagem, &m.WhatsappMsgID, &metadata, &m.EnviadaEm, &m.CreatedAt)
	if err != nil {
		return nil, fmt.Errorf("scan mensagem: %w", err)
	}
	if metadata != nil {
		if mm, ok := metadata.(map[string]any); ok {
			m.Metadata = mm
		}
	}
	return m, nil
}
