package admin

import (
	"encoding/json"
	"net/http"
	"time"

	"github.com/Titans-Ag/ciclo-norte/internal/auth"
	"github.com/Titans-Ag/ciclo-norte/internal/db"
	"github.com/google/uuid"
)

// requireAdmin middleware ensures the user is admin.
func RequireAdmin(next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		claims := auth.ClaimsFromContext(r.Context())
		if claims == nil || claims.Role != "admin" {
			writeError(w, http.StatusForbidden, "admin required")
			return
		}
		next(w, r)
	}
}

// --- Lojas ---

type Loja struct {
	ID        uuid.UUID `json:"id"`
	Slug      string    `json:"slug"`
	Nome      string    `json:"nome"`
	Descricao *string   `json:"descricao,omitempty"`
	Tipo      *string   `json:"tipo,omitempty"`
	Endereco  *string   `json:"endereco,omitempty"`
	Telefone  *string   `json:"telefone,omitempty"`
	Ativo     bool      `json:"ativo"`
	CreatedAt time.Time `json:"created_at"`
}

func ListLojas(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	rows, err := db.Pool.Query(ctx, `SELECT id, slug, nome, descricao, tipo, endereco, telefone, ativo, created_at FROM loja WHERE ativo = true ORDER BY nome`)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "database error")
		return
	}
	defer rows.Close()
	var lojas []Loja
	for rows.Next() {
		var l Loja
		if err := rows.Scan(&l.ID, &l.Slug, &l.Nome, &l.Descricao, &l.Tipo, &l.Endereco, &l.Telefone, &l.Ativo, &l.CreatedAt); err != nil {
			continue
		}
		lojas = append(lojas, l)
	}
	writeJSON(w, http.StatusOK, lojas)
}

func CreateLoja(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	var req struct {
		Slug     string `json:"slug"`
		Nome     string `json:"nome"`
		Tipo     string `json:"tipo"`
		Endereco string `json:"endereco"`
		Telefone string `json:"telefone"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid json")
		return
	}
	if req.Slug == "" || req.Nome == "" {
		writeError(w, http.StatusBadRequest, "slug and nome required")
		return
	}
	id := uuid.New()
	_, err := db.Pool.Exec(ctx,
		`INSERT INTO loja (id, slug, nome, tipo, endereco, telefone) VALUES ($1, $2, $3, $4, $5, $6)`,
		id, req.Slug, req.Nome, req.Tipo, req.Endereco, req.Telefone,
	)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to create loja")
		return
	}
	writeJSON(w, http.StatusCreated, map[string]string{"id": id.String()})
}

func UpdateLoja(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	idStr := r.PathValue("id")
	id, err := uuid.Parse(idStr)
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid id")
		return
	}
	var req struct {
		Slug     string `json:"slug"`
		Nome     string `json:"nome"`
		Tipo     string `json:"tipo"`
		Endereco string `json:"endereco"`
		Telefone string `json:"telefone"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid json")
		return
	}
	_, err = db.Pool.Exec(ctx,
		`UPDATE loja SET slug = $1, nome = $2, tipo = $3, endereco = $4, telefone = $5, updated_at = now() WHERE id = $6`,
		req.Slug, req.Nome, req.Tipo, req.Endereco, req.Telefone, id,
	)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to update loja")
		return
	}
	writeJSON(w, http.StatusOK, map[string]bool{"ok": true})
}

func DeleteLoja(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	idStr := r.PathValue("id")
	id, err := uuid.Parse(idStr)
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid id")
		return
	}
	_, err = db.Pool.Exec(ctx, `UPDATE loja SET ativo = false, updated_at = now() WHERE id = $1`, id)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to delete loja")
		return
	}
	writeJSON(w, http.StatusOK, map[string]bool{"ok": true})
}

// --- Atendentes ---

type Atendente struct {
	ID        uuid.UUID        `json:"id"`
	Email     string           `json:"email"`
	Nome      string           `json:"nome"`
	Role      string           `json:"role"`
	Ativo     bool             `json:"ativo"`
	CreatedAt time.Time        `json:"created_at"`
	Lojas     []LojaAlocacao   `json:"lojas,omitempty"`
}

type LojaAlocacao struct {
	LojaID   uuid.UUID `json:"loja_id"`
	LojaNome string    `json:"loja_nome,omitempty"`
}

func ListAtendentes(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	rows, err := db.Pool.Query(ctx, `SELECT id, email, nome, role, ativo, created_at FROM atendente WHERE ativo = true ORDER BY nome`)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "database error")
		return
	}
	defer rows.Close()
	var ats []Atendente
	for rows.Next() {
		var a Atendente
		if err := rows.Scan(&a.ID, &a.Email, &a.Nome, &a.Role, &a.Ativo, &a.CreatedAt); err != nil {
			continue
		}
		ats = append(ats, a)
	}
	rows.Close()

	// Load allocations
	for i := range ats {
		alRows, err := db.Pool.Query(ctx,
			`SELECT al.loja_id, l.nome FROM atendente_loja al JOIN loja l ON l.id = al.loja_id WHERE al.atendente_id = $1`,
			ats[i].ID,
		)
		if err == nil {
			for alRows.Next() {
				var la LojaAlocacao
				if err := alRows.Scan(&la.LojaID, &la.LojaNome); err == nil {
					ats[i].Lojas = append(ats[i].Lojas, la)
				}
			}
			alRows.Close()
		}
	}
	writeJSON(w, http.StatusOK, ats)
}

func CreateAtendente(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	var req struct {
		Nome    string `json:"nome"`
		Email   string `json:"email"`
		Role    string `json:"role"`
		Senha   string `json:"senha,omitempty"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid json")
		return
	}
	if req.Nome == "" || req.Email == "" {
		writeError(w, http.StatusBadRequest, "nome and email required")
		return
	}
	senha := req.Senha
	if senha == "" {
		senha = "senha123"
	}
	hash, err := auth.HashPassword(senha)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to hash password")
		return
	}
	role := req.Role
	if role == "" {
		role = "atendente"
	}
	id := uuid.New()
	_, err = db.Pool.Exec(ctx,
		`INSERT INTO atendente (id, email, nome, senha_hash, role) VALUES ($1, $2, $3, $4, $5)`,
		id, req.Email, req.Nome, hash, role,
	)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to create atendente")
		return
	}
	writeJSON(w, http.StatusCreated, map[string]string{"id": id.String()})
}

func UpdateAtendente(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	idStr := r.PathValue("id")
	id, err := uuid.Parse(idStr)
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid id")
		return
	}
	var req struct {
		Nome  string `json:"nome"`
		Email string `json:"email"`
		Role  string `json:"role"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid json")
		return
	}
	_, err = db.Pool.Exec(ctx,
		`UPDATE atendente SET nome = $1, email = $2, role = $3, updated_at = now() WHERE id = $4`,
		req.Nome, req.Email, req.Role, id,
	)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to update atendente")
		return
	}
	writeJSON(w, http.StatusOK, map[string]bool{"ok": true})
}

func ToggleAtendenteLoja(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	idStr := r.PathValue("id")
	atendenteID, err := uuid.Parse(idStr)
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid id")
		return
	}
	var req struct {
		LojaID string `json:"loja_id"`
		Action string `json:"action"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid json")
		return
	}
	lojaID, err := uuid.Parse(req.LojaID)
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid loja_id")
		return
	}
	claims := auth.ClaimsFromContext(r.Context())
	var alocadoPor *uuid.UUID
	if claims != nil {
		alocadoPor = &claims.UserID
	}

	if req.Action == "adicionar" {
		_, err = db.Pool.Exec(ctx,
			`INSERT INTO atendente_loja (atendente_id, loja_id, alocado_por) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING`,
			atendenteID, lojaID, alocadoPor,
		)
	} else {
		_, err = db.Pool.Exec(ctx,
			`DELETE FROM atendente_loja WHERE atendente_id = $1 AND loja_id = $2`,
			atendenteID, lojaID,
		)
	}
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to update allocation")
		return
	}
	writeJSON(w, http.StatusOK, map[string]bool{"ok": true})
}

// --- Agent Config ---

type AgenteConfig struct {
	ID            uuid.UUID `json:"id"`
	Nome          string    `json:"nome"`
	PromptSistema string    `json:"prompt_sistema"`
	Modelo        string    `json:"modelo"`
	Temperatura   float64   `json:"temperatura"`
	Tools         []string  `json:"tools"`
}

func GetAgentConfig(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	var cfg AgenteConfig
	var toolsJSON []byte
	err := db.Pool.QueryRow(ctx,
		`SELECT a.id, a.nome, a.prompt_sistema, a.modelo, a.temperatura,
		 COALESCE((SELECT json_agg(tool_slug) FROM agente_tool WHERE agente_id = a.id), '[]') as tools
		 FROM agente a WHERE a.tipo = 'principal' ORDER BY a.created_at LIMIT 1`,
	).Scan(&cfg.ID, &cfg.Nome, &cfg.PromptSistema, &cfg.Modelo, &cfg.Temperatura, &toolsJSON)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to load config")
		return
	}
	json.Unmarshal(toolsJSON, &cfg.Tools)
	writeJSON(w, http.StatusOK, cfg)
}

func UpdateAgentConfig(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	var req AgenteConfig
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid json")
		return
	}
	_, err := db.Pool.Exec(ctx,
		`UPDATE agente SET nome = $1, prompt_sistema = $2, modelo = $3, temperatura = $4, updated_at = now()
		 WHERE tipo = 'principal'`,
		req.Nome, req.PromptSistema, req.Modelo, req.Temperatura,
	)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to update config")
		return
	}
	// Update tools
	var id uuid.UUID
	err = db.Pool.QueryRow(ctx, `SELECT id FROM agente WHERE tipo = 'principal' ORDER BY created_at LIMIT 1`).Scan(&id)
	if err == nil {
		db.Pool.Exec(ctx, `DELETE FROM agente_tool WHERE agente_id = $1`, id)
		for _, t := range req.Tools {
			db.Pool.Exec(ctx, `INSERT INTO agente_tool (agente_id, tool_slug) VALUES ($1, $2) ON CONFLICT DO NOTHING`, id, t)
		}
	}
	writeJSON(w, http.StatusOK, map[string]bool{"ok": true})
}

// --- WhatsApp Instances ---

type Instancia struct {
	ID                    uuid.UUID `json:"id"`
	Nome                  string    `json:"nome"`
	Numero                string    `json:"numero"`
	Status                string    `json:"status"`
	EvolutionInstanceName string    `json:"evolution_instance_name"`
	UpdatedAt             time.Time `json:"updated_at"`
}

func ListWhatsAppInstances(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	rows, err := db.Pool.Query(ctx, `SELECT id, nome, numero_telefone, status, evolution_instance_name, updated_at FROM instancia_whatsapp WHERE ativo = true`)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "database error")
		return
	}
	defer rows.Close()
	var insts []Instancia
	for rows.Next() {
		var i Instancia
		if err := rows.Scan(&i.ID, &i.Nome, &i.Numero, &i.Status, &i.EvolutionInstanceName, &i.UpdatedAt); err == nil {
			insts = append(insts, i)
		}
	}
	writeJSON(w, http.StatusOK, insts)
}

func ReconnectWhatsApp(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	idStr := r.PathValue("id")
	id, err := uuid.Parse(idStr)
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid id")
		return
	}
	_, err = db.Pool.Exec(ctx, `UPDATE instancia_whatsapp SET status = 'connecting', updated_at = now() WHERE id = $1`, id)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to update status")
		return
	}
	writeJSON(w, http.StatusOK, map[string]bool{"ok": true})
}

func writeJSON(w http.ResponseWriter, code int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(code)
	json.NewEncoder(w).Encode(v)
}

func writeError(w http.ResponseWriter, code int, message string) {
	writeJSON(w, code, map[string]string{"error": message})
}
