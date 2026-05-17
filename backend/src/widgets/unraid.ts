export interface UnraidWidgetConfig {
  serverUrl: string
  containerName: string
  apiToken: string
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
  memoryBytes: number | null
  memoryLimitBytes: number | null
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
      memoryBytes: null,
      memoryLimitBytes: null
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

  return {
    id: found.id ?? null,
    name: displayName,
    image: found.image ?? null,
    state: found.state ?? null,
    status: found.status ?? null,
    autoStart: found.autoStart ?? null,
    sizeRootFs: found.sizeRootFs ?? null,
    cpuPercent: null,
    memoryBytes: null,
    memoryLimitBytes: null
  }
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
