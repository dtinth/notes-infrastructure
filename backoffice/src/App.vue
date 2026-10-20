<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { api, getToken, setToken, Unauthorized, type NoteSummary, type PlanItem, type Status } from './api'
import { refreshSession, signInWithGoogle } from './auth'
import NoteEditor from './components/NoteEditor.vue'
import NoteList from './components/NoteList.vue'
import PlanDialog from './components/PlanDialog.vue'

const signedIn = ref(false)
const loginError = ref('')
const googleButton = ref<HTMLElement>()
const apiKeyInput = ref('')

const notes = ref<NoteSummary[]>([])
const planItems = ref<PlanItem[]>([])
const status = ref<Status>()
const selectedId = ref<string>()
const source = ref('')
const savedSource = ref('')
const previewHtml = ref('')
const previewErrors = ref<string[]>([])
const planOpen = ref(false)
const applying = ref(false)
const message = ref('')

const plan = computed(() => new Map(planItems.value.map((item) => [item.id, item])))
const dirty = computed(() => source.value !== savedSource.value)
const selectedPlanItem = computed(() =>
  selectedId.value ? plan.value.get(selectedId.value) : undefined,
)
const selectedNote = computed(() => notes.value.find((note) => note.id === selectedId.value))

async function guard<T>(promise: Promise<T>) {
  try {
    return await promise
  } catch (error) {
    if (error instanceof Unauthorized && !(await refreshSession())) {
      setToken(null)
      signedIn.value = false
    }
    throw error
  }
}

async function refresh() {
  const [list, planResult, statusResult] = await guard(
    Promise.all([api.listNotes(), api.plan(), api.status()]),
  )
  notes.value = list
  planItems.value = planResult.items
  status.value = statusResult
}

async function select(id: string) {
  if (dirty.value && !confirm('Discard unsaved changes?')) return
  const { source: text } = await guard(api.getNote(id))
  selectedId.value = id
  source.value = savedSource.value = text
  history.replaceState(null, '', `#${encodeURIComponent(id)}`)
}

async function save() {
  if (!selectedId.value || !dirty.value) return
  const text = source.value
  await guard(api.saveNote(selectedId.value, text))
  savedSource.value = text
  flash('Saved')
  await refresh()
}

async function createNote() {
  const id = prompt('New note id (file name without .md)')?.trim()
  if (!id) return
  if (notes.value.some((note) => note.id === id)) return select(id)
  await guard(api.saveNote(id, `---\ntitle: ''\n---\n\n# \n`))
  await refresh()
  await select(id)
}

async function applyPlan(ids?: string[]) {
  applying.value = true
  try {
    if (dirty.value) await save()
    const { items } = await guard(api.apply(ids))
    flash(`Applied ${items.length} change${items.length === 1 ? '' : 's'}. The site rebuilds shortly.`)
    await refresh()
    if (!planItems.value.length) planOpen.value = false
  } finally {
    applying.value = false
  }
}

async function retrySync() {
  await guard(api.retrySync())
  await refresh()
}

let flashTimer: ReturnType<typeof setTimeout> | undefined
function flash(text: string) {
  message.value = text
  clearTimeout(flashTimer)
  flashTimer = setTimeout(() => (message.value = ''), 4000)
}

// Preview follows the editor, compiled on the server.
let previewTimer: ReturnType<typeof setTimeout> | undefined
watch([source, selectedId], () => {
  clearTimeout(previewTimer)
  previewTimer = setTimeout(async () => {
    if (!selectedId.value) return
    const { html, errors } = await guard(api.preview(selectedId.value, source.value))
    previewHtml.value = html
    previewErrors.value = errors
  }, 500)
})

async function start() {
  signedIn.value = true
  await refresh()
  const fromHash = decodeURIComponent(location.hash.slice(1))
  if (fromHash) await select(fromHash).catch(() => {})
}

async function useApiKey() {
  setToken(apiKeyInput.value.trim())
  try {
    await api.status()
    await start()
  } catch {
    setToken(null)
    loginError.value = 'That key was not accepted.'
  }
}

let poll: ReturnType<typeof setInterval> | undefined
onMounted(async () => {
  if (getToken() || (await refreshSession())) {
    try {
      await start()
    } catch {}
  }
  if (!signedIn.value) {
    signInWithGoogle(googleButton.value!)
      .then(start)
      .catch((error) => (loginError.value = String(error.message ?? error)))
  }
  poll = setInterval(() => signedIn.value && refresh().catch(() => {}), 10_000)
  window.addEventListener('beforeunload', (event) => dirty.value && event.preventDefault())
})
onUnmounted(() => clearInterval(poll))
</script>

<template>
  <div v-if="!signedIn" class="login">
    <h1>notes</h1>
    <div ref="googleButton"></div>
    <details>
      <summary>Use an API key</summary>
      <form @submit.prevent="useApiKey">
        <input v-model="apiKeyInput" type="password" placeholder="NOTES_API_KEY" aria-label="API key" />
        <button type="submit">Sign in</button>
      </form>
    </details>
    <p v-if="loginError" class="error">{{ loginError }}</p>
  </div>

  <div v-else class="app">
    <header class="top">
      <strong class="brand">notes</strong>
      <span class="sync" :class="status?.vault?.state">
        vault: {{ status?.vault?.state ?? 'not synced' }}
      </span>
      <span class="sync" :class="status?.site?.state">
        site: {{ status?.site?.state ?? 'idle' }}
      </span>
      <span class="message">{{ message }}</span>
      <button :class="{ primary: planItems.length > 0 }" @click="planOpen = true">
        {{ planItems.length ? `${planItems.length} to publish` : 'All published' }}
      </button>
    </header>

    <div v-if="status?.vault?.state === 'conflict' || status?.vault?.state === 'error'" class="banner">
      <span>{{ status.vault.message }}</span>
      <button @click="retrySync">Retry sync</button>
    </div>

    <main class="panes">
      <NoteList :notes="notes" :plan="plan" :selected="selectedId" @select="select" @create="createNote" />

      <section class="pane editor-pane">
        <template v-if="selectedId">
          <div class="pane-bar">
            <code>{{ selectedId }}.md</code>
            <span v-if="dirty" class="dirty">unsaved</span>
            <span v-else-if="selectedPlanItem" :class="['state', `op-${selectedPlanItem.op}`]">
              {{ selectedPlanItem.op === 'create' ? 'not published yet' : selectedPlanItem.op === 'delete' ? 'will be unpublished' : 'changed since publish' }}
            </span>
            <span v-else-if="selectedNote?.public" class="state op-create">published</span>
            <span v-else class="state">private</span>
            <span class="spacer"></span>
            <button :disabled="!dirty" @click="save">Save</button>
            <button
              class="primary"
              :disabled="applying || (!dirty && !selectedPlanItem)"
              @click="applyPlan([selectedId!])"
            >
              {{ selectedPlanItem?.op === 'delete' ? 'Unpublish' : 'Publish' }}
            </button>
          </div>
          <NoteEditor v-model="source" @save="save" />
        </template>
        <p v-else class="empty">Pick a note, or press + to start one.</p>
      </section>

      <section class="pane preview-pane">
        <div class="pane-bar">
          <span>Preview</span>
          <span v-if="previewErrors.length" class="error">{{ previewErrors.length }} error(s)</span>
        </div>
        <iframe v-if="previewHtml" :srcdoc="previewHtml" title="Preview" sandbox="allow-scripts allow-popups"></iframe>
      </section>
    </main>

    <PlanDialog v-if="planOpen" :items="planItems" :applying="applying" @apply="applyPlan" @close="planOpen = false" />
  </div>
</template>

<style scoped>
.login { display: grid; place-content: center; justify-items: center; gap: 16px; height: 100%; }
.login h1 { margin: 0; font-weight: 600; }
.login form { display: flex; gap: 6px; margin-top: 8px; }
.login summary { color: var(--mute); cursor: pointer; }
.error { color: var(--bad); }
.app { display: flex; flex-direction: column; height: 100%; }
.top { display: flex; align-items: center; gap: 14px; padding: 8px 14px; background: #0b0b0b; border-bottom: 1px solid var(--line); }
.brand { font-size: 16px; }
.sync { font-size: 12px; color: var(--mute); }
.sync.idle { color: var(--ok); }
.sync.conflict, .sync.error { color: var(--bad); }
.sync.syncing, .sync.publishing { color: var(--warn); }
.message { flex: 1; color: var(--accent); font-size: 13px; }
.banner { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 8px 14px; background: #4a2420; color: #ffd6cf; }
.panes { flex: 1; min-height: 0; display: grid; grid-template-columns: 280px 1fr 1fr; }
.pane { display: flex; flex-direction: column; min-width: 0; min-height: 0; border-right: 1px solid var(--line); }
.pane-bar { display: flex; align-items: center; gap: 10px; padding: 8px 12px; background: var(--panel); border-bottom: 1px solid var(--line); min-height: 44px; }
.pane-bar .spacer { flex: 1; }
.dirty { color: var(--warn); font-size: 12px; }
.state { font-size: 12px; color: var(--mute); }
.editor-pane > :last-child { flex: 1; min-height: 0; }
.preview-pane iframe { flex: 1; border: 0; background: #353331; width: 100%; }
.empty { color: var(--mute); padding: 24px; }
@media (max-width: 900px) {
  .panes { grid-template-columns: 1fr; grid-template-rows: 35% 1fr; }
  .preview-pane { display: none; }
}
</style>
