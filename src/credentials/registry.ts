export interface CredentialFieldDef {
  key: string
  label: string
  type: 'text' | 'url' | 'password'
  placeholder?: string
  required?: boolean
  hint?: string
}

export type CredentialCategory = 'docker' | 'home-automation'

export interface CredentialTypeDef {
  type: string
  displayName: string
  description: string
  category: CredentialCategory
  /** Si está marcado, el proveedor se muestra pero aún no es funcional. */
  comingSoon?: boolean
  fields: CredentialFieldDef[]
}

export const CREDENTIAL_TYPES: CredentialTypeDef[] = [
  {
    type: 'unraid',
    displayName: 'Servidor Unraid',
    description: 'URL del servidor Unraid + API token (x-api-key) para gestión de Docker.',
    category: 'docker',
    fields: [
      {
        key: 'serverUrl',
        label: 'URL del servidor',
        type: 'url',
        placeholder: 'https://unraid.local',
        required: true
      },
      {
        key: 'serverLabel',
        label: 'Etiqueta (opcional)',
        type: 'text',
        placeholder: 'Fuji',
        hint: 'Se muestra como nombre del servidor en el widget cuando no se sobreescribe.'
      },
      {
        key: 'apiToken',
        label: 'API token',
        type: 'password',
        placeholder: '••••••••',
        required: true,
        hint: 'Se envía como cabecera x-api-key al endpoint /graphql.'
      }
    ]
  },
  {
    type: 'casaos',
    displayName: 'CasaOS',
    description: 'Gestión de Docker sobre un servidor CasaOS.',
    category: 'docker',
    comingSoon: true,
    fields: []
  },
  {
    type: 'dokploy',
    displayName: 'Dokploy',
    description: 'Gestión de Docker sobre un servidor Dokploy.',
    category: 'docker',
    comingSoon: true,
    fields: []
  },
  {
    type: 'homeassistant',
    displayName: 'Home Assistant',
    description: 'URL base + Long-Lived Access Token para llamar a la REST API de Home Assistant.',
    category: 'home-automation',
    fields: [
      {
        key: 'baseUrl',
        label: 'URL base',
        type: 'url',
        placeholder: 'https://homeassistant.local:8123',
        required: true
      },
      {
        key: 'accessToken',
        label: 'Access Token',
        type: 'password',
        placeholder: '••••••••',
        required: true,
        hint: 'Crea un Long-Lived Access Token en tu perfil de Home Assistant.'
      }
    ]
  }
]

export const getCredentialType = (type: string): CredentialTypeDef | undefined =>
  CREDENTIAL_TYPES.find((c) => c.type === type)

export const credentialTypesByCategory = (category: CredentialCategory): CredentialTypeDef[] =>
  CREDENTIAL_TYPES.filter((c) => c.category === category)

/** Tipos (== ids de proveedor) disponibles para una categoría (excluye los comingSoon). */
export const credentialTypeIdsByCategory = (category: CredentialCategory): string[] =>
  credentialTypesByCategory(category).filter((c) => !c.comingSoon).map((c) => c.type)
