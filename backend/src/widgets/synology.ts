import http from 'http'
import https from 'https'

/**
 * Proxy ligero contra la Web API (DSM) de un Synology NAS.
 *
 * Replica el espíritu de `home-assistant.ts`: el backend habla con el sistema
 * externo usando las credenciales guardadas y devuelve datos ya normalizados.
 *
 * Notas:
 * - Los NAS suelen exponer HTTPS (:5001) con certificado autofirmado, que el
 *   `fetch` nativo de Node rechaza. Por eso usamos el módulo `https`/`http`
 *   nativo con `rejectUnauthorized: false` (uso local/personal).
 * - La sesión (`sid`) se cachea en memoria por credencial para no re-loguear en
 *   cada poll; si una llamada indica sesión caducada, se re-loguea una vez.
 */

export interface SynologyConnection {
  serverUrl: string
  username: string
  password: string
}

export interface SynologyVolume {
  id: string
  name: string
  status: string
  totalBytes: number
  usedBytes: number
  freeBytes: number
  usedPercent: number
}

export interface SynologyStatus {
  cpuPercent: number
  memPercent: number
  volumes: SynologyVolume[]
}

const SESSION_NAME = 'MyBookmarks'
const SID_TTL_MS = 15 * 60 * 1000
const REQUEST_TIMEOUT_MS = 12_000

interface CachedSession {
  sid: string
  expiresAt: number
}

const sessionCache = new Map<string, CachedSession>()

const normalizeServerUrl = (serverUrl: string): string => {
  const trimmed = serverUrl.trim().replace(/\/+$/, '')
  if (!trimmed) throw new Error('serverUrl vacía')
  if (!/^https?:\/\//i.test(trimmed)) {
    throw new Error('serverUrl debe empezar por http:// o https://')
  }
  return trimmed
}

const sessionKey = (conn: SynologyConnection): string =>
  `${normalizeServerUrl(conn.serverUrl)}|${conn.username}`

/** Mensajes legibles para los códigos de error de SYNO.API.Auth (login). */
const AUTH_ERROR_MESSAGES: Record<number, string> = {
  400: 'Usuario o contraseña incorrectos',
  401: 'Cuenta deshabilitada',
  402: 'Permiso denegado',
  403: 'La cuenta requiere verificación en 2 pasos (2FA), no soportada por el widget',
  404: 'Código de verificación en 2 pasos incorrecto',
  406: 'La cuenta requiere cambiar la contraseña antes de iniciar sesión',
  407: 'IP bloqueada por el NAS',
  408: 'La contraseña ha caducado'
}

/** Códigos DSM que indican que la sesión ya no es válida → re-login. */
const SESSION_EXPIRED_CODES = new Set([105, 106, 107, 119])

interface DsmResponse<T> {
  success: boolean
  data?: T
  error?: { code: number; errors?: unknown }
}

const synoRequest = <T>(
  serverUrl: string,
  params: Record<string, string>
): Promise<DsmResponse<T>> => {
  const base = normalizeServerUrl(serverUrl)
  const url = new URL(`${base}/webapi/entry.cgi`)
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value)
  }
  const isHttps = url.protocol === 'https:'
  const options: https.RequestOptions = {
    method: 'GET',
    timeout: REQUEST_TIMEOUT_MS,
    // Aceptar certificados autofirmados (típico en un NAS local).
    rejectUnauthorized: false
  }

  return new Promise((resolve, reject) => {
    const handler = (res: http.IncomingMessage): void => {
      const chunks: Buffer[] = []
      res.on('data', (chunk: Buffer) => chunks.push(chunk))
      res.on('end', () => {
        const text = Buffer.concat(chunks).toString('utf8')
        const status = res.statusCode ?? 0
        if (status < 200 || status >= 300) {
          reject(new Error(`HTTP ${status || '???'}${text ? `: ${text.slice(0, 160)}` : ''}`))
          return
        }
        try {
          resolve(JSON.parse(text) as DsmResponse<T>)
        } catch {
          reject(new Error('Respuesta no válida (no JSON) del NAS'))
        }
      })
    }

    const req = isHttps
      ? https.request(url, options, handler)
      : http.request(url, options, handler)

    req.on('error', (err) => reject(new Error(`No se pudo conectar con el NAS: ${err.message}`)))
    req.on('timeout', () => req.destroy(new Error('Tiempo de espera agotado conectando con el NAS')))
    req.end()
  })
}

const login = async (conn: SynologyConnection): Promise<string> => {
  const resp = await synoRequest<{ sid: string }>(conn.serverUrl, {
    api: 'SYNO.API.Auth',
    version: '6',
    method: 'login',
    account: conn.username,
    passwd: conn.password,
    session: SESSION_NAME,
    format: 'sid'
  })
  if (!resp.success || !resp.data?.sid) {
    const code = resp.error?.code
    const message = (code !== undefined && AUTH_ERROR_MESSAGES[code]) ||
      `Error de login en el NAS (código ${code ?? '?'})`
    throw new Error(message)
  }
  return resp.data.sid
}

const getSid = async (conn: SynologyConnection, forceNew = false): Promise<string> => {
  const key = sessionKey(conn)
  if (!forceNew) {
    const cached = sessionCache.get(key)
    if (cached && cached.expiresAt > Date.now()) return cached.sid
  }
  const sid = await login(conn)
  sessionCache.set(key, { sid, expiresAt: Date.now() + SID_TTL_MS })
  return sid
}

/** Llama a una API DSM autenticada; reintenta una vez si la sesión caducó. */
const callApi = async <T>(conn: SynologyConnection, params: Record<string, string>): Promise<T> => {
  const run = (sid: string): Promise<DsmResponse<T>> =>
    synoRequest<T>(conn.serverUrl, { ...params, _sid: sid })

  let resp = await run(await getSid(conn))
  if (!resp.success && resp.error && SESSION_EXPIRED_CODES.has(resp.error.code)) {
    resp = await run(await getSid(conn, true))
  }
  if (!resp.success || resp.data === undefined) {
    throw new Error(`Error del NAS (código ${resp.error?.code ?? '?'})`)
  }
  return resp.data
}

interface UtilizationData {
  cpu?: {
    user_load?: number | string
    system_load?: number | string
    other_load?: number | string
  }
  memory?: { real_usage?: number | string }
}

interface StorageData {
  volumes?: Array<{
    id?: string
    display_name?: string
    desc?: string
    status?: string
    size?: { total?: string | number; used?: string | number }
  }>
}

const toNum = (value: unknown): number => {
  const n = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : NaN
  return Number.isFinite(n) ? n : 0
}

const clampPercent = (value: number): number => Math.min(100, Math.max(0, Math.round(value)))

export const fetchSynologyStatus = async (conn: SynologyConnection): Promise<SynologyStatus> => {
  const util = await callApi<UtilizationData>(conn, {
    api: 'SYNO.Core.System.Utilization',
    version: '1',
    method: 'get'
  })
  const storage = await callApi<StorageData>(conn, {
    api: 'SYNO.Storage.CGI.Storage',
    version: '1',
    method: 'load_info'
  })

  const cpu = util.cpu ?? {}
  const cpuPercent = clampPercent(
    toNum(cpu.user_load) + toNum(cpu.system_load) + toNum(cpu.other_load)
  )
  const memPercent = clampPercent(toNum(util.memory?.real_usage))

  const volumes: SynologyVolume[] = (storage.volumes ?? []).map((vol, idx) => {
    const totalBytes = toNum(vol.size?.total)
    const usedBytes = toNum(vol.size?.used)
    const freeBytes = Math.max(0, totalBytes - usedBytes)
    const usedPercent = totalBytes > 0 ? clampPercent((usedBytes / totalBytes) * 100) : 0
    return {
      id: vol.id ?? `vol-${idx}`,
      name: vol.display_name || vol.desc || vol.id || `Volumen ${idx + 1}`,
      status: vol.status ?? 'unknown',
      totalBytes,
      usedBytes,
      freeBytes,
      usedPercent
    }
  })

  return { cpuPercent, memPercent, volumes }
}

export const rebootSynology = async (conn: SynologyConnection): Promise<void> => {
  const sid = await getSid(conn)
  try {
    const resp = await synoRequest<unknown>(conn.serverUrl, {
      api: 'SYNO.Core.System',
      version: '1',
      method: 'reboot',
      _sid: sid
    })
    if (!resp.success) {
      const code = resp.error?.code
      if (code === 105) {
        throw new Error('Permisos insuficientes: la cuenta debe ser administrador para reiniciar el NAS')
      }
      throw new Error(`No se pudo reiniciar el NAS (código ${code ?? '?'})`)
    }
  } catch (err) {
    // El reinicio puede cortar la conexión antes de responder: lo tratamos como éxito.
    const message = err instanceof Error ? err.message : ''
    if (!/conectar|espera|JSON|socket|ECONN/i.test(message)) throw err
  } finally {
    // Tras el reinicio la sesión cacheada ya no sirve.
    sessionCache.delete(sessionKey(conn))
  }
}
