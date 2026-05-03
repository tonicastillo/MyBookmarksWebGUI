import db from './connection.js'

const SCHEMA = `
CREATE TABLE IF NOT EXISTS categories (
  id            TEXT PRIMARY KEY,
  name          TEXT NOT NULL,
  "order"       INTEGER NOT NULL DEFAULT 0,
  level         INTEGER,
  padre_id      TEXT REFERENCES categories(id) ON DELETE SET NULL,
  created_at    TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS bookmarks (
  id                    TEXT PRIMARY KEY,
  name                  TEXT NOT NULL,
  url                   TEXT,
  alternate_url         TEXT,
  subtitle              TEXT,
  category_id           TEXT REFERENCES categories(id) ON DELETE SET NULL,
  parent_bookmark_id    TEXT REFERENCES bookmarks(id) ON DELETE CASCADE,
  visible_at_start      INTEGER NOT NULL DEFAULT 0,
  status                TEXT NOT NULL DEFAULT 'Not started',
  valoration            TEXT,
  color_hue             INTEGER CHECK (color_hue IS NULL OR (color_hue BETWEEN 0 AND 360)),
  search_placeholder    TEXT,
  search_url_template   TEXT,
  image_filename        TEXT,
  image_url             TEXT,
  created_at            TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at            TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_bookmarks_category ON bookmarks(category_id);
CREATE INDEX IF NOT EXISTS idx_bookmarks_parent   ON bookmarks(parent_bookmark_id);
CREATE INDEX IF NOT EXISTS idx_bookmarks_visible  ON bookmarks(visible_at_start) WHERE visible_at_start = 1;

CREATE TABLE IF NOT EXISTS tags (
  id    INTEGER PRIMARY KEY AUTOINCREMENT,
  name  TEXT NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS bookmark_tags (
  bookmark_id  TEXT NOT NULL REFERENCES bookmarks(id) ON DELETE CASCADE,
  tag_id       INTEGER NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  PRIMARY KEY (bookmark_id, tag_id)
);

CREATE INDEX IF NOT EXISTS idx_bookmark_tags_tag ON bookmark_tags(tag_id);

CREATE VIRTUAL TABLE IF NOT EXISTS bookmarks_fts USING fts5(
  name, subtitle, tags, content=''
);
`

export const runMigrations = (): void => {
  db.exec(SCHEMA)
}
