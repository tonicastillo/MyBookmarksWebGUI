import type { Database as DatabaseType } from 'better-sqlite3'
import db from './connection.js'

const BASE_SCHEMA = `
CREATE TABLE IF NOT EXISTS categories (
  id            TEXT PRIMARY KEY,
  name          TEXT NOT NULL,
  "order"       INTEGER NOT NULL DEFAULT 0,
  padre_id      TEXT REFERENCES categories(id) ON DELETE SET NULL,
  color         TEXT,
  created_at    TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS bookmarks (
  id                    TEXT PRIMARY KEY,
  name                  TEXT NOT NULL,
  url                   TEXT,
  subtitle              TEXT,
  category_id           TEXT REFERENCES categories(id) ON DELETE SET NULL,
  parent_bookmark_id    TEXT REFERENCES bookmarks(id) ON DELETE CASCADE,
  visible_at_start      INTEGER NOT NULL DEFAULT 0,
  is_mega_card          INTEGER NOT NULL DEFAULT 0,
  color                 TEXT,
  search_placeholder    TEXT,
  search_url_template   TEXT,
  image_filename        TEXT,
  image_url             TEXT,
  image_scale           REAL,
  image_bg_color        TEXT,
  image_bg_color2       TEXT,
  resboard              TEXT,
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

CREATE TABLE IF NOT EXISTS widgets (
  id           TEXT PRIMARY KEY,
  bookmark_id  TEXT NOT NULL REFERENCES bookmarks(id) ON DELETE CASCADE,
  type         TEXT NOT NULL,
  "order"      INTEGER NOT NULL DEFAULT 0,
  config       TEXT NOT NULL DEFAULT '{}',
  created_at   TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at   TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_widgets_bookmark ON widgets(bookmark_id, "order");
`

interface Migration {
  version: number
  up: (database: DatabaseType) => void
}

const hasColumn = (database: DatabaseType, table: string, column: string): boolean => {
  const cols = database.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>
  return cols.some((c) => c.name === column)
}

const hueToHex = (hue: number): string => {
  const h = ((hue % 360) + 360) % 360
  const s = 0.65
  const l = 0.55
  const c = (1 - Math.abs(2 * l - 1)) * s
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1))
  const m = l - c / 2
  let r = 0, g = 0, b = 0
  if (h < 60) [r, g, b] = [c, x, 0]
  else if (h < 120) [r, g, b] = [x, c, 0]
  else if (h < 180) [r, g, b] = [0, c, x]
  else if (h < 240) [r, g, b] = [0, x, c]
  else if (h < 300) [r, g, b] = [x, 0, c]
  else [r, g, b] = [c, 0, x]
  const toHex = (n: number) => Math.round((n + m) * 255).toString(16).padStart(2, '0')
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`
}

const MIGRATIONS: Migration[] = [
  {
    version: 1,
    up: (database) => {
      if (!hasColumn(database, 'categories', 'color')) {
        database.exec(`ALTER TABLE categories ADD COLUMN color TEXT`)
      }
      if (hasColumn(database, 'categories', 'level')) {
        database.exec(`ALTER TABLE categories DROP COLUMN level`)
      }
    }
  },
  {
    version: 2,
    up: (database) => {
      if (!hasColumn(database, 'bookmarks', 'color')) {
        database.exec(`ALTER TABLE bookmarks ADD COLUMN color TEXT`)
      }
      if (hasColumn(database, 'bookmarks', 'color_hue')) {
        const rows = database.prepare(`
          SELECT id, color_hue FROM bookmarks WHERE color_hue IS NOT NULL
        `).all() as Array<{ id: string; color_hue: number }>
        const setColor = database.prepare(`UPDATE bookmarks SET color = ? WHERE id = ?`)
        for (const r of rows) setColor.run(hueToHex(r.color_hue), r.id)
        database.exec(`ALTER TABLE bookmarks DROP COLUMN color_hue`)
      }
      if (hasColumn(database, 'bookmarks', 'alternate_url')) {
        database.exec(`ALTER TABLE bookmarks DROP COLUMN alternate_url`)
      }
      if (hasColumn(database, 'bookmarks', 'status')) {
        database.exec(`ALTER TABLE bookmarks DROP COLUMN status`)
      }
      if (hasColumn(database, 'bookmarks', 'valoration')) {
        database.exec(`ALTER TABLE bookmarks DROP COLUMN valoration`)
      }
      if (!hasColumn(database, 'bookmarks', 'resboard')) {
        database.exec(`ALTER TABLE bookmarks ADD COLUMN resboard TEXT`)
      }
    }
  },
  {
    version: 3,
    up: (database) => {
      if (!hasColumn(database, 'bookmarks', 'is_mega_card')) {
        database.exec(`ALTER TABLE bookmarks ADD COLUMN is_mega_card INTEGER NOT NULL DEFAULT 0`)
      }
      database.exec(`
        UPDATE bookmarks
           SET is_mega_card = 1
         WHERE id IN (SELECT DISTINCT parent_bookmark_id FROM bookmarks WHERE parent_bookmark_id IS NOT NULL)
      `)
      database.exec(`CREATE INDEX IF NOT EXISTS idx_bookmarks_mega ON bookmarks(is_mega_card) WHERE is_mega_card = 1`)
    }
  },
  {
    version: 4,
    up: (database) => {
      if (!hasColumn(database, 'bookmarks', 'image_scale')) {
        database.exec(`ALTER TABLE bookmarks ADD COLUMN image_scale REAL`)
      }
      if (!hasColumn(database, 'bookmarks', 'image_bg_color')) {
        database.exec(`ALTER TABLE bookmarks ADD COLUMN image_bg_color TEXT`)
      }
      if (!hasColumn(database, 'bookmarks', 'image_bg_color2')) {
        database.exec(`ALTER TABLE bookmarks ADD COLUMN image_bg_color2 TEXT`)
      }
    }
  },
  {
    version: 5,
    up: (database) => {
      database.exec(`
        CREATE TABLE IF NOT EXISTS widgets (
          id           TEXT PRIMARY KEY,
          bookmark_id  TEXT NOT NULL REFERENCES bookmarks(id) ON DELETE CASCADE,
          type         TEXT NOT NULL,
          "order"      INTEGER NOT NULL DEFAULT 0,
          config       TEXT NOT NULL DEFAULT '{}',
          created_at   TEXT NOT NULL DEFAULT (datetime('now')),
          updated_at   TEXT NOT NULL DEFAULT (datetime('now'))
        );
        CREATE INDEX IF NOT EXISTS idx_widgets_bookmark ON widgets(bookmark_id, "order");
      `)
    }
  }
]

const readUserVersion = (database: DatabaseType): number => {
  const result = database.pragma('user_version', { simple: true })
  return typeof result === 'number' ? result : 0
}

export const runMigrations = (): void => {
  db.exec(BASE_SCHEMA)
  const current = readUserVersion(db)
  for (const m of MIGRATIONS) {
    if (m.version > current) {
      const tx = db.transaction(m.up)
      tx(db)
      db.pragma(`user_version = ${m.version}`)
      console.log(`[migrate] applied v${m.version}`)
    }
  }
}
