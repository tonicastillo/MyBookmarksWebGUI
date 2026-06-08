import type { Database as DatabaseType } from 'better-sqlite3'
import bcrypt from 'bcryptjs'
import { nanoid } from 'nanoid'
import db from './connection.js'

const BASE_SCHEMA = `
CREATE TABLE IF NOT EXISTS users (
  id            TEXT PRIMARY KEY,
  username      TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  is_admin      INTEGER NOT NULL DEFAULT 0,
  created_at    TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS sessions (
  token       TEXT PRIMARY KEY,
  user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  expires_at  TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_sessions_user    ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions(expires_at);

CREATE TABLE IF NOT EXISTS categories (
  id            TEXT PRIMARY KEY,
  name          TEXT NOT NULL,
  "order"       INTEGER NOT NULL DEFAULT 0,
  padre_id      TEXT REFERENCES categories(id) ON DELETE SET NULL,
  color         TEXT,
  user_id       TEXT REFERENCES users(id) ON DELETE CASCADE,
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
  alternate_urls        TEXT,
  valoration            INTEGER,
  user_id               TEXT REFERENCES users(id) ON DELETE CASCADE,
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

CREATE TABLE IF NOT EXISTS credentials (
  id          TEXT PRIMARY KEY,
  user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type        TEXT NOT NULL,
  name        TEXT NOT NULL,
  data        TEXT NOT NULL DEFAULT '{}',
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_credentials_user_type ON credentials(user_id, type);
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
  },
  {
    version: 6,
    up: (database) => {
      if (!hasColumn(database, 'categories', 'user_id')) {
        database.exec(`ALTER TABLE categories ADD COLUMN user_id TEXT REFERENCES users(id) ON DELETE CASCADE`)
      }
      if (!hasColumn(database, 'bookmarks', 'user_id')) {
        database.exec(`ALTER TABLE bookmarks ADD COLUMN user_id TEXT REFERENCES users(id) ON DELETE CASCADE`)
      }
      database.exec(`CREATE INDEX IF NOT EXISTS idx_categories_user ON categories(user_id)`)
      database.exec(`CREATE INDEX IF NOT EXISTS idx_bookmarks_user  ON bookmarks(user_id)`)

      const userCount = (database.prepare(`SELECT COUNT(*) AS n FROM users`).get() as { n: number }).n

      if (userCount === 0) {
        const adminId = nanoid()
        const rawPassword = process.env.ADMIN_PASSWORD ?? 'admin'
        const hash = bcrypt.hashSync(rawPassword, 10)

        database.prepare(`
          INSERT INTO users (id, username, password_hash, is_admin)
          VALUES (?, 'admin', ?, 1)
        `).run(adminId, hash)

        database.prepare(`UPDATE categories SET user_id = ? WHERE user_id IS NULL`).run(adminId)
        database.prepare(`UPDATE bookmarks  SET user_id = ? WHERE user_id IS NULL`).run(adminId)

        if (!process.env.ADMIN_PASSWORD) {
          console.warn(`[migrate] usuario admin creado con password por defecto "admin". Defínelo en ADMIN_PASSWORD y cámbialo desde la UI.`)
        } else {
          console.log(`[migrate] usuario admin creado con la contraseña de ADMIN_PASSWORD.`)
        }
      }
    }
  },
  {
    version: 7,
    up: (database) => {
      database.exec(`
        CREATE TABLE IF NOT EXISTS credentials (
          id          TEXT PRIMARY KEY,
          user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          type        TEXT NOT NULL,
          name        TEXT NOT NULL,
          data        TEXT NOT NULL DEFAULT '{}',
          created_at  TEXT NOT NULL DEFAULT (datetime('now')),
          updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
        );
        CREATE INDEX IF NOT EXISTS idx_credentials_user_type ON credentials(user_id, type);
      `)

      interface UnraidWidgetRow {
        id: string
        bookmark_id: string
        config: string
        user_id: string | null
      }

      const rows = database.prepare(`
        SELECT w.id, w.bookmark_id, w.config, b.user_id
          FROM widgets w
          JOIN bookmarks b ON b.id = w.bookmark_id
         WHERE w.type = 'unraid-docker'
      `).all() as UnraidWidgetRow[]

      const insertCred = database.prepare(`
        INSERT INTO credentials (id, user_id, type, name, data)
        VALUES (?, ?, 'unraid', ?, ?)
      `)
      const updateWidget = database.prepare(`
        UPDATE widgets SET config = ?, updated_at = datetime('now') WHERE id = ?
      `)

      const credByUserAndKey = new Map<string, string>()
      const usedNamesByUser = new Map<string, Set<string>>()

      const uniqueName = (userId: string, desired: string): string => {
        const used = usedNamesByUser.get(userId) ?? new Set<string>()
        if (!used.has(desired)) {
          used.add(desired)
          usedNamesByUser.set(userId, used)
          return desired
        }
        let i = 2
        while (used.has(`${desired} (${i})`)) i++
        const name = `${desired} (${i})`
        used.add(name)
        usedNamesByUser.set(userId, used)
        return name
      }

      for (const row of rows) {
        if (!row.user_id) continue
        let cfg: Record<string, unknown> = {}
        try {
          const parsed = JSON.parse(row.config)
          if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
            cfg = parsed as Record<string, unknown>
          }
        } catch {
          continue
        }

        const serverUrl = typeof cfg.serverUrl === 'string' ? cfg.serverUrl.trim() : ''
        const apiToken = typeof cfg.apiToken === 'string' ? cfg.apiToken : ''
        const serverLabel = typeof cfg.serverLabel === 'string' ? cfg.serverLabel.trim() : ''
        const containerName = typeof cfg.containerName === 'string' ? cfg.containerName : ''

        if (!serverUrl || !apiToken) continue

        const key = `${row.user_id}::${serverUrl}::${apiToken}`
        let credentialId = credByUserAndKey.get(key)
        if (!credentialId) {
          credentialId = nanoid()
          const desiredName = serverLabel || (() => {
            try { return new URL(serverUrl).hostname || 'Unraid' } catch { return 'Unraid' }
          })()
          const name = uniqueName(row.user_id, desiredName)
          insertCred.run(
            credentialId,
            row.user_id,
            name,
            JSON.stringify({ serverUrl, apiToken, serverLabel: serverLabel || undefined })
          )
          credByUserAndKey.set(key, credentialId)
        }

        const newConfig: Record<string, unknown> = { credentialId, containerName }
        if (serverLabel) newConfig.serverLabel = serverLabel
        updateWidget.run(JSON.stringify(newConfig), row.id)
      }

      if (credByUserAndKey.size > 0) {
        console.log(`[migrate] v7: migradas ${rows.length} widgets unraid a ${credByUserAndKey.size} credenciales`)
      }
    }
  },
  {
    version: 8,
    up: (database) => {
      if (!hasColumn(database, 'bookmarks', 'alternate_urls')) {
        database.exec(`ALTER TABLE bookmarks ADD COLUMN alternate_urls TEXT`)
      }
    }
  },
  {
    version: 9,
    up: (database) => {
      if (!hasColumn(database, 'bookmarks', 'valoration')) {
        database.exec(`ALTER TABLE bookmarks ADD COLUMN valoration INTEGER`)
      }
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
