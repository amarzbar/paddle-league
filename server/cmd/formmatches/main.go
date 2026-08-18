// One-off ops tool: trigger match formation for a given event ID directly
// against the DB, no HTTP/session involved - see handlers.AdminFormMatches.
package main

import (
	"context"
	"fmt"
	"os"

	"paddle-league/server/internal/config"
	"paddle-league/server/internal/db"
	"paddle-league/server/internal/handlers"
)

func main() {
	if len(os.Args) < 2 {
		fmt.Println("usage: formmatches <event-id>")
		os.Exit(1)
	}
	eventID := os.Args[1]

	cfg := config.Load()
	ctx := context.Background()
	pool, err := db.New(ctx, cfg.DatabaseURL)
	if err != nil {
		panic(err)
	}
	defer pool.Close()

	api := &handlers.API{DB: pool}
	created, err := api.AdminFormMatches(ctx, eventID)
	if err != nil {
		panic(err)
	}
	fmt.Printf("created %d match(es)\n", created)
}
