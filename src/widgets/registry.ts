import type { Component } from 'vue'
import HelloWorldConfig from './hello-world/HelloWorldConfig.vue'
import HelloWorldRender from './hello-world/HelloWorldRender.vue'
import UnraidDockerConfig from './unraid-docker/UnraidDockerConfig.vue'
import UnraidDockerRender from './unraid-docker/UnraidDockerRender.vue'
import DockerContainersConfig from './docker-containers/DockerContainersConfig.vue'
import DockerContainersRender from './docker-containers/DockerContainersRender.vue'
import NotesConfig from './notes/NotesConfig.vue'
import NotesRender from './notes/NotesRender.vue'
import HomeAssistantConfig from './home-assistant/HomeAssistantConfig.vue'
import HomeAssistantRender from './home-assistant/HomeAssistantRender.vue'
import SynologyNasConfig from './synology-nas/SynologyNasConfig.vue'
import SynologyNasRender from './synology-nas/SynologyNasRender.vue'

export interface WidgetTypeDef {
  type: string
  displayName: string
  description: string
  defaultConfig: Record<string, unknown>
  ConfigComponent: Component
  RenderComponent: Component
}

export const WIDGET_TYPES: WidgetTypeDef[] = [
  {
    type: 'hello-world',
    displayName: 'Hola, mundo',
    description: 'Widget de prueba sin funcionalidad real.',
    defaultConfig: {},
    ConfigComponent: HelloWorldConfig,
    RenderComponent: HelloWorldRender
  },
  {
    type: 'docker-containers',
    displayName: 'Docker · Lista de contenedores',
    description: 'Lista los contenedores de un servidor (Unraid, …) con su uso de CPU y permite arrancarlos, detenerlos o reiniciarlos.',
    defaultConfig: {
      credentialId: '',
      serverLabel: ''
    },
    ConfigComponent: DockerContainersConfig,
    RenderComponent: DockerContainersRender
  },
  {
    type: 'unraid-docker',
    displayName: 'Docker · Un contenedor',
    description: 'Controla un contenedor concreto de un servidor Docker (start/stop/restart) y muestra su estado.',
    defaultConfig: {
      credentialId: '',
      containerName: '',
      serverLabel: ''
    },
    ConfigComponent: UnraidDockerConfig,
    RenderComponent: UnraidDockerRender
  },
  {
    type: 'notes',
    displayName: 'Notas',
    description: 'Notas con texto enriquecido (negrita, itálica, enlaces, listas).',
    defaultConfig: { notes: [] },
    ConfigComponent: NotesConfig,
    RenderComponent: NotesRender
  },
  {
    type: 'home-assistant',
    displayName: 'Home Assistant · Dashboard',
    description: 'Tarjeta con varias entidades de Home Assistant y botones para llamar servicios.',
    defaultConfig: { credentialId: '', title: '', pollIntervalSec: 10, entities: [] },
    ConfigComponent: HomeAssistantConfig,
    RenderComponent: HomeAssistantRender
  },
  {
    type: 'synology-nas',
    displayName: 'Synology · Estado del NAS',
    description: 'Muestra uso de CPU, memoria y espacio de los volúmenes de un Synology NAS, y permite reiniciarlo.',
    defaultConfig: { credentialId: '', title: '', pollIntervalSec: 10, diskWarnPercent: 85 },
    ConfigComponent: SynologyNasConfig,
    RenderComponent: SynologyNasRender
  }
]

export const getWidgetType = (type: string): WidgetTypeDef | undefined =>
  WIDGET_TYPES.find((w) => w.type === type)
