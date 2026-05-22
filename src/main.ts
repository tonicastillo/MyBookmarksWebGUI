import { createApp } from 'vue'
import { createPinia } from 'pinia'
import axios from 'axios'
import App from './App.vue'
import router from './router'
import { api } from '@/api/notion'
import { useAuthStore } from '@/stores/auth'
import './style.css'

const app = createApp(App)

app.use(createPinia())
app.use(router)

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (axios.isAxiosError(error) && error.response?.status === 401) {
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
