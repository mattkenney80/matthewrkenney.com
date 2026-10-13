-- Reverse-geocoded place names for Strava start locations, keyed by the same
-- ~1 km grid cell the API clusters on. A place only ever needs looking up once,
-- so a cold /api/strava stops spending a minute talking to OpenStreetMap.
CREATE TABLE IF NOT EXISTS geocode_cache (
  cell TEXT PRIMARY KEY,
  label TEXT NOT NULL,
  country TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
