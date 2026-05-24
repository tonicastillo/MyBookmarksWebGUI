export interface HomeAssistantConnection {
  baseUrl: string
  accessToken: string
}

export interface HomeAssistantEntityConfig {
  entityId: string
  label?: string
}

export interface HomeAssistantEntityState {
  entityId: string
  label?: string
  state: string | null
  attributes: Record<string, unknown> | null
  lastChanged: string | null
  lastUpdated: string | null
  error?: string
}

export interface HomeAssistantServiceCall {
  domain: string
  service: string
  serviceData?: Record<string, unknown>
}

const normalizeBaseUrl = (baseUrl: string): string => {
  const trimmed = baseUrl.trim().replace(/\/+$/, '')
  if (!trimmed) throw new Error('baseUrl vacía')
  return trimmed
}

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

interface HaStateResponse {
  entity_id: string
  state: string
  attributes?: Record<string, unknown>
  last_changed?: string
  last_updated?: string
}

const fetchOneState = async (
  conn: HomeAssistantConnection,
  baseUrl: string,
  entity: HomeAssistantEntityConfig
): Promise<HomeAssistantEntityState> => {
  const url = `${baseUrl}/api/states/${encodeURIComponent(entity.entityId)}`
  try {
    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${conn.accessToken}`,
        'Content-Type': 'application/json'
      }
    })
    if (res.status === 404) {
      return {
        entityId: entity.entityId,
        label: entity.label,
        state: null,
        attributes: null,
        lastChanged: null,
        lastUpdated: null,
        error: `Entidad "${entity.entityId}" no encontrada`
      }
    }
    if (!res.ok) {
      const text = await res.text().catch(() => '')
      throw new Error(`HTTP ${res.status}${text ? `: ${text.slice(0, 160)}` : ''}`)
    }
    const body = (await res.json()) as HaStateResponse
    return {
      entityId: entity.entityId,
      label: entity.label,
      state: typeof body.state === 'string' ? body.state : null,
      attributes: isPlainObject(body.attributes) ? body.attributes : null,
      lastChanged: typeof body.last_changed === 'string' ? body.last_changed : null,
      lastUpdated: typeof body.last_updated === 'string' ? body.last_updated : null
    }
  } catch (err) {
    return {
      entityId: entity.entityId,
      label: entity.label,
      state: null,
      attributes: null,
      lastChanged: null,
      lastUpdated: null,
      error: err instanceof Error ? err.message : 'Error consultando Home Assistant'
    }
  }
}

export const fetchHomeAssistantStates = async (
  conn: HomeAssistantConnection,
  entities: HomeAssistantEntityConfig[]
): Promise<HomeAssistantEntityState[]> => {
  if (entities.length === 0) return []
  const baseUrl = normalizeBaseUrl(conn.baseUrl)
  return Promise.all(entities.map((entity) => fetchOneState(conn, baseUrl, entity)))
}

const SERVICE_ID_RE = /^[a-z0-9_]+$/i

export const callHomeAssistantService = async (
  conn: HomeAssistantConnection,
  call: HomeAssistantServiceCall
): Promise<void> => {
  const baseUrl = normalizeBaseUrl(conn.baseUrl)
  if (!SERVICE_ID_RE.test(call.domain)) {
    throw new Error(`Dominio de servicio inválido: ${call.domain}`)
  }
  if (!SERVICE_ID_RE.test(call.service)) {
    throw new Error(`Servicio inválido: ${call.service}`)
  }
  const url = `${baseUrl}/api/services/${encodeURIComponent(call.domain)}/${encodeURIComponent(call.service)}`
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${conn.accessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(call.serviceData ?? {})
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`HTTP ${res.status}${text ? `: ${text.slice(0, 160)}` : ''}`)
  }
}
