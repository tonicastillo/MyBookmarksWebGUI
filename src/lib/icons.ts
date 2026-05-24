export interface IconData {
  body: string
  width: number
  height: number
}

export interface IconHit {
  name: string
  data: IconData
}

interface LucideJson {
  prefix: string
  width: number
  height: number
  icons: Record<string, { body: string; width?: number; height?: number }>
  aliases?: Record<string, { parent: string }>
}

const LUCIDE_PREFIX = 'lucide'

interface IndexedSet {
  prefix: string
  width: number
  height: number
  icons: Map<string, IconData>
  aliasOf: Map<string, string>
  allNames: string[]
}

let lucidePromise: Promise<IndexedSet> | null = null

const buildIndex = (raw: LucideJson): IndexedSet => {
  const icons = new Map<string, IconData>()
  for (const [name, def] of Object.entries(raw.icons)) {
    icons.set(name, {
      body: def.body,
      width: def.width ?? raw.width,
      height: def.height ?? raw.height
    })
  }
  const aliasOf = new Map<string, string>()
  if (raw.aliases) {
    for (const [aliasName, def] of Object.entries(raw.aliases)) {
      aliasOf.set(aliasName, def.parent)
    }
  }
  const allNames = [...icons.keys(), ...aliasOf.keys()].sort()
  return {
    prefix: raw.prefix,
    width: raw.width,
    height: raw.height,
    icons,
    aliasOf,
    allNames
  }
}

const loadLucide = async (): Promise<IndexedSet> => {
  if (!lucidePromise) {
    lucidePromise = import('@iconify-json/lucide/icons.json').then((mod) => {
      const raw = (mod.default ?? mod) as LucideJson
      return buildIndex(raw)
    })
  }
  return lucidePromise
}

const resolveInSet = (set: IndexedSet, localName: string): IconData | null => {
  const direct = set.icons.get(localName)
  if (direct) return direct
  const aliasTarget = set.aliasOf.get(localName)
  if (aliasTarget) {
    const viaAlias = set.icons.get(aliasTarget)
    if (viaAlias) return viaAlias
  }
  return null
}

const parseIconName = (full: string): { prefix: string; local: string } | null => {
  const idx = full.indexOf(':')
  if (idx <= 0) return null
  return { prefix: full.slice(0, idx), local: full.slice(idx + 1) }
}

export const getIconData = async (full: string): Promise<IconData | null> => {
  const parts = parseIconName(full)
  if (!parts) return null
  if (parts.prefix !== LUCIDE_PREFIX) return null
  const set = await loadLucide()
  return resolveInSet(set, parts.local)
}

const normalize = (s: string): string => s.toLowerCase().trim().replace(/[\s_]+/g, '-')

export const searchIcons = async (query: string, limit = 240): Promise<IconHit[]> => {
  const set = await loadLucide()
  const q = normalize(query)
  const out: IconHit[] = []
  const seenCanonical = new Set<string>()

  const push = (localName: string): boolean => {
    const data = resolveInSet(set, localName)
    if (!data) return false
    const canonical = set.aliasOf.get(localName) ?? localName
    if (seenCanonical.has(canonical)) return false
    seenCanonical.add(canonical)
    out.push({ name: `${LUCIDE_PREFIX}:${canonical}`, data })
    return out.length >= limit
  }

  if (!q) {
    for (const name of set.allNames) {
      if (push(name)) break
    }
    return out
  }

  for (const name of set.allNames) {
    if (name.startsWith(q)) {
      if (push(name)) return out
    }
  }
  for (const name of set.allNames) {
    if (!name.startsWith(q) && name.includes(q)) {
      if (push(name)) return out
    }
  }
  return out
}

export const isIconName = (value: unknown): value is string =>
  typeof value === 'string' && parseIconName(value) !== null
