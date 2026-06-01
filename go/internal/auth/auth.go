package auth

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/Titans-Ag/ciclo-norte/internal/db"
	"github.com/google/uuid"
	"github.com/golang-jwt/jwt/v5"
	"golang.org/x/crypto/bcrypt"
)

// Claims represents the JWT claims.
type Claims struct {
	UserID uuid.UUID `json:"user_id"`
	Email  string    `json:"email"`
	Role   string    `json:"role"`
	jwt.RegisteredClaims
}

// contextKey is the key type for storing claims in request context.
type contextKey int

const claimsContextKey contextKey = iota

// HashPassword hashes a password using bcrypt with cost 12.
func HashPassword(password string) (string, error) {
	bytes, err := bcrypt.GenerateFromPassword([]byte(password), 12)
	if err != nil {
		return "", fmt.Errorf("hash password: %w", err)
	}
	return string(bytes), nil
}

// CheckPassword compares a plain password with a bcrypt hash.
func CheckPassword(password, hash string) error {
	return bcrypt.CompareHashAndPassword([]byte(hash), []byte(password))
}

// GenerateToken creates a JWT for the given user.
func GenerateToken(secret string, expirationHours int, userID uuid.UUID, email, role string) (string, error) {
	now := time.Now().UTC()
	claims := Claims{
		UserID: userID,
		Email:  email,
		Role:   role,
		RegisteredClaims: jwt.RegisteredClaims{
			Subject:   userID.String(),
			IssuedAt:  jwt.NewNumericDate(now),
			ExpiresAt: jwt.NewNumericDate(now.Add(time.Duration(expirationHours) * time.Hour)),
		},
	}
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString([]byte(secret))
}

// ParseToken validates and parses a JWT string.
func ParseToken(secret string, tokenString string) (*Claims, error) {
	token, err := jwt.ParseWithClaims(tokenString, &Claims{}, func(token *jwt.Token) (any, error) {
		if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, fmt.Errorf("unexpected signing method: %v", token.Header["alg"])
		}
		return []byte(secret), nil
	})
	if err != nil {
		return nil, fmt.Errorf("parse token: %w", err)
	}
	if claims, ok := token.Claims.(*Claims); ok && token.Valid {
		return claims, nil
	}
	return nil, fmt.Errorf("invalid token claims")
}

// JWTMiddleware returns an HTTP middleware that validates JWT tokens.
func JWTMiddleware(secret string) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			authHeader := r.Header.Get("Authorization")
			if authHeader == "" {
				writeError(w, http.StatusUnauthorized, "missing authorization header")
				return
			}
			parts := strings.SplitN(authHeader, " ", 2)
			if len(parts) != 2 || strings.ToLower(parts[0]) != "bearer" {
				writeError(w, http.StatusUnauthorized, "invalid authorization header format")
				return
			}
			claims, err := ParseToken(secret, parts[1])
			if err != nil {
				writeError(w, http.StatusUnauthorized, "invalid or expired token")
				return
			}
			ctx := context.WithValue(r.Context(), claimsContextKey, claims)
			next.ServeHTTP(w, r.WithContext(ctx))
		})
	}
}

// ClaimsFromContext extracts claims from the request context.
func ClaimsFromContext(ctx context.Context) *Claims {
	claims, _ := ctx.Value(claimsContextKey).(*Claims)
	return claims
}

// RequireRole returns a middleware that only allows the given roles.
func RequireRole(roles ...string) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			claims := ClaimsFromContext(r.Context())
			if claims == nil {
				writeError(w, http.StatusUnauthorized, "unauthorized")
				return
			}
			for _, role := range roles {
				if claims.Role == role {
					next.ServeHTTP(w, r)
					return
				}
			}
			writeError(w, http.StatusForbidden, "insufficient permissions")
		})
	}
}

// --- HTTP Handlers ---

// RegisterRequest is the payload for registration.
type RegisterRequest struct {
	Email    string `json:"email"`
	Nome     string `json:"nome"`
	Senha    string `json:"senha"`
	LojaSlug string `json:"loja_slug,omitempty"`
}

// LoginRequest is the payload for login.
type LoginRequest struct {
	Email string `json:"email"`
	Senha string `json:"senha"`
}

// TokenResponse is returned on successful login.
type TokenResponse struct {
	Token     string    `json:"token"`
	ExpiresAt time.Time `json:"expires_at"`
	UserID    uuid.UUID `json:"user_id"`
	Email     string    `json:"email"`
	Nome      string    `json:"nome"`
	Role      string    `json:"role"`
}

// HandlerRegister creates the first admin when the database is empty,
// or a new atendente if an admin exists (admin only).
func HandlerRegister(secret string, expirationHours int) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			writeError(w, http.StatusMethodNotAllowed, "method not allowed")
			return
		}

		var req RegisterRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			writeError(w, http.StatusBadRequest, "invalid json")
			return
		}
		if req.Email == "" || req.Nome == "" || req.Senha == "" {
			writeError(w, http.StatusBadRequest, "email, nome and senha are required")
			return
		}

		ctx := r.Context()

		// Check if any atendente exists
		var count int64
		err := db.Pool.QueryRow(ctx, `SELECT COUNT(*) FROM atendente`).Scan(&count)
		if err != nil {
			writeError(w, http.StatusInternalServerError, "database error")
			return
		}

		role := "atendente"
		if count == 0 {
			role = "admin"
		}

		// If not the first user, require admin
		if count > 0 {
			claims := ClaimsFromContext(ctx)
			if claims == nil || claims.Role != "admin" {
				writeError(w, http.StatusForbidden, "only admin can register new users")
				return
			}
		}

		hash, err := HashPassword(req.Senha)
		if err != nil {
			writeError(w, http.StatusInternalServerError, "failed to hash password")
			return
		}

		userID := uuid.New()
		_, err = db.Pool.Exec(ctx,
			`INSERT INTO atendente (id, email, nome, senha_hash, role) VALUES ($1, $2, $3, $4, $5)`,
			userID, req.Email, req.Nome, hash, role,
		)
		if err != nil {
			if strings.Contains(err.Error(), "unique constraint") {
				writeError(w, http.StatusConflict, "email already exists")
				return
			}
			writeError(w, http.StatusInternalServerError, "failed to create user")
			return
		}

		// If loja_slug provided and not first user, allocate
		if req.LojaSlug != "" && count > 0 {
			var lojaID uuid.UUID
			err = db.Pool.QueryRow(ctx, `SELECT id FROM loja WHERE slug = $1`, req.LojaSlug).Scan(&lojaID)
			if err == nil {
				_, _ = db.Pool.Exec(ctx,
					`INSERT INTO atendente_loja (atendente_id, loja_id, alocado_por) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING`,
					userID, lojaID, claimsFromContextOrNil(ctx),
				)
			}
		}

		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusCreated)
		json.NewEncoder(w).Encode(map[string]any{
			"id":    userID,
			"email": req.Email,
			"nome":  req.Nome,
			"role":  role,
		})
	}
}

func claimsFromContextOrNil(ctx context.Context) *uuid.UUID {
	if c := ClaimsFromContext(ctx); c != nil {
		return &c.UserID
	}
	return nil
}

// HandlerLogin authenticates a user and returns a JWT.
func HandlerLogin(secret string, expirationHours int) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			writeError(w, http.StatusMethodNotAllowed, "method not allowed")
			return
		}

		var req LoginRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			writeError(w, http.StatusBadRequest, "invalid json")
			return
		}
		if req.Email == "" || req.Senha == "" {
			writeError(w, http.StatusBadRequest, "email and senha are required")
			return
		}

		ctx := r.Context()
		var userID uuid.UUID
		var nome, hash, role string
		err := db.Pool.QueryRow(ctx,
			`SELECT id, nome, senha_hash, role FROM atendente WHERE email = $1 AND ativo = true`,
			req.Email,
		).Scan(&userID, &nome, &hash, &role)
		if err != nil {
			writeError(w, http.StatusUnauthorized, "invalid credentials")
			return
		}

		if err := CheckPassword(req.Senha, hash); err != nil {
			writeError(w, http.StatusUnauthorized, "invalid credentials")
			return
		}

		// Update ultimo_acesso
		_, _ = db.Pool.Exec(ctx, `UPDATE atendente SET ultimo_acesso = now() WHERE id = $1`, userID)

		tokenStr, err := GenerateToken(secret, expirationHours, userID, req.Email, role)
		if err != nil {
			writeError(w, http.StatusInternalServerError, "failed to generate token")
			return
		}

		expiresAt := time.Now().UTC().Add(time.Duration(expirationHours) * time.Hour)
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(TokenResponse{
			Token:     tokenStr,
			ExpiresAt: expiresAt,
			UserID:    userID,
			Email:     req.Email,
			Nome:      nome,
			Role:      role,
		})
	}
}

// HandlerLogout simply returns OK. Token invalidation is client-side.
func HandlerLogout(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeError(w, http.StatusMethodNotAllowed, "method not allowed")
		return
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]bool{"ok": true})
}

// ParseExpiration parses the JWT expiration string.
func ParseExpiration(s string) int {
	v, err := strconv.Atoi(s)
	if err != nil || v <= 0 {
		return 24 // default
	}
	return v
}

func writeError(w http.ResponseWriter, code int, message string) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(code)
	json.NewEncoder(w).Encode(map[string]string{"error": message})
}
