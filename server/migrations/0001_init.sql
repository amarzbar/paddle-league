-- Paddle League schema
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE users (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email           TEXT NOT NULL UNIQUE,
    password_hash   TEXT NOT NULL,
    display_name    TEXT NOT NULL,
    avatar_color    TEXT NOT NULL DEFAULT '#6750A4',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- An "event" is a hosted session containing many matches/rounds.
CREATE TABLE events (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    host_id             UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name                TEXT NOT NULL,
    join_code           TEXT NOT NULL UNIQUE,
    status              TEXT NOT NULL DEFAULT 'lobby', -- lobby | active | completed
    points_to_win       INT NOT NULL DEFAULT 11,
    win_by              INT NOT NULL DEFAULT 2,
    max_points          INT NOT NULL DEFAULT 15, -- hard cap even if win_by not satisfied
    current_round       INT NOT NULL DEFAULT 0,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    started_at          TIMESTAMPTZ,
    completed_at        TIMESTAMPTZ
);

CREATE TABLE event_participants (
    event_id    UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    joined_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (event_id, user_id)
);

-- One round of the event: a set of matches covering (as many as possible) of the active players.
CREATE TABLE rounds (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id    UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    number      INT NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (event_id, number)
);

CREATE TABLE matches (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    round_id        UUID NOT NULL REFERENCES rounds(id) ON DELETE CASCADE,
    event_id        UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    court_label     TEXT NOT NULL DEFAULT 'Court 1',
    team1_p1        UUID NOT NULL REFERENCES users(id),
    team1_p2        UUID NOT NULL REFERENCES users(id),
    team2_p1        UUID NOT NULL REFERENCES users(id),
    team2_p2        UUID NOT NULL REFERENCES users(id),
    team1_score     INT NOT NULL DEFAULT 0,
    team2_score     INT NOT NULL DEFAULT 0,
    status          TEXT NOT NULL DEFAULT 'pending', -- pending | in_progress | completed
    winner          INT, -- 1 or 2
    started_at      TIMESTAMPTZ,
    completed_at    TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Point-by-point log, enables live animated scoring + undo.
CREATE TABLE match_events (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    match_id    UUID NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
    team        INT NOT NULL, -- 1 or 2
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_matches_event ON matches(event_id);
CREATE INDEX idx_rounds_event ON rounds(event_id);
CREATE INDEX idx_match_events_match ON match_events(match_id);
