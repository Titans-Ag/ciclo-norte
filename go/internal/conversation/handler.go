package conversation

import (
	"context"
	"encoding/json"
	"net/http"
	"strconv"
	"time"

	"github.com/Titans-Ag/ciclo-norte/internal/auth"
	"github.com/Titans-Ag/ciclo-norte/internal/db"
	"github.com/Titans-Ag/ciclo-norte/internal/sse"
	"github.com/google/uuid"
)

// Handler is a collection of conversation HTTP handlers.
type Handler struct{}

// NewHandler creates a new Handler.
func NewHandler() *Handler {
	return &Handler{}
}

// getClaims extracts JWT claims or returns an error response.
func getClaims(w http.ResponseWriter, r *http.Request) *auth.Claims {
	claims := auth.ClaimsFromContext(r.Context())
	if claims == nil {
		writeError(w, http.StatusUnauthorized, "unauthorized")
		return nil
	}
	return claims
}

// getAtendenteLojas returns the store IDs allocated to the attendant.
func getAtendenteLojas(ctx context.Context, atendenteID uuid.UUID) ([]uuid.UUID, error) {
	rows, err := db.Pool.Query(ctx, `SELECT loja_id FROM atendente_loja WHERE atendente_id = $1`, atendenteID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []uuid.UUID
	for rows.Next() {
		var id uuid.UUID
		if err := rows.Scan(&id); err != nil {
			return nil, err
		}
		out = append(out, id)
	}
	return out, rows.Err()
}

func parseUUIDParam(w http.ResponseWriter, r *http.Request, key string) uuid.UUID {
	val := r.PathValue(key)
	id, err := uuid.Parse(val)
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid id")
		return uuid.Nil
	}
	return id
}

// ConversaDetail is the response for GET /api/conversations/{id}.
type ConversaDetail struct {
	Conversa
	Mensagens []*Mensagem `json:"mensagens"`
}

// RegisterRoutes registers all conversation routes on the given mux.
func (h *Handler) RegisterRoutes(mux *http.ServeMux) {
	mux.HandleFunc("GET /api/conversations", h.List)
	mux.HandleFunc("GET /api/conversations/{id}", h.Detail)
	mux.HandleFunc("POST /api/conversations/{id}/messages", h.SendMessage)
	mux.HandleFunc("POST /api/conversations/{id}/assumir", h.Assumir)
	mux.HandleFunc("POST /api/conversations/{id}/devolver", h.Devolver)
	mux.HandleFunc("POST /api/conversations/{id}/transferir", h.Transferir)
	mux.HandleFunc("POST /api/conversations/{id}/resolver", h.Resolver)
}

// List returns conversations for stores allocated to the authenticated attendant.
func (h *Handler) List(w http.ResponseWriter, r *http.Request) {
	claims := getClaims(w, r)
	if claims == nil {
		return
	}

	lojas, err := getAtendenteLojas(r.Context(), claims.UserID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "database error")
		return
	}
	if len(lojas) == 0 {
		writeJSON(w, http.StatusOK, map[string]any{"conversations": []any{}})
		return
	}

	// For simplicity, return conversations for the first allocated store.
	// Frontend can filter by store if needed.
	lojaID := lojas[0]
	if q := r.URL.Query().Get("loja_id"); q != "" {
		if parsed, err := uuid.Parse(q); err == nil {
			for _, lid := range lojas {
				if lid == parsed {
					lojaID = parsed
					break
				}
			}
		}
	}

	limit := 50
	if v := r.URL.Query().Get("limit"); v != "" {
		if n, err := strconv.Atoi(v); err == nil && n > 0 {
			limit = n
		}
	}
	offset := 0
	if v := r.URL.Query().Get("offset"); v != "" {
		if n, err := strconv.Atoi(v); err == nil && n >= 0 {
			offset = n
		}
	}

	convs, err := ListConversasByLoja(r.Context(), lojaID, limit, offset)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to list conversations")
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"conversations": convs})
}

// Detail returns a single conversation with messages.
func (h *Handler) Detail(w http.ResponseWriter, r *http.Request) {
	claims := getClaims(w, r)
	if claims == nil {
		return
	}
	id := parseUUIDParam(w, r, "id")
	if id == uuid.Nil {
		return
	}

	conv, err := GetByID(r.Context(), id)
	if err != nil {
		writeError(w, http.StatusNotFound, "conversation not found")
		return
	}

	// Verify access
	lojas, err := getAtendenteLojas(r.Context(), claims.UserID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "database error")
		return
	}
	var hasAccess bool
	for _, lid := range lojas {
		if lid == conv.LojaResponsavelID {
			hasAccess = true
			break
		}
	}
	if !hasAccess {
		writeError(w, http.StatusForbidden, "no access to this conversation")
		return
	}

	msgs, err := ListMensagensRecentes(r.Context(), id, 100)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to load messages")
		return
	}

	writeJSON(w, http.StatusOK, ConversaDetail{
		Conversa:  *conv,
		Mensagens: msgs,
	})
}

// SendMessage sends a message from an attendant.
func (h *Handler) SendMessage(w http.ResponseWriter, r *http.Request) {
	claims := getClaims(w, r)
	if claims == nil {
		return
	}
	id := parseUUIDParam(w, r, "id")
	if id == uuid.Nil {
		return
	}

	var req SendMessageRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid json")
		return
	}
	if req.Conteudo == "" && req.MidiaURL == "" {
		writeError(w, http.StatusBadRequest, "conteudo or midia_url required")
		return
	}

	ctx := r.Context()
	conv, err := GetByID(ctx, id)
	if err != nil {
		writeError(w, http.StatusNotFound, "conversation not found")
		return
	}

	// Verify access
	lojas, err := getAtendenteLojas(ctx, claims.UserID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "database error")
		return
	}
	var hasAccess bool
	for _, lid := range lojas {
		if lid == conv.LojaResponsavelID {
			hasAccess = true
			break
		}
	}
	if !hasAccess {
		writeError(w, http.StatusForbidden, "no access to this conversation")
		return
	}

	midiaTipo := req.MidiaTipo
	if midiaTipo == "" {
		midiaTipo = "text"
	}
	msg := &Mensagem{
		ConversaID: conv.ID,
		AutorTipo:  "atendente",
		AutorID:    &claims.UserID,
		AutorNome:  claims.Email,
		Conteudo:   &req.Conteudo,
		MidiaURL:   strPtrOrNil(req.MidiaURL),
		MidiaTipo:  midiaTipo,
		Metadata:   map[string]any{},
	}
	now := time.Now().UTC()
	msg.EnviadaEm = &now

	if _, err := CreateMensagem(ctx, msg); err != nil {
		writeError(w, http.StatusInternalServerError, "failed to save message")
		return
	}

	sse.PublishNovaMensagem(conv.LojaResponsavelID, map[string]any{
		"conversa_id": conv.ID,
		"mensagem_id": msg.ID,
		"autor_tipo":  msg.AutorTipo,
		"autor_nome":  msg.AutorNome,
		"conteudo":    msg.Conteudo,
		"midia_tipo":  msg.MidiaTipo,
	})

	writeJSON(w, http.StatusCreated, msg)
}

// Assumir marks a conversation as taken by a human attendant.
func (h *Handler) Assumir(w http.ResponseWriter, r *http.Request) {
	claims := getClaims(w, r)
	if claims == nil {
		return
	}
	id := parseUUIDParam(w, r, "id")
	if id == uuid.Nil {
		return
	}

	ctx := r.Context()
	conv, err := GetByID(ctx, id)
	if err != nil {
		writeError(w, http.StatusNotFound, "conversation not found")
		return
	}

	// Verify access
	lojas, err := getAtendenteLojas(ctx, claims.UserID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "database error")
		return
	}
	var hasAccess bool
	for _, lid := range lojas {
		if lid == conv.LojaResponsavelID {
			hasAccess = true
			break
		}
	}
	if !hasAccess {
		writeError(w, http.StatusForbidden, "no access to this conversation")
		return
	}

	conv.Status = "humano"
	conv.AtendenteID = &claims.UserID
	if err := UpdateConversa(ctx, conv); err != nil {
		writeError(w, http.StatusInternalServerError, "failed to update conversation")
		return
	}

	sse.PublishAtendenteAssumiu(conv.LojaResponsavelID, map[string]any{
		"conversa_id":  conv.ID,
		"atendente_id": claims.UserID,
		"status":       "humano",
	})

	writeJSON(w, http.StatusOK, map[string]any{
		"status":       "humano",
		"atendente_id": claims.UserID,
	})
}

// Devolver returns a conversation to the AI agent.
func (h *Handler) Devolver(w http.ResponseWriter, r *http.Request) {
	claims := getClaims(w, r)
	if claims == nil {
		return
	}
	id := parseUUIDParam(w, r, "id")
	if id == uuid.Nil {
		return
	}

	ctx := r.Context()
	conv, err := GetByID(ctx, id)
	if err != nil {
		writeError(w, http.StatusNotFound, "conversation not found")
		return
	}

	// Verify access
	lojas, err := getAtendenteLojas(ctx, claims.UserID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "database error")
		return
	}
	var hasAccess bool
	for _, lid := range lojas {
		if lid == conv.LojaResponsavelID {
			hasAccess = true
			break
		}
	}
	if !hasAccess {
		writeError(w, http.StatusForbidden, "no access to this conversation")
		return
	}

	conv.Status = "ia_ativa"
	conv.AtendenteID = nil
	if err := UpdateConversa(ctx, conv); err != nil {
		writeError(w, http.StatusInternalServerError, "failed to update conversation")
		return
	}

	sse.PublishStatusMudou(conv.LojaResponsavelID, map[string]any{
		"conversa_id": conv.ID,
		"status":      "ia_ativa",
	})

	writeJSON(w, http.StatusOK, map[string]any{"status": "ia_ativa"})
}

// Transferir transfers a conversation to another store.
func (h *Handler) Transferir(w http.ResponseWriter, r *http.Request) {
	claims := getClaims(w, r)
	if claims == nil {
		return
	}
	id := parseUUIDParam(w, r, "id")
	if id == uuid.Nil {
		return
	}

	var req TransferRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid json")
		return
	}
	if req.LojaDestinoID == uuid.Nil {
		writeError(w, http.StatusBadRequest, "loja_destino_id required")
		return
	}

	ctx := r.Context()
	conv, err := GetByID(ctx, id)
	if err != nil {
		writeError(w, http.StatusNotFound, "conversation not found")
		return
	}

	// Verify access to origin store
	lojas, err := getAtendenteLojas(ctx, claims.UserID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "database error")
		return
	}
	var hasAccess bool
	for _, lid := range lojas {
		if lid == conv.LojaResponsavelID {
			hasAccess = true
			break
		}
	}
	if !hasAccess {
		writeError(w, http.StatusForbidden, "no access to this conversation")
		return
	}

	// Record transfer
	origemID := conv.LojaResponsavelID
	_, err = CreateTransferencia(ctx, &Transferencia{
		ConversaID:    conv.ID,
		Tipo:          "manual",
		LojaOrigemID:  origemID,
		LojaDestinoID: req.LojaDestinoID,
		AtendenteID:   &claims.UserID,
		Motivo:        strPtrOrNil(req.Motivo),
	})
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to record transfer")
		return
	}

	// Update conversation
	conv.LojaResponsavelID = req.LojaDestinoID
	conv.Status = "ia_ativa"
	conv.AtendenteID = nil
	now := time.Now().UTC()
	conv.TransferidaEm = &now
	if err := UpdateConversa(ctx, conv); err != nil {
		writeError(w, http.StatusInternalServerError, "failed to update conversation")
		return
	}

	sse.PublishConversaTransferida(req.LojaDestinoID, map[string]any{
		"conversa_id":     conv.ID,
		"loja_origem_id":  origemID,
		"loja_destino_id": req.LojaDestinoID,
		"status":          "ia_ativa",
	})

	writeJSON(w, http.StatusOK, map[string]any{
		"status":              "ia_ativa",
		"loja_responsavel_id": req.LojaDestinoID,
	})
}

// Resolver marks a conversation as resolved.
func (h *Handler) Resolver(w http.ResponseWriter, r *http.Request) {
	claims := getClaims(w, r)
	if claims == nil {
		return
	}
	id := parseUUIDParam(w, r, "id")
	if id == uuid.Nil {
		return
	}

	ctx := r.Context()
	conv, err := GetByID(ctx, id)
	if err != nil {
		writeError(w, http.StatusNotFound, "conversation not found")
		return
	}

	// Verify access
	lojas, err := getAtendenteLojas(ctx, claims.UserID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "database error")
		return
	}
	var hasAccess bool
	for _, lid := range lojas {
		if lid == conv.LojaResponsavelID {
			hasAccess = true
			break
		}
	}
	if !hasAccess {
		writeError(w, http.StatusForbidden, "no access to this conversation")
		return
	}

	conv.Status = "resolvida"
	if err := UpdateConversa(ctx, conv); err != nil {
		writeError(w, http.StatusInternalServerError, "failed to update conversation")
		return
	}

	sse.PublishStatusMudou(conv.LojaResponsavelID, map[string]any{
		"conversa_id": conv.ID,
		"status":      "resolvida",
	})

	writeJSON(w, http.StatusOK, map[string]any{"status": "resolvida"})
}

// --- Helpers ---

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

