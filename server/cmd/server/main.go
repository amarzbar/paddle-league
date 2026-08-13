package main

import (
	"context"
	"log"
	"net/http"
	"os"

	"paddle-league/server/internal/config"
	"paddle-league/server/internal/db"
	"paddle-league/server/internal/handlers"
)

func main() {
	cfg := config.Load()
	ctx := context.Background()

	pool, err := db.New(ctx, cfg.DatabaseURL)
	if err != nil {
		log.Fatalf("database connection failed: %v", err)
	}
	defer pool.Close()

	migrationsDir := "migrations"
	if envDir := os.Getenv("MIGRATIONS_DIR"); envDir != "" {
		migrationsDir = envDir
	}
	if err := db.Migrate(ctx, pool, migrationsDir); err != nil {
		log.Fatalf("migration failed: %v", err)
	}

	api := &handlers.API{
		DB:        pool,
		JWTSecret: cfg.JWTSecret,
		Prod:      os.Getenv("ENV") == "production",
	}

	router := handlers.NewRouter(api, cfg.AllowedOrigin)

	log.Printf("paddle-league server listening on :%s", cfg.Port)
	if err := http.ListenAndServe(":"+cfg.Port, router); err != nil {
		log.Fatal(err)
	}
}
