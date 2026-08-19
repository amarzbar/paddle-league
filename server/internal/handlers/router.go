package handlers

import (
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
	"github.com/go-chi/cors"
	custommw "paddle-league/server/internal/middleware"
)

func NewRouter(a *API, allowedOrigin string) http.Handler {
	r := chi.NewRouter()

	r.Use(middleware.Logger)
	r.Use(cors.Handler(cors.Options{
		AllowedOrigins:   []string{allowedOrigin},
		AllowedMethods:   []string{"GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"},
		AllowedHeaders:   []string{"Accept", "Content-Type"},
		AllowCredentials: true,
		MaxAge:           300,
	}))

	r.Get("/healthz", func(w http.ResponseWriter, r *http.Request) {
		writeJSON(w, http.StatusOK, map[string]bool{"ok": true})
	})

	r.Route("/api", func(r chi.Router) {
		r.Post("/auth/register", a.Register)
		r.Post("/auth/login", a.Login)
		r.Post("/auth/logout", a.Logout)

		r.Group(func(r chi.Router) {
			r.Use(custommw.RequireAuth(a.JWTSecret))

			r.Get("/me", a.Me)

			r.Post("/events", a.CreateEvent)
			r.Post("/events/aggregate", a.CreateAggregateEvent)
			r.Get("/events", a.ListMyEvents)
			r.Get("/events/public", a.ListPublicEvents)
			r.Post("/events/join", a.JoinEvent)
			r.Get("/events/{id}", a.GetEvent)
			r.Post("/events/{id}/join", a.JoinPublicEvent) // public events only - no code needed
			r.Post("/events/{id}/start", a.StartEvent)     // precomputes + activates the whole Americano schedule
			r.Post("/events/{id}/complete", a.CompleteEvent)
			r.Post("/events/{id}/stop", a.CompleteEvent) // alias: host stopping an event early is the same action as completing it
			r.Post("/events/{id}/matches/manual", a.AddManualMatch)
			r.Delete("/events/{id}", a.DeleteEvent)
			r.Get("/events/{id}/leaderboard", a.Leaderboard)

			r.Post("/matches/{id}/score", a.Score)
			r.Post("/matches/{id}/timeout", a.Timeout) // client-side countdown hitting zero
		})
	})

	return r
}
