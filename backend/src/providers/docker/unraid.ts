import WebSocket from 'ws'
import type { DockerAction, DockerContainer, DockerProvider } from './types.js'

interface UnraidConfig {
  serverUrl: string
  apiToken: string
}

const parseConfig = (data: Record<string, unknown>): UnraidConfig => {
  const serverUrl = typeof data.serverUrl === 'string' ? data.serverUrl : ''
  const apiToken = typeof data.apiToken === 'string' ? data.apiToken : ''
  if (!serverUrl || !apiToken) {
    throw new Error('Conexión Unraid incompleta: faltan serverUrl o apiToken')
  }
  return { serverUrl, apiToken }
}

const normalizeEndpoint = (serverUrl: string): string => {
  const trimmed = serverUrl.trim().replace(/\/+$/, '')
  if (!trimmed) throw new Error('serverUrl vacío')
  return `${trimmed}/graphql`
}

const cleanName = (names: unknown, fallback: string): string => {
  if (Array.isArray(names) && names.length > 0 && typeof names[0] === 'string') {
    return names[0].replace(/^\//, '')
  }
  if (typeof names === 'string') return names.replace(/^\//, '')
  return fallback
}

interface GraphQLError {
  message?: string
  // Unraid Connect a veces anida el error en `error.message` en lugar del
  // `message` estándar de GraphQL (p. ej. {"error":{"name":"InternalError","message":"Graphql is offline."}}).
  error?: { name?: string; message?: string }
}

interface GraphQLResponse<T> {
  data?: T
  errors?: GraphQLError[]
}

const extractGraphQLErrors = (errors: GraphQLError[]): string =>
  errors
    .map((e) => e.message || e.error?.message || JSON.stringify(e))
    .filter(Boolean)
    .join('; ') || 'Error GraphQL desconocido'

const callGraphQL = async <T>(config: UnraidConfig, query: string, variables?: Record<string, unknown>): Promise<T> => {
  const endpoint = normalizeEndpoint(config.serverUrl)
  const res = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': config.apiToken,
      Origin: new URL(endpoint).origin
    },
    body: JSON.stringify({ query, variables })
  })

  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`Unraid HTTP ${res.status}${text ? `: ${text.slice(0, 200)}` : ''}`)
  }

  const body = (await res.json()) as GraphQLResponse<T>
  if (body.errors && body.errors.length > 0) {
    throw new Error(`Unraid GraphQL: ${extractGraphQLErrors(body.errors)}`)
  }
  if (!body.data) throw new Error('Respuesta vacía de Unraid')
  return body.data
}

interface ContainersQueryResult {
  docker: {
    containers: Array<{
      id?: string | null
      names?: string[] | string | null
      image?: string | null
      state?: string | null
      status?: string | null
      autoStart?: boolean | null
      sizeRootFs?: number | null
    }>
  }
}

const CONTAINERS_QUERY = `
  query Containers {
    docker {
      containers {
        id
        names
        image
        state
        status
        autoStart
        sizeRootFs
      }
    }
  }
`

interface ContainerStatsSample {
  id: string
  cpuPercent: number
  memPercent: number
  memUsage: string
}

const STATS_SUBSCRIPTION = `
  subscription Stats {
    dockerContainerStats {
      id
      cpuPercent
      memPercent
      memUsage
    }
  }
`

const isRunning = (state: string | null | undefined): boolean =>
  typeof state === 'string' && state.toLowerCase() === 'running'

/**
 * Stats llegan por la subscription como un sample por contenedor. Acumulamos
 * por id hasta cubrir todos los `wantedIds` (los running) o agotar el timeout.
 */
const fetchAllStats = (config: UnraidConfig, wantedIds: Set<string>): Promise<Map<string, ContainerStatsSample>> => {
  const result = new Map<string, ContainerStatsSample>()
  if (wantedIds.size === 0) return Promise.resolve(result)

  const endpoint = normalizeEndpoint(config.serverUrl)
  const wsUrl = endpoint.replace(/^http(s?):/i, 'ws$1:')
  const origin = new URL(endpoint).origin

  return new Promise<Map<string, ContainerStatsSample>>((resolve) => {
    const ws = new WebSocket(wsUrl, 'graphql-transport-ws', {
      headers: { 'x-api-key': config.apiToken, Origin: origin }
    })

    const subId = '1'
    let settled = false
    const finish = () => {
      if (settled) return
      settled = true
      clearTimeout(timeout)
      try { ws.close(1000) } catch { /* noop */ }
      resolve(result)
    }

    // Si Unraid no emite stats (p. ej. plugin antiguo) resolvemos con lo que haya.
    const timeout = setTimeout(finish, 4000)

    ws.on('open', () => {
      ws.send(JSON.stringify({
        type: 'connection_init',
        payload: { 'x-api-key': config.apiToken }
      }))
    })

    ws.on('message', (raw) => {
      let msg: { type?: string; id?: string; payload?: unknown }
      try {
        msg = JSON.parse(raw.toString())
      } catch {
        return
      }

      if (msg.type === 'connection_ack') {
        ws.send(JSON.stringify({
          id: subId,
          type: 'subscribe',
          payload: { query: STATS_SUBSCRIPTION }
        }))
        return
      }

      if (msg.type === 'next' && msg.id === subId) {
        const payload = msg.payload as { data?: { dockerContainerStats?: ContainerStatsSample } } | undefined
        const sample = payload?.data?.dockerContainerStats
        if (sample && wantedIds.has(sample.id) && !result.has(sample.id)) {
          result.set(sample.id, sample)
          if (result.size >= wantedIds.size) finish()
        }
        return
      }

      if (msg.type === 'error' || msg.type === 'connection_error') {
        finish()
      }
    })

    ws.on('error', finish)
    ws.on('close', finish)
  })
}

const listContainers = async (data: Record<string, unknown>): Promise<DockerContainer[]> => {
  const config = parseConfig(data)
  const queryResult = await callGraphQL<ContainersQueryResult>(config, CONTAINERS_QUERY)
  const raw = queryResult?.docker?.containers ?? []

  const wantedIds = new Set<string>()
  for (const c of raw) {
    if (c.id && isRunning(c.state)) wantedIds.add(c.id)
  }

  const stats = await fetchAllStats(config, wantedIds).catch((err) => {
    console.warn('[unraid] stats fetch failed:', err instanceof Error ? err.message : err)
    return new Map<string, ContainerStatsSample>()
  })

  return raw.map((c): DockerContainer => {
    const sample = c.id ? stats.get(c.id) : undefined
    return {
      id: c.id ?? null,
      name: cleanName(c.names, c.id ?? 'desconocido'),
      image: c.image ?? null,
      state: c.state ?? null,
      status: c.status ?? null,
      cpuPercent: sample?.cpuPercent ?? null,
      memPercent: sample?.memPercent ?? null,
      memUsage: sample?.memUsage ?? null,
      autoStart: c.autoStart ?? null
    }
  })
}

const ACTION_MUTATIONS: Record<'start' | 'stop', string> = {
  start: `mutation Start($id: PrefixedID!) { docker { start(id: $id) { id state status } } }`,
  stop: `mutation Stop($id: PrefixedID!) { docker { stop(id: $id) { id state status } } }`
}

interface ActionResult {
  docker: Record<string, { id?: string; state?: string; status?: string } | null>
}

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms))

const runAction = async (data: Record<string, unknown>, containerId: string, action: DockerAction): Promise<void> => {
  const config = parseConfig(data)
  if (!containerId) throw new Error(`No se puede ejecutar "${action}": falta el id del contenedor`)

  if (action === 'restart') {
    // Unraid GraphQL no expone "restart" en DockerMutations: lo emulamos.
    await callGraphQL<ActionResult>(config, ACTION_MUTATIONS.stop, { id: containerId })
    await sleep(1500)
    await callGraphQL<ActionResult>(config, ACTION_MUTATIONS.start, { id: containerId })
    return
  }

  await callGraphQL<ActionResult>(config, ACTION_MUTATIONS[action], { id: containerId })
}

export const unraidProvider: DockerProvider = { listContainers, runAction }
