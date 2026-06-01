package config

import (
	"os"
)

type Config struct {
	Port            string
	DatabaseURL     string
	JWTSecret       string
	JWTExpiration   string
	OpenAIAPIKey    string
	OpenAIModel     string
	EvolutionBaseURL string
	EvolutionAPIKey string
	FrontendURL     string
}

func Load() *Config {
	return &Config{
		Port:             getEnv("APP_PORT", "8085"),
		DatabaseURL:      getEnv("DATABASE_URL", "postgres://ciconorte:ciconorte123@localhost:5432/ciconorte?sslmode=disable"),
		JWTSecret:        getEnv("JWT_SECRET", "dev-secret-change-me"),
		JWTExpiration:    getEnv("JWT_EXPIRATION_HOURS", "24"),
		OpenAIAPIKey:     getEnv("OPENAI_API_KEY", ""),
		OpenAIModel:      getEnv("OPENAI_MODEL", "gpt-4o-mini"),
		EvolutionBaseURL: getEnv("EVOLUTION_BASE_URL", "http://localhost:8080"),
		EvolutionAPIKey:  getEnv("EVOLUTION_API_KEY", ""),
		FrontendURL:      getEnv("FRONTEND_URL", "http://localhost:3002"),
	}
}

func getEnv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}
