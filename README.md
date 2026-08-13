# Racket 🎾

Host a racket-sport night, shuffle players into ever-changing teams of two
(never the same partner twice), keep live score, and chase the leaderboard.
Installable as a PWA for a near-native experience on phones.

- **Backend:** Go (chi router, pgx, JWT auth) — `server/`
- **Frontend:** Next.js 16 (App Router) + MUI v9 + framer-motion + react-icons — `web/`
- **Database:** PostgreSQL

## How it works

1. A host **creates an event** (points-to-win, win-by, max points) and gets a
   6-character join code.
2. Friends **join with the code**.
3. The host taps **"Shuffle teams & start round"**: the server pairs players
   into teams of two such that nobody repeats a teammate they've already had
   in this event (backtracking algorithm, see `server/internal/shuffle`), then
   pairs teams up into matches on courts. Byes rotate fairly when the group
   size is odd.
4. Everyone scores their match live from their phone; the app detects the win
   condition automatically (points-to-win + win-by, capped at max points).
5. Repeat for as many rounds as you like, then check the animated
   **leaderboard** (wins/losses, win %, point differential).

## Prerequisites

- Go 1.25+
- Node 20.9+
- PostgreSQL running locally (or point `DATABASE_URL` at any Postgres instance)

## 1. Database

```bash
createdb paddle_league
# or, if you use the default "postgres" role/password convention this repo expects:
psql -d postgres -c "CREATE ROLE postgres LOGIN SUPERUSER PASSWORD 'postgres';"
createdb -O postgres paddle_league
```

The server auto-applies migrations from `server/migrations/` on startup — no
separate migrate step needed.

## 2. Backend

```bash
cd server
cp .env.example .env   # adjust DATABASE_URL / JWT_SECRET as needed
go run ./cmd/server
```

Runs on `http://localhost:8080`. Run the shuffle algorithm's unit tests with:

```bash
go test ./...
```

## 3. Frontend

```bash
cd web
cp .env.local.example .env.local   # NEXT_PUBLIC_API_URL, defaults to localhost:8080
npm install
npm run dev
```

Runs on `http://localhost:3000`. Open it on your phone (same network, use the
`Network:` URL Next.js prints) and use "Add to Home Screen" / the install
prompt to run it as a PWA.

## Project layout

```
server/
  cmd/server/main.go        entrypoint: config, DB, migrations, HTTP server
  internal/auth/            JWT + bcrypt
  internal/db/              pgxpool + migration runner
  internal/handlers/        HTTP handlers (auth, events, matches, leaderboard)
  internal/middleware/      cookie-based auth middleware
  internal/models/          shared structs
  internal/shuffle/         the never-repeat-a-teammate pairing algorithm (+tests)
  migrations/                SQL schema

web/
  src/app/                  routes: /login /register /dashboard /events/[id] /events/[id]/leaderboard
  src/components/           AppShell, MatchScoreboard, EventCard, ThemeRegistry, AuthProvider, ...
  src/lib/                  theme.ts (MD3 tokens), api client, shared TS types
  public/                   manifest.json, PWA icons, sw.js
```

## Notes / things to harden before production

- Scoring is open to any signed-in participant (matches how a host runs
  scoring live during play). Lock this down to host-only if you want stricter
  control.
- Live updates use short-interval polling (SWR `refreshInterval`), not
  WebSockets — fine for small groups, consider SSE/WebSockets if you scale up
  simultaneous courts/viewers.
- `JWT_SECRET` and DB credentials in `.env.example` are dev-only placeholders.
