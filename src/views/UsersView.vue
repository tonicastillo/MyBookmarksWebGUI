<script setup lang="ts">
import { onMounted, ref } from 'vue'
import {
  fetchUsers,
  createUserApi,
  updateUserApi,
  deleteUserApi,
  type ManagedUser
} from '@/api/client'
import { useAuthStore } from '@/stores/auth'

const auth = useAuthStore()

const users = ref<ManagedUser[]>([])
const loading = ref(false)
const error = ref<string | null>(null)

const newUsername = ref('')
const newPassword = ref('')
const newIsAdmin = ref(false)
const creating = ref(false)
const createError = ref<string | null>(null)

const passwordById = ref<Record<string, string>>({})
const busyById = ref<Record<string, boolean>>({})
const inlineErrorById = ref<Record<string, string | null>>({})

const load = async () => {
  loading.value = true
  error.value = null
  try {
    users.value = await fetchUsers()
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Error cargando usuarios'
  } finally {
    loading.value = false
  }
}

const onCreate = async () => {
  if (creating.value) return
  createError.value = null
  creating.value = true
  try {
    const created = await createUserApi({
      username: newUsername.value.trim(),
      password: newPassword.value,
      isAdmin: newIsAdmin.value
    })
    users.value = [...users.value, created].sort((a, b) => a.username.localeCompare(b.username))
    newUsername.value = ''
    newPassword.value = ''
    newIsAdmin.value = false
  } catch (e) {
    createError.value = e instanceof Error ? e.message : 'Error creando usuario'
  } finally {
    creating.value = false
  }
}

const onChangePassword = async (user: ManagedUser) => {
  const pwd = passwordById.value[user.id]
  if (!pwd) return
  busyById.value[user.id] = true
  inlineErrorById.value[user.id] = null
  try {
    await updateUserApi(user.id, { password: pwd })
    passwordById.value[user.id] = ''
  } catch (e) {
    inlineErrorById.value[user.id] = e instanceof Error ? e.message : 'Error cambiando contraseña'
  } finally {
    busyById.value[user.id] = false
  }
}

const onToggleAdmin = async (user: ManagedUser) => {
  busyById.value[user.id] = true
  inlineErrorById.value[user.id] = null
  try {
    const updated = await updateUserApi(user.id, { isAdmin: !user.isAdmin })
    const idx = users.value.findIndex(u => u.id === user.id)
    if (idx >= 0) users.value.splice(idx, 1, updated)
  } catch (e) {
    inlineErrorById.value[user.id] = e instanceof Error ? e.message : 'Error actualizando'
  } finally {
    busyById.value[user.id] = false
  }
}

const onDelete = async (user: ManagedUser) => {
  if (!confirm(`¿Borrar el usuario "${user.username}" y todos sus bookmarks?`)) return
  busyById.value[user.id] = true
  inlineErrorById.value[user.id] = null
  try {
    await deleteUserApi(user.id)
    users.value = users.value.filter(u => u.id !== user.id)
  } catch (e) {
    inlineErrorById.value[user.id] = e instanceof Error ? e.message : 'Error borrando usuario'
  } finally {
    busyById.value[user.id] = false
  }
}

const formatDate = (iso: string): string => {
  const d = new Date(iso.replace(' ', 'T') + 'Z')
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' })
}

onMounted(load)
</script>

<template>
  <div class="users-view">
    <header class="head">
      <h1>Gestión de usuarios</h1>
      <p class="hint">Solo los administradores pueden crear, modificar o borrar usuarios.</p>
    </header>

    <section class="card create">
      <h2>Crear usuario</h2>
      <form class="create-form" @submit.prevent="onCreate">
        <label class="field">
          <span class="label">Usuario</span>
          <input v-model="newUsername" type="text" required minlength="2" maxlength="32" />
        </label>
        <label class="field">
          <span class="label">Contraseña</span>
          <input v-model="newPassword" type="password" required minlength="4" />
        </label>
        <label class="checkbox">
          <input v-model="newIsAdmin" type="checkbox" />
          <span>Es administrador</span>
        </label>
        <button class="primary" type="submit" :disabled="creating">
          {{ creating ? 'Creando…' : 'Crear' }}
        </button>
      </form>
      <div v-if="createError" class="error">{{ createError }}</div>
    </section>

    <section class="card list">
      <h2>Usuarios existentes</h2>
      <div v-if="loading" class="status">Cargando…</div>
      <div v-else-if="error" class="error">{{ error }}</div>
      <div v-else-if="users.length === 0" class="status">No hay usuarios.</div>
      <ul v-else class="users">
        <li v-for="user in users" :key="user.id" class="user-row">
          <div class="user-head">
            <div class="user-main">
              <span class="username">{{ user.username }}</span>
              <span v-if="user.isAdmin" class="badge">admin</span>
              <span v-if="user.id === auth.currentUser?.id" class="badge me">tú</span>
            </div>
            <div class="user-meta">Creado el {{ formatDate(user.createdAt) }}</div>
          </div>

          <div class="user-actions">
            <div class="action">
              <input
                v-model="passwordById[user.id]"
                type="password"
                placeholder="Nueva contraseña"
                minlength="4"
              />
              <button
                type="button"
                :disabled="!passwordById[user.id] || busyById[user.id]"
                @click="onChangePassword(user)"
              >
                Cambiar
              </button>
            </div>
            <div class="action">
              <button
                type="button"
                :disabled="busyById[user.id]"
                @click="onToggleAdmin(user)"
              >
                {{ user.isAdmin ? 'Quitar admin' : 'Hacer admin' }}
              </button>
              <button
                type="button"
                class="danger"
                :disabled="busyById[user.id] || user.id === auth.currentUser?.id"
                @click="onDelete(user)"
              >
                Borrar
              </button>
            </div>
          </div>

          <div v-if="inlineErrorById[user.id]" class="error inline">
            {{ inlineErrorById[user.id] }}
          </div>
        </li>
      </ul>
    </section>
  </div>
</template>

<style scoped>
.users-view {
  display: flex;
  flex-direction: column;
  gap: 18px;
  max-width: 760px;
}

.head h1 {
  margin: 0;
  font-size: 20px;
  font-weight: 700;
  letter-spacing: -0.015em;
}
.head .hint {
  margin: 4px 0 0;
  font-size: 13px;
  color: var(--fg-mid, #4a463c);
}

.card {
  background: var(--bg-elev, #ffffff);
  border: 0.5px solid var(--border, rgba(28, 26, 20, 0.12));
  border-radius: 12px;
  padding: 16px 18px;
}
.card h2 {
  margin: 0 0 12px;
  font-size: 14px;
  font-weight: 600;
  color: var(--fg-mid, #4a463c);
  letter-spacing: 0.02em;
  text-transform: uppercase;
}

.create-form {
  display: grid;
  grid-template-columns: 1fr 1fr auto auto;
  gap: 10px;
  align-items: end;
}
@media (max-width: 640px) {
  .create-form { grid-template-columns: 1fr; }
}

.field {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.label {
  font-size: 11.5px;
  font-weight: 600;
  color: var(--fg-mid, #4a463c);
}
input[type="text"], input[type="password"] {
  font: inherit;
  font-size: 13.5px;
  padding: 8px 10px;
  border-radius: 7px;
  border: 0.5px solid var(--border, rgba(28, 26, 20, 0.18));
  background: var(--bg, #faf9f7);
  color: var(--fg, #1c1a14);
  outline: none;
}
input:focus { border-color: var(--fg, #1c1a14); background: var(--bg-elev, #ffffff); }

.checkbox {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  color: var(--fg-mid, #4a463c);
  padding: 8px 4px;
}

button {
  font: inherit;
  font-size: 13px;
  padding: 8px 12px;
  border-radius: 7px;
  border: 0.5px solid var(--border, rgba(28, 26, 20, 0.18));
  background: var(--bg-elev, #ffffff);
  color: var(--fg, #1c1a14);
  cursor: pointer;
  transition: background 120ms ease;
}
button:hover:not(:disabled) { background: var(--bg-soft, #f3f1ec); }
button:disabled { opacity: 0.5; cursor: not-allowed; }
button.primary {
  background: var(--fg, #1c1a14);
  color: var(--bg, #faf9f7);
  border-color: var(--fg, #1c1a14);
  font-weight: 500;
}
button.primary:hover:not(:disabled) { background: var(--fg-mid, #4a463c); }
button.danger { color: #b04444; border-color: rgba(176, 68, 68, 0.4); }
button.danger:hover:not(:disabled) { background: rgba(176, 68, 68, 0.08); }

.users {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.user-row {
  padding: 12px;
  border: 0.5px solid var(--border, rgba(28, 26, 20, 0.08));
  border-radius: 10px;
  background: var(--bg, #faf9f7);
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.user-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}
.user-main {
  display: inline-flex;
  align-items: center;
  gap: 8px;
}
.username {
  font-weight: 600;
  font-size: 14px;
  color: var(--fg, #1c1a14);
}
.badge {
  font-size: 10.5px;
  font-weight: 600;
  padding: 2px 6px;
  border-radius: 5px;
  background: rgba(28, 26, 20, 0.08);
  color: var(--fg-mid, #4a463c);
  text-transform: uppercase;
  letter-spacing: 0.04em;
}
.badge.me { background: rgba(28, 100, 200, 0.12); color: #1c64c8; }
.user-meta {
  font-size: 12px;
  color: var(--fg-faint, #a8a294);
}

.user-actions {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
}
.action {
  display: flex;
  gap: 6px;
  align-items: center;
}

.status { font-size: 13px; color: var(--fg-mid, #4a463c); }
.error {
  font-size: 12.5px;
  color: #b04444;
  background: rgba(176, 68, 68, 0.08);
  padding: 8px 10px;
  border-radius: 6px;
}
.error.inline { margin-top: 4px; }
</style>
