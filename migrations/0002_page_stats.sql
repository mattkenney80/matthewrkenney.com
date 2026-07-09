-- Create page_stats table for tracking page views
CREATE TABLE IF NOT EXISTS page_stats (
  page_name TEXT PRIMARY KEY,
  view_count INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Index for efficient lookups
CREATE INDEX IF NOT EXISTS idx_page_stats_name ON page_stats(page_name);
