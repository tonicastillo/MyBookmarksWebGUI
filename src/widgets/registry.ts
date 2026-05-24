import type { Component } from 'vue'
import HelloWorldConfig from './hello-world/HelloWorldConfig.vue'
import HelloWorldRender from './hello-world/HelloWorldRender.vue'
import UnraidDockerConfig from './unraid-docker/UnraidDockerConfig.vue'
import UnraidDockerRender from './unraid-docker/UnraidDockerRender.vue'
import NotesConfig from './notes/NotesConfig.vue'
import NotesRender from './notes/NotesRender.vue'

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
    type: 'unraid-docker',
    displayName: 'Unraid · Contenedor Docker',
    description: 'Controla un contenedor de un servidor Unraid (start/stop/restart) y muestra su estado.',
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
  }
]

export const getWidgetType = (type: string): WidgetTypeDef | undefined =>
  WIDGET_TYPES.find((w) => w.type === type)
