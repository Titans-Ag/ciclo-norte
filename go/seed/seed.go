package main

import (
	"context"
	"fmt"
	"log"
	"os"

	"github.com/jackc/pgx/v5/pgxpool"
)

func main() {
	dbURL := os.Getenv("DATABASE_URL")
	if dbURL == "" {
		dbURL = "postgres://ciconorte:ciconorte123@localhost:5432/ciconorte?sslmode=disable"
	}

	ctx := context.Background()
	pool, err := pgxpool.New(ctx, dbURL)
	if err != nil {
		log.Fatalf("connect: %v", err)
	}
	defer pool.Close()

	// Run migrations
	sql, err := os.ReadFile("../migrations/001_schema.up.sql")
	if err != nil {
		log.Fatalf("read schema: %v", err)
	}
	if _, err := pool.Exec(ctx, string(sql)); err != nil {
		log.Fatalf("exec schema: %v", err)
	}
	fmt.Println("✅ Schema applied")

	// Run seed
	seedSQL, err := os.ReadFile("seed.sql")
	if err != nil {
		log.Fatalf("read seed: %v", err)
	}
	if _, err := pool.Exec(ctx, string(seedSQL)); err != nil {
		log.Fatalf("exec seed: %v", err)
	}
	fmt.Println("✅ Seed applied")
}
