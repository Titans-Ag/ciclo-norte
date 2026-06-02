package api

import (
	"encoding/json"
	"net/http"

	"github.com/Titans-Ag/ciclo-norte/internal/admin"
	"github.com/Titans-Ag/ciclo-norte/internal/agent"
	"github.com/Titans-Ag/ciclo-norte/internal/auth"
	"github.com/Titans-Ag/ciclo-norte/internal/config"
	"github.com/Titans-Ag/ciclo-norte/internal/conversation"
	"github.com/Titans-Ag/ciclo-norte/internal/db"
	"github.com/Titans-Ag/ciclo-norte/internal/evolution"
	"github.com/Titans-Ag/ciclo-norte/internal/sse"
)

// NewRouter creates the application router with all routes registered.
func NewRouter(cfg *config.Config) http.Handler {
	mux := http.NewServeMux()

	jwtMW := auth.JWTMiddleware(cfg.JWTSecret)
	sse.JWTSecret = cfg.JWTSecret

	// Health check
	mux.HandleFunc("GET /healthz", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.Write([]byte(`{"ok":true,"app":"ciclo-norte"}`))
	})

	// Auth routes (public)
	expHours := auth.ParseExpiration(cfg.JWTExpiration)
	mux.HandleFunc("POST /api/auth/register", auth.HandlerRegister(cfg.JWTSecret, expHours))
	mux.HandleFunc("POST /api/auth/login", auth.HandlerLogin(cfg.JWTSecret, expHours))
	mux.HandleFunc("POST /api/auth/logout", auth.HandlerLogout)

	// Authenticated me
	mux.Handle("GET /api/me", jwtMW(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		claims := auth.ClaimsFromContext(r.Context())
		if claims == nil {
			writeError(w, http.StatusUnauthorized, "unauthorized")
			return
		}
		var nome string
		_ = db.Pool.QueryRow(r.Context(), `SELECT nome FROM atendente WHERE id = $1`, claims.UserID).Scan(&nome)
		writeJSON(w, http.StatusOK, map[string]any{
			"id":    claims.UserID,
			"email": claims.Email,
			"nome":  nome,
			"role":  claims.Role,
		})
	})))

	// Conversation routes (protected)
	evoClient := evolution.NewClient(cfg.EvolutionBaseURL, cfg.EvolutionAPIKey)
	convHandler := conversation.NewHandler(cfg, evoClient)
	convRouter := http.NewServeMux()
	convHandler.RegisterRoutes(convRouter)
	mux.Handle("/api/conversations", jwtMW(convRouter))
	mux.Handle("/api/conversations/", jwtMW(convRouter))

	// Agent process endpoint (protected — admin or system caller)
	mux.Handle("POST /api/agent/process", jwtMW(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		claims := auth.ClaimsFromContext(r.Context())
		if claims == nil {
			writeError(w, http.StatusUnauthorized, "unauthorized")
			return
		}
		var req agent.ProcessRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			writeError(w, http.StatusBadRequest, "invalid json")
			return
		}
		if req.AutorID == [16]byte{} {
			req.AutorID = claims.UserID
		}
		if req.AutorNome == "" {
			req.AutorNome = claims.Email
		}
		result, err := agent.ProcessMessage(r.Context(), cfg, req)
		if err != nil {
			writeError(w, http.StatusInternalServerError, err.Error())
			return
		}
		writeJSON(w, http.StatusOK, result)
	})))

	// SSE events endpoint (token via query param for EventSource compatibility)
	mux.HandleFunc("GET /api/events", sse.Handler)
	// Polling fallback
	mux.HandleFunc("GET /api/events/poll", sse.PollingHandler)

	// Admin routes (protected + admin only)
	mux.Handle("GET /api/lojas", jwtMW(admin.RequireAdmin(http.HandlerFunc(admin.ListLojas))))
	mux.Handle("POST /api/lojas", jwtMW(admin.RequireAdmin(http.HandlerFunc(admin.CreateLoja))))
	mux.Handle("PUT /api/lojas/{id}", jwtMW(admin.RequireAdmin(http.HandlerFunc(admin.UpdateLoja))))
	mux.Handle("DELETE /api/lojas/{id}", jwtMW(admin.RequireAdmin(http.HandlerFunc(admin.DeleteLoja))))

	mux.Handle("GET /api/atendentes", jwtMW(admin.RequireAdmin(http.HandlerFunc(admin.ListAtendentes))))
	mux.Handle("POST /api/atendentes", jwtMW(admin.RequireAdmin(http.HandlerFunc(admin.CreateAtendente))))
	mux.Handle("PUT /api/atendentes/{id}", jwtMW(admin.RequireAdmin(http.HandlerFunc(admin.UpdateAtendente))))
	mux.Handle("POST /api/atendentes/{id}/lojas", jwtMW(admin.RequireAdmin(http.HandlerFunc(admin.ToggleAtendenteLoja))))

	mux.Handle("GET /api/admin/agent-config", jwtMW(admin.RequireAdmin(http.HandlerFunc(admin.GetAgentConfig))))
	mux.Handle("PUT /api/admin/agent-config", jwtMW(admin.RequireAdmin(http.HandlerFunc(admin.UpdateAgentConfig))))
	mux.Handle("GET /api/admin/whatsapp-status", jwtMW(admin.RequireAdmin(http.HandlerFunc(admin.ListWhatsAppInstances))))
	mux.Handle("POST /api/admin/whatsapp-status/{id}/reconnect", jwtMW(admin.RequireAdmin(http.HandlerFunc(admin.ReconnectWhatsApp))))

	// Webhook routes (public, called by Evolution)
	webhookHandler := evolution.NewHandler(cfg)
	webhookHandler.RegisterRoutes(mux)

	return corsMiddleware(mux)
}

func corsMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")
		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusNoContent)
			return
		}
		next.ServeHTTP(w, r)
	})
}

func writeError(w http.ResponseWriter, code int, message string) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(code)
	json.NewEncoder(w).Encode(map[string]string{"error": message})
}

func writeJSON(w http.ResponseWriter, code int, payload any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(code)
	json.NewEncoder(w).Encode(payload)
}
