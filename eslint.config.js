import pluginVue from 'eslint-plugin-vue'
import { defineConfigWithVueTs, vueTsConfigs } from '@vue/eslint-config-typescript'

export default defineConfigWithVueTs(
  {
    name: 'app/files-to-lint',
    files: ['**/*.{ts,mts,tsx,vue}']
  },
  {
    name: 'app/files-to-ignore',
    ignores: [
      '**/dist/**',
      '**/dist-ssr/**',
      '**/coverage/**',
      '**/node_modules/**',
      'backend/dist/**'
    ]
  },
  pluginVue.configs['flat/essential'],
  vueTsConfigs.recommended,
  {
    name: 'app/rules',
    rules: {
      // Nombres de componente de una sola palabra (Icon, Sidebar) permitidos.
      'vue/multi-word-component-names': 'off',
      // Permite `declare global { namespace Express { ... } }` para augmentar tipos.
      '@typescript-eslint/no-namespace': ['error', { allowDeclarations: true }]
    }
  }
)
