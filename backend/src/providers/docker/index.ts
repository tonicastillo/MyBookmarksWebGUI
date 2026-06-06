import type { DockerProvider } from './types.js'
import { unraidProvider } from './unraid.js'
import { casaosProvider } from './casaos.js'
import { dokployProvider } from './dokploy.js'

export type { DockerContainer, DockerAction, DockerProvider } from './types.js'

/** Ids de proveedor (== credential.type) que ofrecen gestión Docker. */
export const DOCKER_PROVIDER_IDS = ['unraid', 'casaos', 'dokploy'] as const

const PROVIDERS: Record<string, DockerProvider> = {
  unraid: unraidProvider,
  casaos: casaosProvider,
  dokploy: dokployProvider
}

export const getDockerProvider = (providerId: string): DockerProvider | undefined => PROVIDERS[providerId]
