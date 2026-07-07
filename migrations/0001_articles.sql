CREATE TABLE IF NOT EXISTS articles (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  slug TEXT UNIQUE NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  tags TEXT NOT NULL DEFAULT '',
  date TEXT NOT NULL,
  body TEXT NOT NULL DEFAULT '',
  published INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_articles_published_date ON articles(published, date DESC);

INSERT INTO articles (slug, title, description, tags, date, body, published)
VALUES (
  'hello-world',
  'Hello, world',
  'The first post on this site — what it''s for and how it''ll grow.',
  'meta',
  '2026-07-06',
  'This is the first post on **matthewrkenney.com**. The site has three parts: writing (this section), a photography portfolio, and an `/experiments` corner for anything that doesn''t fit neatly into the other two.

Nothing fancy here yet — just proving the writing pipeline works end to end: publish from the admin panel and it shows up on the index and gets its own page.',
  1
);
