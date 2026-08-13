# Racket — product brief for design iteration

Paste this into Figma Make to iterate on the visual design. It describes the
product, the flows, the current visual system, and the specific product
mechanics the UI has to communicate — not the code.

## What it is

Racket is a PWA for hosting casual racket-sport game nights (padel,
pickleball, or similar) with 4+ players. A host creates an event, friends
join with a 6-character code, and once there are enough people, the app
continuously shuffles players into new 2-vs-2 teams — never repeating a
teammate — as courts free up, tracking live score per court, until every
possible non-repeating pairing has been exhausted. Then the event ends
itself and shows final standings.

It is not a tournament bracket app and not a synchronized "round 1, round 2"
app. That distinction is the most important thing to design around.

## The core mechanic (design around this, don't hide it)

Every court runs independently, asynchronously:

- The moment a court's match ends, those 4 players return to a shared "free"
  pool.
- The app immediately checks whether a valid new group exists — 4 free
  players who haven't been teammates yet — and strictly prioritizes whoever
  has played the *fewest* games so far. Nobody plays a second game while
  someone available hasn't played a first.
- If a valid group exists, a new match starts instantly on some court. No
  host action required.
- If not enough players are free, or the free ones have already exhausted
  their valid pairings, they wait — a "pending" state — until the pool
  changes.
- Multiple courts run in parallel and finish independently; there's no
  "everyone waits for the slowest court" concept.
- The event ends itself automatically the moment nobody left can be
  regrouped without repeating a past teammate.

The interface needs to make three things legible at a glance: *which court
am I on right now*, *what's my status when I'm between games* (queue
position, what's happening elsewhere), and *this whole thing is live and
asynchronous*, not turn-based.

## Screens / flows

1. **Welcome / splash** (unauthenticated) — brand moment, get started / sign in.
2. **Login / Register.**
3. **My Events** — list of events the user's in, filterable (lobby / active /
   completed), entry points to host a new one or join by code.
4. **Create Event** — name, and a scoring format (first-to-11/15/21/24).
   Reaching the target always wins outright, no "win by 2" grace period at
   the cap — hitting the number ends it.
5. **Join by code** — big, clear 6-character code entry.
6. **Event Lobby** (pre-start) — roster of who's joined, the join code to
   share, host's "start the games" action (needs 4+ people), everyone else
   sees a waiting state.
7. **Live — My Court** — the primary view while playing: big live score,
   court label, +/- controls, only for the match you're actually in.
8. **Live — Pending** — shown the moment your match ends and you're waiting
   to be re-matched. Shows queue position in plain language ("N players
   need to play before you"), how many players are free vs. total, and
   auto-clears the instant you're reassigned — no manual refresh.
9. **Live — All Courts** — toggle available to *everyone*, not just the
   host: every court's current score, and completed courts keep their final
   score visible rather than disappearing. This is what a player between
   games looks at instead of a blank waiting screen.
10. **"You're in!"** — a brief, celebratory transition the instant you're
    freshly assigned to a court (shows your court number).
11. **Leaderboard** (live, mid-event) — ranked list, toggle between sorting
    by wins and sorting by point differential, your own row visually
    distinct from the pack.
12. **Event Recap** (after it ends, automatically or via the host) — final
    standings plus a full match-by-match breakdown, read-only.
13. **Profile** — currently minimal (avatar, name, email, log out). Real
    opportunity for design/content expansion.
14. **Host-only controls**, visible only while hosting: a manual "check for
    new games" nudge (fallback if the automatic formation seems stuck), and
    "end event" (should read as a deliberate, slightly destructive action).

## Current visual system (a starting point to riff on, not a constraint)

- **Palette**: deep ink navy `#14304B` as the primary dark surface, warm
  paper off-white `#FBFAF7` as the light background (not clinical pure
  white), punchy lime-green `#C4F135` as the primary accent/CTA color, coral
  `#FF6F59` as a secondary accent (also "team 2" color on the scoreboard),
  muted warm greys for secondary text/borders.
- **Type**: three-font system. Space Grotesk (bold, geometric) for headings
  and buttons; Hanken Grotesk for body text; Space Mono for *everything
  numeric* — scores, join codes, stats — it's what gives the app a
  scoreboard/data feel rather than a generic social-app feel.
- **Shape**: fully-pill primary buttons filled lime, softer rounded cards
  (14–20px radius), circular color-coded avatars with initials.
- **Signature motif**: a 2×2 grid split by a crosshair — originally a
  padel-court "how full is this game" indicator in an earlier design
  iteration, now repurposed as the actual live scoreboard: top half is team
  1 (ink), bottom half is team 2 (coral), each half showing both players'
  initials plus a floating score badge. This is the single most
  distinctive visual element in the product and the best anchor for further
  exploration — it could get more prominent, animate more dramatically on
  scoring, etc.
- **Motion**: understated — bounce-in for celebratory moments, slide-up for
  sheets/toasts, a brief color flash on a score badge when a point lands.
- **Overall feel**: a modern live-scoring app crossed with a casual
  friend-group event planner. Energetic, not childish. Data-forward (mono
  numerals everywhere) but warm (rounded shapes, off-white paper rather than
  stark white, hand-picked accent colors rather than a corporate blue).

## Known rough edges — good targets to iterate on

- App icons are placeholder-quality (a plain lime "R" on ink) — real
  iconography or illustration would help a lot.
- Create Event works but is visually plain — a generic two-step form.
- Profile is bare — no stats, no match history, no personality yet.
- There's no onboarding explaining the continuous-rotation concept anywhere
  in the UI — it's the app's most unusual mechanic and a first-time host
  currently has to be told about it out-of-band rather than discovering it
  in-product.
- The Pending/queue screen is informational but static — an opportunity to
  make waiting your turn feel more alive (a visual queue, live activity from
  other courts pulled to the front, etc.) rather than a text card.
- No notifications/activity feed exists (deliberately out of scope so far)
  — worth reconsidering once the core loop is solid.
