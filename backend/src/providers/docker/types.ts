export interface DockerContainer {
  id: string | null
  name: string
  image: string | null
  state: string | null // 'running' | 'exited' | 'paused' | 'restarting' | ...
  status: string | null
  cpuPercent: number | null
  memPercent: number | null
  memUsage: string | null
  autoStart: boolean | null
}

export type DockerAction = 'start' | 'stop' | 'restart'

/**
 * Un proveedor sabe hablar con un tipo concreto de servidor (Unraid, CasaOS,
 * Dokploy, …). `data` es el `credential.data` crudo de la conexión; cada
 * proveedor valida y lee los campos que necesita (serverUrl, apiToken, …).
 */
export interface DockerProvider {
  listContainers: (data: Record<string, unknown>) => Promise<DockerContainer[]>
  runAction: (data: Record<string, unknown>, containerId: string, action: DockerAction) => Promise<void>
}
