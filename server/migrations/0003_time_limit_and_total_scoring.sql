-- Switch from tennis-style "first to N, win by 2" scoring to real Americano
-- scoring: each match plays to a fixed combined total (points_to_win now
-- means "target total", not "target for the leader") - win_by and max_points
-- no longer mean anything under that rule, so they're dropped. A time limit
-- is added as a per-event safety net: if a match runs long, whoever's ahead
-- when time's up wins, or it's a draw if tied.

ALTER TABLE events
    DROP COLUMN win_by,
    DROP COLUMN max_points,
    ADD COLUMN time_limit_seconds INT NOT NULL DEFAULT 0; -- 0 = no limit

COMMENT ON COLUMN events.points_to_win IS 'Target COMBINED total (team1_score + team2_score) a match plays to - not a per-team target.';
