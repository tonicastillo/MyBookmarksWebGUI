import { useBookmarks } from '@/composables/useBookmarks'

const SYNC_INTERVAL_MS = 10 * 60 * 1000 // 10 minutos

// Estado a nivel de módulo: garantiza una única sincronización inicial
// por sesión y un solo interval aunque el composable se use varias veces.
let started = false
let lastSyncAt = 0

/**
 * Sincronización automática con el backend:
 * - Al entrar (una vez por sesión), aunque la caché local siga vigente.
 * - Cada 10 minutos mientras la pestaña esté visible.
 * - Al volver a la pestaña si la última sincronización tiene más de 10 min.
 *
 * Usa `loadData(true)`, que muestra la caché al instante y refresca en
 * segundo plano (flag `refreshing`), así que no bloquea la UI.
 */
export const useAutoSync = () => {
  const { loadData } = useBookmarks()

  const syncNow = async (): Promise<void> => {
    lastSyncAt = Date.now()
    await loadData(true)
  }

  const start = (): void => {
    if (started) return
    started = true

    void syncNow()

    window.setInterval(() => {
      if (document.visibilityState === 'visible') {
        void syncNow()
      }
    }, SYNC_INTERVAL_MS)

    document.addEventListener('visibilitychange', () => {
      if (
        document.visibilityState === 'visible' &&
        Date.now() - lastSyncAt >= SYNC_INTERVAL_MS
      ) {
        void syncNow()
      }
    })
  }

  return { start, syncNow }
}
