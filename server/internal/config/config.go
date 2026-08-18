package config

import (
	"os"

	"github.com/joho/godotenv"
)

type Config struct {
	Port          string
	DatabaseURL   string
	JWTSecret     string
	AllowedOrigin string
	// CrossSiteCookies: the frontend and backend normally share a site (or
	// are on localhost), where SameSite=Lax is the safer default. Set this
	// when they're genuinely on different sites (e.g. two separate
	// trycloudflare.com tunnel subdomains, or a real split-domain deploy) -
	// Lax cookies aren't sent on cross-site fetch() calls at all, which
	// looks exactly like "login succeeds but every call after it is logged
	// out." Forces SameSite=None (which itself requires Secure).
	CrossSiteCookies bool
}

func Load() Config {
	_ = godotenv.Load()

	return Config{
		Port:             getEnv("PORT", "8080"),
		DatabaseURL:      getEnv("DATABASE_URL", "postgres://postgres:postgres@localhost:5432/paddle_league?sslmode=disable"),
		JWTSecret:        getEnv("JWT_SECRET", "dev-secret-change-me"),
		AllowedOrigin:    getEnv("ALLOWED_ORIGIN", "http://localhost:5173"), // web/ is now a Vite SPA (was Next.js on :3000)
		CrossSiteCookies: getEnv("CROSS_SITE_COOKIES", "") == "true",
	}
}

func getEnv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}
