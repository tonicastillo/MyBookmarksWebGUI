import type { DockerContainer, DockerProvider } from './types.js'

const TTL_MS = 6_000

interface Entry {
  fetchedAt: number
  data: DockerContainer[]
}

const cache = new Map<string, Entry>()
const inflight = new Map<string, Promise<DockerContainer[]>>()

/**
 * Lectura de contenedores compartida por conexión: varios widgets que apunten
 * al mismo servidor (mismo credentialId) reutilizan una sola lectura dentro del
 * TTL, y las peticiones concurrentes comparten la misma promesa en vuelo.
 */
export const getContainersCached = async (
  credentialId: string,
  provider: DockerProvider,
  data: Record<string, unknown>
): Promise<DockerContainer[]> => {
  const cached = cache.get(credentialId)
  if (cached && Date.now() - cached.fetchedAt < TTL_MS) {
    return cached.data
  }

  const pending = inflight.get(credentialId)
  if (pending) return pending

  const promise = provider.listContainers(data)
    .then((result) => {
      cache.set(credentialId, { fetchedAt: Date.now(), data: result })
      return result
    })
    .finally(() => {
      inflight.delete(credentialId)
    })

  inflight.set(credentialId, promise)
  return promise
}

/** Invalida la caché de una conexión (p. ej. tras una acción start/stop/restart). */
export const invalidateContainers = (credentialId: string): void => {
  cache.delete(credentialId)
}
