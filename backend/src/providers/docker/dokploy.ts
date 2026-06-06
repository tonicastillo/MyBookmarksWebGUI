import type { DockerProvider } from './types.js'

const notImplemented = (): never => {
  throw new Error('Proveedor Dokploy aún no implementado')
}

export const dokployProvider: DockerProvider = {
  listContainers: async () => notImplemented(),
  runAction: async () => notImplemented()
}
