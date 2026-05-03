import Database, { type Database as DatabaseType } from 'better-sqlite3'
import path from 'path'
import fs from 'fs'

const DATA_DIR = path.join(process.cwd(), 'data')
const DB_PATH = path.join(DATA_DIR, 'bookmarks.db')

export const IMAGES_DIR = path.join(DATA_DIR, 'images')

const ensureDirs = (): void => {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true })
  if (!fs.existsSync(IMAGES_DIR)) fs.mkdirSync(IMAGES_DIR, { recursive: true })
}

ensureDirs()

const db: DatabaseType = new Database(DB_PATH)
db.pragma('foreign_keys = ON')
db.pragma('journal_mode = WAL')

export default db
