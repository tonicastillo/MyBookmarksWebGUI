import WebSocket from 'ws'

export interface UnraidWidgetConfig {
  serverUrl: string
  containerName: string
  apiToken: string
  serverLabel?: string
}

export type UnraidActionName = 'start' | 'stop' | 'restart'

export interface UnraidContainerInfo {
  id: string | null
  name: string
  image: string | null
  state: string | null
  status: string | null
  autoStart: boolean | null
  sizeRootFs: number | null
  cpuPercent: number | null
  memPercent: number | null
  memUsage: string | null
}

const normalizeEndpoint = (serverUrl: string): string => {
  const trimmed = serverUrl.trim().replace(/\/+$/, '')
  if (!trimmed) throw new Error('serverUrl vacío')
  return `${trimmed}/graphql`
}

const matchesContainerName = (names: unknown, target: string): boolean => {
  const target1 = target.startsWith('/') ? target : `/${target}`
  if (typeof names === 'string') {
    return names === target || names === target1
  }
  if (Array.isArray(names)) {
    return names.some((n) => typeof n === 'string' && (n === target || n === target1))
  }
  return false
}

interface GraphQLResponse<T> {
  data?: T
  errors?: Array<{ message: string }>
}

const callGraphQL = async <T>(config: UnraidWidgetConfig, query: string, variables?: Record<string, unknown>): Promise<T> => {
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
    throw new Error(`Unraid GraphQL: ${body.errors.map((e) => e.message).join('; ')}`)
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

export const fetchUnraidContainer = async (config: UnraidWidgetConfig): Promise<UnraidContainerInfo> => {
  const data = await callGraphQL<ContainersQueryResult>(config, CONTAINERS_QUERY)
  const containers = data?.docker?.containers ?? []
  const found = containers.find((c) => matchesContainerName(c.names, config.containerName))

  if (!found) {
    return {
      id: null,
      name: config.containerName,
      image: null,
      state: 'not-found',
      status: `Contenedor "${config.containerName}" no encontrado en el servidor`,
      autoStart: null,
      sizeRootFs: null,
      cpuPercent: null,
      memPercent: null,
      memUsage: null
    }
  }

  const displayName = (() => {
    if (Array.isArray(found.names) && found.names.length > 0) {
      const first = found.names[0]
      return typeof first === 'string' ? first.replace(/^\//, '') : config.containerName
    }
    if (typeof found.names === 'string') return found.names.replace(/^\//, '')
    return config.containerName
  })()

  const stats = found.id ? await fetchContainerStats(config, found.id).catch((err) => {
    console.warn('[unraid] stats fetch failed:', err instanceof Error ? err.message : err)
    return null
  }) : null

  return {
    id: found.id ?? null,
    name: displayName,
    image: found.image ?? null,
    state: found.state ?? null,
    status: found.status ?? null,
    autoStart: found.autoStart ?? null,
    sizeRootFs: found.sizeRootFs ?? null,
    cpuPercent: stats?.cpuPercent ?? null,
    memPercent: stats?.memPercent ?? null,
    memUsage: stats?.memUsage ?? null
  }
}

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

const fetchContainerStats = (config: UnraidWidgetConfig, containerId: string): Promise<ContainerStatsSample> => {
  const endpoint = normalizeEndpoint(config.serverUrl)
  const wsUrl = endpoint.replace(/^http(s?):/i, 'ws$1:')
  const origin = new URL(endpoint).origin

  return new Promise<ContainerStatsSample>((resolve, reject) => {
    const ws = new WebSocket(wsUrl, 'graphql-transport-ws', {
      headers: { 'x-api-key': config.apiToken, Origin: origin }
    })

    const subId = '1'
    let settled = false
    const finish = (fn: () => void) => {
      if (settled) return
      settled = true
      clearTimeout(timeout)
      try { ws.close(1000) } catch { /* noop */ }
      fn()
    }

    const timeout = setTimeout(() => {
      finish(() => reject(new Error('Timeout esperando stats del contenedor')))
    }, 8000)

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
        if (sample && sample.id === containerId) {
          finish(() => resolve(sample))
        }
        return
      }

      if (msg.type === 'error') {
        finish(() => reject(new Error(`GraphQL WS error: ${JSON.stringify(msg.payload)}`)))
        return
      }

      if (msg.type === 'connection_error') {
        finish(() => reject(new Error(`GraphQL WS connection_error: ${JSON.stringify(msg.payload)}`)))
      }
    })

    ws.on('error', (err) => {
      finish(() => reject(err instanceof Error ? err : new Error(String(err))))
    })

    ws.on('close', () => {
      finish(() => reject(new Error('WebSocket cerrado antes de recibir stats')))
    })
  })
}

const ACTION_MUTATIONS: Record<UnraidActionName, string> = {
  start: `mutation Start($id: PrefixedID!) { docker { start(id: $id) { id state status } } }`,
  stop: `mutation Stop($id: PrefixedID!) { docker { stop(id: $id) { id state status } } }`,
  restart: `mutation Restart($id: PrefixedID!) { docker { restart(id: $id) { id state status } } }`
}

interface ActionResult {
  docker: Record<string, { id?: string; state?: string; status?: string } | null>
}

export const runUnraidAction = async (
  config: UnraidWidgetConfig,
  action: UnraidActionName
): Promise<UnraidContainerInfo> => {
  const info = await fetchUnraidContainer(config)
  if (!info.id) throw new Error(`No se puede ejecutar "${action}": contenedor no encontrado`)

  const mutation = ACTION_MUTATIONS[action]
  await callGraphQL<ActionResult>(config, mutation, { id: info.id })

  return fetchUnraidContainer(config)
}
