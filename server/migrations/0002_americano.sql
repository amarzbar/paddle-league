-- Replace continuous reactive rotation with precomputed Americano scheduling.

ALTER TABLE events
    ADD COLUMN is_public    BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN court_count  INT     NOT NULL DEFAULT 4,
    ADD COLUMN total_rounds INT     NOT NULL DEFAULT 8; -- precomputed at event-start time

-- Public events are browsable/joinable from the main page without a join
-- code, so lobby/active public events need to be listed cheaply.
CREATE INDEX idx_events_public_status ON events(is_public, status) WHERE is_public;
