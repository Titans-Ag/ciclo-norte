package main

import (
	"fmt"
	"log"
	"net/http"

	"github.com/Titans-Ag/ciclo-norte/internal/api"
	"github.com/Titans-Ag/ciclo-norte/internal/config"
	"github.com/Titans-Ag/ciclo-norte/internal/db"
	"github.com/joho/godotenv"
)

func main() {
	_ = godotenv.Load()

	cfg := config.Load()
	if err := db.Init(cfg.DatabaseURL); err != nil {
		log.Fatalf("db init: %v", err)
	}

	router := api.NewRouter(cfg)

	addr := ":" + cfg.Port
	fmt.Printf("🚀 Ciclo Norte backend running on %s\n", addr)
	if err := http.ListenAndServe(addr, router); err != nil {
		log.Fatalf("server: %v", err)
	}
}
