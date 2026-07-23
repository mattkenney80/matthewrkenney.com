-- Site settings (key/value). Used for per-section nav visibility.
CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

-- Default every section to visible ('1'). Existing rows are left untouched.
INSERT OR IGNORE INTO settings (key, value) VALUES
  ('nav_writing', '1'),
  ('nav_photography', '1'),
  ('nav_experiments', '1'),
  ('nav_movies', '1');
