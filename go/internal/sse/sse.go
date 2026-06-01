package sse

import (
	"encoding/json"
	"fmt"
	"net/http"
	"strconv"
	"sync"
	"time"

	"github.com/Titans-Ag/ciclo-norte/internal/auth"
	"github.com/Titans-Ag/ciclo-norte/internal/db"
	"github.com/google/uuid"
)

// JWTSecret is set by the API layer so SSE handlers can validate tokens
// from query parameters (EventSource cannot set Authorization headers).
var JWTSecret string

// Event represents a server-sent event.
type Event struct {
	ID        string `json:"id"`
	Type      string `json:"type"`      // nova_mensagem, conversa_transferida, status_mudou, atendente_assumiu
	Payload   []byte `json:"payload"`   // JSON payload
	LojaID    string `json:"loja_id"`     // empty = broadcast all
	CreatedAt int64  `json:"created_at"` // unix ms
}

// Hub manages SSE connections and broadcasts events.
type Hub struct {
	mu          sync.RWMutex
	connections map[uuid.UUID]*Connection // keyed by connection id
	events      []Event                   // circular buffer / history
	eventsMu    sync.RWMutex
	maxHistory  int
}

// Connection represents a single SSE client connection.
type Connection struct {
	ID        uuid.UUID
	UserID    uuid.UUID
	LojaIDs   map[uuid.UUID]struct{}
	Channel   chan Event
	LastEvent string // Last-Event-ID
}

// NewHub creates a new SSE hub.
func NewHub() *Hub {
	return &Hub{
		connections: make(map[uuid.UUID]*Connection),
		maxHistory:  1000,
	}
}

// Global hub instance.
var DefaultHub = NewHub()

// AddConnection registers a new SSE connection.
func (h *Hub) AddConnection(c *Connection) {
	h.mu.Lock()
	defer h.mu.Unlock()
	h.connections[c.ID] = c
}

// RemoveConnection unregisters an SSE connection.
func (h *Hub) RemoveConnection(id uuid.UUID) {
	h.mu.Lock()
	defer h.mu.Unlock()
	delete(h.connections, id)
}

// Broadcast sends an event to all matching connections.
func (h *Hub) Broadcast(e Event) {
	h.mu.RLock()
	defer h.mu.RUnlock()

	for _, conn := range h.connections {
		// If event targets a specific loja, filter by connection's allocated lojas
		if e.LojaID != "" {
			lid, err := uuid.Parse(e.LojaID)
			if err == nil {
				if _, ok := conn.LojaIDs[lid]; !ok {
					continue
				}
			}
		}
		select {
		case conn.Channel <- e:
		default:
		}
	}

	// Append to history
	h.eventsMu.Lock()
	h.events = append(h.events, e)
	if len(h.events) > h.maxHistory {
		h.events = h.events[len(h.events)-h.maxHistory:]
	}
	h.eventsMu.Unlock()
}

// GetHistorySince returns events after a given event ID.
func (h *Hub) GetHistorySince(lastID string) []Event {
	h.eventsMu.RLock()
	defer h.eventsMu.RUnlock()

	if lastID == "" {
		return nil
	}
	var out []Event
	found := false
	for _, e := range h.events {
		if !found && e.ID == lastID {
			found = true
			continue
		}
		if found {
			out = append(out, e)
		}
	}
	return out
}

// Publish helpers -----------------------------------------------------------

// PublishNovaMensagem broadcasts a new message event.
func PublishNovaMensagem(lojaID uuid.UUID, payload map[string]any) {
	b, _ := json.Marshal(payload)
	e := Event{
		ID:        uuid.NewString(),
		Type:      "nova_mensagem",
		Payload:   b,
		LojaID:    lojaID.String(),
		CreatedAt: time.Now().UnixMilli(),
	}
	DefaultHub.Broadcast(e)
}

// PublishConversaTransferida broadcasts a transfer event.
func PublishConversaTransferida(lojaID uuid.UUID, payload map[string]any) {
	b, _ := json.Marshal(payload)
	e := Event{
		ID:        uuid.NewString(),
		Type:      "conversa_transferida",
		Payload:   b,
		LojaID:    lojaID.String(),
		CreatedAt: time.Now().UnixMilli(),
	}
	DefaultHub.Broadcast(e)
}

// PublishStatusMudou broadcasts a status change event.
func PublishStatusMudou(lojaID uuid.UUID, payload map[string]any) {
	b, _ := json.Marshal(payload)
	e := Event{
		ID:        uuid.NewString(),
		Type:      "status_mudou",
		Payload:   b,
		LojaID:    lojaID.String(),
		CreatedAt: time.Now().UnixMilli(),
	}
	DefaultHub.Broadcast(e)
}

// PublishAtendenteAssumiu broadcasts an attendant assignment event.
func PublishAtendenteAssumiu(lojaID uuid.UUID, payload map[string]any) {
	b, _ := json.Marshal(payload)
	e := Event{
		ID:        uuid.NewString(),
		Type:      "atendente_assumiu",
		Payload:   b,
		LojaID:    lojaID.String(),
		CreatedAt: time.Now().UnixMilli(),
	}
	DefaultHub.Broadcast(e)
}

// HTTP Handler --------------------------------------------------------------

func claimsFromQuery(r *http.Request) *auth.Claims {
	token := r.URL.Query().Get("token")
	if token == "" {
		return nil
	}
	claims, err := auth.ParseToken(JWTSecret, token)
	if err != nil {
		return nil
	}
	return claims
}

// Handler serves the SSE endpoint GET /api/events.
func Handler(w http.ResponseWriter, r *http.Request) {
	claims := claimsFromQuery(r)
	if claims == nil {
		http.Error(w, `{"error":"unauthorized"}`, http.StatusUnauthorized)
		return
	}

	ctx := r.Context()
	userID := claims.UserID

	// Load lojas allocated to this attendant
	lojaIDs := make(map[uuid.UUID]struct{})
	rows, err := db.Pool.Query(ctx, `
		SELECT loja_id FROM atendente_loja WHERE atendente_id = $1
	`, userID)
	if err != nil {
		http.Error(w, `{"error":"database error"}`, http.StatusInternalServerError)
		return
	}
	for rows.Next() {
		var lid uuid.UUID
		if err := rows.Scan(&lid); err == nil {
			lojaIDs[lid] = struct{}{}
		}
	}
	rows.Close()

	conn := &Connection{
		ID:      uuid.New(),
		UserID:  userID,
		LojaIDs: lojaIDs,
		Channel: make(chan Event, 10),
	}
	if lastID := r.Header.Get("Last-Event-ID"); lastID != "" {
		conn.LastEvent = lastID
	}

	DefaultHub.AddConnection(conn)
	defer DefaultHub.RemoveConnection(conn.ID)

	w.Header().Set("Content-Type", "text/event-stream")
	w.Header().Set("Cache-Control", "no-cache")
	w.Header().Set("Connection", "keep-alive")
	w.Header().Set("Access-Control-Allow-Origin", "*")

	flusher, ok := w.(http.Flusher)
	if !ok {
		http.Error(w, `{"error":"streaming unsupported"}`, http.StatusInternalServerError)
		return
	}

	// Send any missed events
	if conn.LastEvent != "" {
		for _, e := range DefaultHub.GetHistorySince(conn.LastEvent) {
			writeEvent(w, e)
		}
		flusher.Flush()
	}

	// Keep connection alive
	ticker := time.NewTicker(30 * time.Second)
	defer ticker.Stop()

	for {
		select {
		case e := <-conn.Channel:
			writeEvent(w, e)
			flusher.Flush()
		case <-ticker.C:
			fmt.Fprintf(w, ":ping\n\n")
			flusher.Flush()
		case <-ctx.Done():
			return
		}
	}
}

func writeEvent(w http.ResponseWriter, e Event) {
	fmt.Fprintf(w, "id: %s\n", e.ID)
	fmt.Fprintf(w, "event: %s\n", e.Type)
	fmt.Fprintf(w, "data: %s\n", string(e.Payload))
	fmt.Fprintf(w, "\n")
}

// ---------------------------------------------------------------------------
// Convenience HTTP handlers for frontend polling fallback
// ---------------------------------------------------------------------------

// PollingHandler returns recent events as JSON (fallback when SSE fails).
func PollingHandler(w http.ResponseWriter, r *http.Request) {
	claims := claimsFromQuery(r)
	if claims == nil {
		http.Error(w, `{"error":"unauthorized"}`, http.StatusUnauthorized)
		return
	}

	ctx := r.Context()
	userID := claims.UserID
	lastID := r.URL.Query().Get("last_id")
	limitStr := r.URL.Query().Get("limit")
	limit := 50
	if v, err := strconv.Atoi(limitStr); err == nil && v > 0 && v <= 200 {
		limit = v
	}

	// Get loja IDs
	rows, err := db.Pool.Query(ctx, `SELECT loja_id FROM atendente_loja WHERE atendente_id = $1`, userID)
	if err != nil {
		http.Error(w, `{"error":"database error"}`, http.StatusInternalServerError)
		return
	}
	var lojaUUIDs []uuid.UUID
	for rows.Next() {
		var lid uuid.UUID
		if err := rows.Scan(&lid); err == nil {
			lojaUUIDs = append(lojaUUIDs, lid)
		}
	}
	rows.Close()

	// Build history
	DefaultHub.eventsMu.RLock()
	var events []Event
	found := lastID == ""
	for _, e := range DefaultHub.events {
		if !found && e.ID == lastID {
			found = true
			continue
		}
		if !found {
			continue
		}
		// Filter by loja
		if e.LojaID != "" {
			lid, err := uuid.Parse(e.LojaID)
			if err == nil {
				ok := false
				for _, allocated := range lojaUUIDs {
					if allocated == lid {
						ok = true
						break
					}
				}
				if !ok {
					continue
				}
			}
		}
		events = append(events, e)
		if len(events) >= limit {
			break
		}
	}
	DefaultHub.eventsMu.RUnlock()

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]any{
		"events": events,
	})
}
