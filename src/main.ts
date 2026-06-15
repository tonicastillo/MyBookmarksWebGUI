import { createApp } from 'vue'
import { createPinia } from 'pinia'
import axios from 'axios'
import App from './App.vue'
import router from './router'
import { api, type ApiError } from '@/api/client'
import { useAuthStore } from '@/stores/auth'
import './style.css'

const app = createApp(App)

app.use(createPinia())
app.use(router)

api.interceptors.response.use(
  (response) => response,
  (error) => {
    // El interceptor de client.ts corre antes y reemplaza el AxiosError por un
    // Error plano (preservando `status`), así que el 401 puede llegar de ambas formas.
    const status = axios.isAxiosError(error)
      ? error.response?.status
      : (error as ApiError | undefined)?.status
    if (status === 401) {
      const auth = useAuthStore()
      if (auth.isAuthenticated) {
        auth.setUser(null)
        if (router.currentRoute.value.name !== 'login') {
          router.push({ name: 'login', query: { redirect: router.currentRoute.value.fullPath } })
        }
      }
    }
    return Promise.reject(error)
  }
)

app.mount('#app')
