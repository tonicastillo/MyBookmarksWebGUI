import type { DockerProvider } from './types.js'

const notImplemented = (): never => {
  throw new Error('Proveedor CasaOS aún no implementado')
}

export const casaosProvider: DockerProvider = {
  listContainers: async () => notImplemented(),
  runAction: async () => notImplemented()
}
