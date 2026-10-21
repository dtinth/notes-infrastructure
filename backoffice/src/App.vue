<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { api, Conflict, getToken, setToken, Unauthorized, type NoteSummary, type PlanItem, type Preview, type Status } from './api'
import { refreshSession, signInWithGoogle } from './auth'
import { addRevision, makePublic } from './frontmatter'
import { CONFLICT_START, mergeOutsideChanges } from './merge'
import NoteEditor from './components/NoteEditor.vue'
import NoteList from './components/NoteList.vue'
import PlanDialog from './components/PlanDialog.vue'
import PreviewFrame from './components/PreviewFrame.vue'
import SearchPalette from './components/SearchPalette.vue'

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
/** Version of `savedSource`, the note as on disk when last loaded or saved. */
const savedVersion = ref<string>()
const preview = ref<Preview & { page: string }>()
const planOpen = ref(false)
const applying = ref(false)
const message = ref('')

const plan = computed(() => new Map(planItems.value.map((item) => [item.id, item])))
const dirty = computed(() => source.value !== savedSource.value)
const hasConflictMarkers = computed(() => source.value.includes(CONFLICT_START))
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
  const onDisk = list.find((note) => note.id === selectedId.value)
  if (onDisk && savedVersion.value && onDisk.version !== savedVersion.value) {
    await pullOutsideChanges()
  }
}

async function select(id: string) {
  if (dirty.value && !confirm('Discard unsaved changes?')) return
  const { source: text, note } = await guard(api.getNote(id))
  selectedId.value = id
  source.value = savedSource.value = text
  savedVersion.value = note.version
  phoneView.value = 'editor'
  history.replaceState(null, '', `#${encodeURIComponent(id)}`)
}

/**
 * Brings in changes made to the open note outside the editor, e.g. by an
 * agent: as is if there are no unsaved edits, else merged into them.
 */
async function pullOutsideChanges() {
  const id = selectedId.value
  if (!id) return
  const { source: theirs, note } = await guard(api.getNote(id))
  if (id !== selectedId.value || note.version === savedVersion.value) return
  if (!dirty.value) {
    source.value = theirs
    flash('Updated with changes from outside the editor')
  } else {
    const merged = mergeOutsideChanges(savedSource.value, source.value, theirs)
    source.value = merged.text
    flash(
      merged.conflict
        ? 'Outside changes conflict with yours: see the markers in the editor'
        : 'Merged changes from outside the editor into yours',
    )
  }
  savedSource.value = theirs
  savedVersion.value = note.version
}

async function save() {
  if (!selectedId.value || !dirty.value) return
  if (hasConflictMarkers.value && !confirm('The note still has conflict markers. Save anyway?')) return
  const text = source.value
  try {
    const { version } = await guard(api.saveNote(selectedId.value, text, savedVersion.value))
    savedSource.value = text
    savedVersion.value = version
    flash('Saved')
  } catch (error) {
    if (!(error instanceof Conflict)) throw error
    await pullOutsideChanges()
    flash('The note changed outside the editor. Merged; check it and save again.')
    return
  }
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

// Cmd+K, as in the legacy VS Code extension: with text selected, links it
// to the picked note; otherwise opens the picked note. Until something is
// typed, it searches for the open note plus the selection, which brings up
// related notes and the ones linking here.
const editor = ref<InstanceType<typeof NoteEditor>>()
const searchShortcut = /Mac|iPhone|iPad/.test(navigator.userAgent) ? '⌘K' : 'Ctrl+K'
const palette = ref<{ linkText?: string; contextQuery: string }>()
function openPalette(selectedText = '') {
  const linkText = selectedText.trim() ? selectedText : undefined
  const context = linkText ?? source.value.slice(0, 2000)
  palette.value = { linkText, contextQuery: `${selectedId.value ?? ''} ${context}` }
}
function closePalette() {
  palette.value = undefined
  editor.value?.focus()
}
async function pickFromPalette(id: string) {
  const linkText = palette.value?.linkText
  palette.value = undefined
  if (linkText) editor.value?.replaceSelection(`[${linkText}](${id})`)
  else await select(id)
}
function onGlobalKeydown(event: KeyboardEvent) {
  if (signedIn.value && (event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
    event.preventDefault()
    if (!palette.value) openPalette()
  }
}

// Actions edit the source in the editor; saving and publishing stay manual.
const actionsMenu = ref<HTMLDetailsElement>()
function runAction(action: 'public' | 'revision') {
  actionsMenu.value!.open = false
  if (action === 'public') {
    source.value = makePublic(source.value)
  } else {
    const description = prompt('What changed in this revision?')?.trim()
    if (description) source.value = addRevision(source.value, description)
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

const PREVIEW_KEY = 'notes:preview'
const showPreview = ref(readPreference() !== 'hidden')
function readPreference() {
  try {
    return localStorage.getItem(PREVIEW_KEY)
  } catch {
    return null
  }
}
watch(showPreview, (shown) => {
  try {
    localStorage.setItem(PREVIEW_KEY, shown ? 'shown' : 'hidden')
  } catch {}
})

// On a phone, one view at a time: the list, the editor, or the preview.
const phoneQuery = matchMedia('(max-width: 760px)')
const isPhone = ref(phoneQuery.matches)
phoneQuery.addEventListener('change', (event) => (isPhone.value = event.matches))
const phoneView = ref<'list' | 'editor' | 'preview'>('list')
const previewVisible = computed(() =>
  isPhone.value ? phoneView.value === 'preview' : showPreview.value,
)
function togglePreview() {
  if (isPhone.value) phoneView.value = phoneView.value === 'preview' ? 'editor' : 'preview'
  else showPreview.value = !showPreview.value
}

/** The note on the live site, in private mode (shows unpublished notes). */
const siteUrl = computed(
  () => selectedId.value && `https://dt.in.th/private/${encodeURIComponent(selectedId.value)}`,
)

// Preview follows the editor, compiled on the server.
let previewTimer: ReturnType<typeof setTimeout> | undefined
watch([source, selectedId, previewVisible], () => {
  clearTimeout(previewTimer)
  previewTimer = setTimeout(async () => {
    if (!selectedId.value || !previewVisible.value) return
    const page = selectedId.value
    preview.value = { ...(await guard(api.preview(page, source.value))), page }
  }, 300)
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
  // Coming back to the tab (say, after an agent edited the note) checks now.
  document.addEventListener('visibilitychange', onVisible)
  window.addEventListener('beforeunload', (event) => dirty.value && event.preventDefault())
  window.addEventListener('keydown', onGlobalKeydown)
})
function onVisible() {
  if (document.visibilityState === 'visible' && signedIn.value) refresh().catch(() => {})
}
onUnmounted(() => {
  clearInterval(poll)
  document.removeEventListener('visibilitychange', onVisible)
  window.removeEventListener('keydown', onGlobalKeydown)
})
</script>

<template>
  <div v-if="!signedIn" class="login">
    <h1>📝 notes</h1>
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

  <div v-else class="app" :class="`phone-${phoneView}`">
    <header class="top">
      <h1>📝 notes</h1>
      <span class="sync" :class="status?.vault?.state">
        vault: {{ status?.vault?.state ?? 'not synced' }}
      </span>
      <span class="sync" :class="status?.site?.state">
        site: {{ status?.site?.state ?? 'idle' }}
      </span>
      <span class="message">{{ message }}</span>
      <button :class="{ accent: planItems.length > 0 }" @click="planOpen = true">
        {{ planItems.length ? `${planItems.length} to publish` : 'All published' }}
      </button>
    </header>

    <div v-if="hasConflictMarkers" class="banner">
      <span>Changes made outside the editor conflict with yours. Keep what you want between the &lt;&lt;&lt;&lt;&lt;&lt;&lt; and &gt;&gt;&gt;&gt;&gt;&gt;&gt; markers, remove the markers, then save.</span>
    </div>

    <div v-if="status?.vault?.state === 'conflict' || status?.vault?.state === 'error'" class="banner">
      <span>{{ status.vault.message }}</span>
      <button @click="retrySync">Retry sync</button>
    </div>

    <main class="panes" :class="{ 'no-preview': !showPreview }">
      <NoteList
        class="list-pane"
        :notes="notes" :plan="plan" :selected="selectedId" @select="select" @create="createNote" />

      <section class="pane editor-pane">
        <template v-if="selectedId">
          <div class="pane-bar">
            <button class="back" aria-label="Back to notes" @click="phoneView = 'list'">‹ Notes</button>
            <code class="file">{{ selectedId }}.md</code>
            <span v-if="dirty" class="dirty">unsaved</span>
            <span v-else-if="selectedPlanItem" :class="['state', `op-${selectedPlanItem.op}`]">
              {{ selectedPlanItem.op === 'create' ? 'not published yet' : selectedPlanItem.op === 'delete' ? 'will be unpublished' : 'changed since publish' }}
            </span>
            <span v-else-if="selectedNote?.public" class="state op-create">published</span>
            <span v-else class="state">private</span>
            <span class="spacer"></span>
            <details ref="actionsMenu" class="menu">
              <summary class="button">Actions</summary>
              <div class="menu-items">
                <button @click="runAction('public')">Make public</button>
                <button @click="runAction('revision')">Add revision…</button>
                <a class="button" :href="siteUrl" target="_blank" rel="noopener" @click="actionsMenu!.open = false">Open on dt.in.th ↗</a>
              </div>
            </details>
            <button
              :aria-pressed="previewVisible"
              :title="previewVisible ? 'Hide preview' : 'Show preview'"
              @click="togglePreview"
            >
              Preview
            </button>
            <button :disabled="!dirty" @click="save">Save</button>
            <button
              class="accent"
              :disabled="applying || (!dirty && !selectedPlanItem)"
              @click="applyPlan([selectedId!])"
            >
              {{ selectedPlanItem?.op === 'delete' ? 'Unpublish' : 'Publish' }}
            </button>
          </div>
          <NoteEditor ref="editor" v-model="source" @save="save" @search="openPalette" />
        </template>
        <p v-else class="empty">Pick a note, press <kbd>{{ searchShortcut }}</kbd> to search, or + to start one.</p>
      </section>

      <section v-show="previewVisible" class="pane preview-pane">
        <div class="pane-bar">
          <button class="back" @click="phoneView = 'editor'">‹ Edit</button>
          <span class="pane-title">Preview</span>
          <span v-if="preview?.errors.length" class="error">{{ preview?.errors.length }} error(s)</span>
          <span class="spacer"></span>
          <a v-if="siteUrl" :href="siteUrl" target="_blank" rel="noopener">Open on dt.in.th ↗</a>
        </div>
        <PreviewFrame v-if="preview" :preview="preview" />
      </section>
    </main>

    <SearchPalette
      v-if="palette"
      :link-text="palette.linkText"
      :context-query="palette.contextQuery"
      :current-id="selectedId"
      :recent="notes"
      @pick="pickFromPalette"
      @close="closePalette"
    />
    <PlanDialog v-if="planOpen" :items="planItems" :applying="applying" @apply="applyPlan" @close="planOpen = false" />
  </div>
</template>

<style scoped>
.login { display: grid; place-content: center; justify-items: center; gap: 1rem; height: 100%; }
.login form { display: flex; gap: .4rem; margin-top: .6rem; }
.login summary { color: var(--fg-muted); cursor: pointer; }
.error { color: var(--accent-pink); }
.app { display: flex; flex-direction: column; height: 100%; }
.top { display: flex; align-items: center; gap: 1rem; padding: .5rem 1rem; background: var(--bg-deep); border-bottom: 1px solid var(--border-weak); }
.top h1 { font-size: 1.3rem; }
.sync { font-size: .8rem; color: var(--fg-muted); }
.sync.idle { color: var(--ok); }
.sync.conflict, .sync.error { color: var(--accent-pink); }
.sync.syncing, .sync.publishing { color: var(--warn); }
.message { flex: 1; color: var(--accent-cream); font-size: .85rem; }
.banner { display: flex; align-items: center; justify-content: space-between; gap: .8rem; padding: .5rem 1rem; background: #3a2533; color: var(--accent-pink); border-bottom: 1px solid var(--border-weak); }
.panes { flex: 1; min-height: 0; display: grid; grid-template-columns: 17rem 1fr 1fr; }
.panes.no-preview { grid-template-columns: 17rem 1fr; }
.pane { display: flex; flex-direction: column; min-width: 0; min-height: 0; border-right: 1px solid var(--border-weak); background: var(--bg-raised); }
.pane-bar { display: flex; align-items: center; gap: .6rem; padding: .45rem .8rem; background: var(--bg-base); border-bottom: 1px solid var(--border-weak); min-height: 3rem; }
.pane-bar .spacer { flex: 1; }
.pane-title { color: var(--fg-muted); font-weight: 600; font-size: .85rem; }
.dirty { color: var(--warn); font-size: .8rem; }
.state { font-size: .8rem; color: var(--fg-muted); }
.editor-pane > :last-child { flex: 1; min-height: 0; }
.empty { color: var(--fg-muted); padding: 1.5rem; }
.menu { position: relative; }
.menu summary { list-style: none; }
.menu summary::-webkit-details-marker { display: none; }
.menu-items { position: absolute; right: 0; top: calc(100% + .3rem); z-index: 10; display: flex; flex-direction: column; gap: .25rem; padding: .35rem; min-width: 11rem; background: var(--bg-raised); border: 1px solid var(--border-weak); border-radius: var(--radius-sm); box-shadow: 0 6px 20px #0006; }
.menu-items button, .menu-items .button { text-align: left; }
button[aria-pressed='true'] { color: var(--accent-sky); border-color: var(--accent-sky); }
.preview-pane .pane-bar a { font-size: .85rem; }
.back { display: none; }
@media (max-width: 760px) {
  .top { gap: .6rem; padding: .4rem .8rem; }
  .top h1 { font-size: 1.1rem; white-space: nowrap; }
  .sync { white-space: nowrap; font-size: .75rem; }
  .top > button { margin-left: auto; }
  /* Flash messages float at the bottom instead of squeezing the header. */
  .message { position: fixed; left: 16px; right: 16px; bottom: 16px; z-index: 30; text-align: center; pointer-events: none; }
  .message:not(:empty) { padding: .5rem .8rem; background: var(--bg-elev); border-radius: var(--radius-sm); box-shadow: 0 6px 20px #0008; }
  .panes, .panes.no-preview { grid-template-columns: 1fr; }
  .pane { border-right: 0; }
  .phone-list .editor-pane, .phone-list .preview-pane { display: none !important; }
  .phone-editor .list-pane, .phone-editor .preview-pane { display: none !important; }
  .phone-preview .list-pane, .phone-preview .editor-pane { display: none !important; }
  .back { display: inline-block; }
  /* The bar's buttons get a row of their own, sharing it evenly. */
  .editor-pane .pane-bar { flex-wrap: wrap; row-gap: .45rem; }
  .editor-pane .pane-bar .spacer { flex-basis: 100%; height: 0; }
  .editor-pane .pane-bar > button:not(.back), .editor-pane .pane-bar .menu { flex: 1; }
  .editor-pane .pane-bar .menu summary { width: 100%; text-align: center; }
  .editor-pane .pane-bar button { padding: .4rem .5rem; }
  .file { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .menu-items { left: 0; right: auto; }
}
</style>
