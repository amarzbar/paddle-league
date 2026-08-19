-- A completed aggregate event derives its standings from completed source events.
-- It does not copy or alter source matches.
CREATE TABLE aggregate_event_sources (
    aggregate_event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    source_event_id    UUID NOT NULL REFERENCES events(id) ON DELETE RESTRICT,
    PRIMARY KEY (aggregate_event_id, source_event_id),
    CHECK (aggregate_event_id <> source_event_id)
);

CREATE INDEX idx_aggregate_event_sources_source
    ON aggregate_event_sources(source_event_id);
