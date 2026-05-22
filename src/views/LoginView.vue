<script setup lang="ts">
import { ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

const auth = useAuthStore()
const router = useRouter()
const route = useRoute()

const username = ref('')
const password = ref('')
const submitting = ref(false)
const formError = ref<string | null>(null)

const onSubmit = async () => {
  if (submitting.value) return
  formError.value = null
  submitting.value = true
  try {
    await auth.login(username.value.trim(), password.value)
    const redirect = typeof route.query.redirect === 'string' ? route.query.redirect : '/'
    router.replace(redirect)
  } catch (e) {
    formError.value = e instanceof Error ? e.message : 'Error iniciando sesión'
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <div class="login-shell">
    <form class="login-card" @submit.prevent="onSubmit">
      <h1 class="title">MyBookmarks</h1>
      <p class="subtitle">Inicia sesión para continuar</p>

      <label class="field">
        <span class="label">Usuario</span>
        <input
          v-model="username"
          type="text"
          autocomplete="username"
          autofocus
          required
        />
      </label>

      <label class="field">
        <span class="label">Contraseña</span>
        <input
          v-model="password"
          type="password"
          autocomplete="current-password"
          required
        />
      </label>

      <div v-if="formError" class="error">{{ formError }}</div>

      <button class="submit" type="submit" :disabled="submitting">
        {{ submitting ? 'Entrando…' : 'Entrar' }}
      </button>
    </form>
  </div>
</template>

<style scoped>
.login-shell {
  min-height: 100vh;
  display: grid;
  place-items: center;
  padding: 24px;
  background: var(--bg, #faf9f7);
}

.login-card {
  width: 100%;
  max-width: 360px;
  padding: 28px 26px 26px;
  border-radius: 12px;
  background: var(--bg-elev, #ffffff);
  border: 0.5px solid var(--border, rgba(28, 26, 20, 0.12));
  box-shadow: 0 4px 18px rgba(28, 26, 20, 0.05);
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.title {
  margin: 0;
  font-size: 22px;
  font-weight: 700;
  letter-spacing: -0.015em;
  color: var(--fg, #1c1a14);
}
.subtitle {
  margin: 0 0 6px;
  font-size: 13px;
  color: var(--fg-mid, #4a463c);
}

.field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.label {
  font-size: 12px;
  font-weight: 600;
  color: var(--fg-mid, #4a463c);
  letter-spacing: -0.005em;
}
.field input {
  font: inherit;
  font-size: 14px;
  padding: 10px 12px;
  border-radius: 8px;
  border: 0.5px solid var(--border, rgba(28, 26, 20, 0.18));
  background: var(--bg, #faf9f7);
  color: var(--fg, #1c1a14);
  outline: none;
  transition: border-color 120ms ease, background 120ms ease;
}
.field input:focus {
  border-color: var(--fg, #1c1a14);
  background: var(--bg-elev, #ffffff);
}

.error {
  font-size: 12.5px;
  color: #b04444;
  background: rgba(176, 68, 68, 0.08);
  padding: 8px 10px;
  border-radius: 6px;
}

.submit {
  font: inherit;
  font-size: 14px;
  padding: 10px 12px;
  border-radius: 8px;
  border: 0;
  background: var(--fg, #1c1a14);
  color: var(--bg, #faf9f7);
  font-weight: 500;
  cursor: pointer;
  transition: background 120ms ease;
}
.submit:hover:not(:disabled) {
  background: var(--fg-mid, #4a463c);
}
.submit:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}
</style>
