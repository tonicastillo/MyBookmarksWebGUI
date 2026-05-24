export interface CredentialFieldDef {
  key: string
  label: string
  type: 'text' | 'url' | 'password'
  placeholder?: string
  required?: boolean
  hint?: string
}

export interface CredentialTypeDef {
  type: string
  displayName: string
  description: string
  fields: CredentialFieldDef[]
}

export const CREDENTIAL_TYPES: CredentialTypeDef[] = [
  {
    type: 'unraid',
    displayName: 'Servidor Unraid',
    description: 'URL del servidor Unraid + API token (x-api-key) para los widgets de Docker.',
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
  }
]

export const getCredentialType = (type: string): CredentialTypeDef | undefined =>
  CREDENTIAL_TYPES.find((c) => c.type === type)
