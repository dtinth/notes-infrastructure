<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import { api, type NoteSummary, type SearchResult } from '../api'

const props = defineProps<{
  /** Link mode replaces the selected text with a link to the picked note. */
  linkText?: string
  /** Searched until something is typed, like legacy's quick pick. */
  contextQuery: string
  /** The open note, left out of results. */
  currentId?: string
  /** Shown when there is nothing to search for yet. */
  recent: NoteSummary[]
}>()
const emit = defineEmits<{ pick: [id: string]; close: [] }>()

const input = ref<HTMLInputElement>()
const list = ref<HTMLElement>()
const query = ref('')
const results = ref<SearchResult[]>([])
const active = ref(0)

const recentResults = computed<SearchResult[]>(() =>
  props.recent.slice(0, 30).map((note) => ({
    id: note.id,
    title: note.title,
    excerpt: '',
    public: note.public,
    linksHere: false,
  })),
)
const shown = computed(() => results.value.filter((result) => result.id !== props.currentId))

let latest = 0
async function search() {
  const typed = query.value.trim()
  const q = typed || props.contextQuery.trim()
  const id = ++latest
  let found = q ? await api.search(q) : []
  if (id !== latest) return
  // Nothing related to the open note: offer recent notes instead.
  if (!typed && !found.some((result) => result.id !== props.currentId)) {
    found = recentResults.value
  }
  results.value = found
  active.value = 0
}
let timer: ReturnType<typeof setTimeout> | undefined
watch(query, () => {
  clearTimeout(timer)
  timer = setTimeout(search, 120)
})
onMounted(() => {
  input.value?.focus()
  search()
})

function move(delta: number) {
  if (!shown.value.length) return
  active.value = (active.value + delta + shown.value.length) % shown.value.length
  nextTick(() => list.value?.querySelector('.active')?.scrollIntoView({ block: 'nearest' }))
}
function pick(result = shown.value[active.value]) {
  if (result) emit('pick', result.id)
}
</script>

<template>
  <div class="backdrop" @click.self="emit('close')">
    <div class="palette card" role="dialog" :aria-label="linkText ? 'Link to a note' : 'Open a note'">
      <div class="head">
        <span v-if="linkText" class="mode">Link <q>{{ linkText }}</q> to…</span>
        <input
          ref="input"
          v-model="query"
          :placeholder="linkText ? 'Search notes to link to' : 'Search notes to open'"
          aria-label="Search notes"
          @keydown.down.prevent="move(1)"
          @keydown.up.prevent="move(-1)"
          @keydown.enter.prevent="pick()"
          @keydown.esc.prevent="emit('close')"
        />
      </div>
      <ul ref="list" role="listbox">
        <li
          v-for="(result, index) in shown"
          :key="result.id"
          role="option"
          :aria-selected="index === active"
          :class="{ active: index === active }"
          @mousemove="active = index"
          @click="pick(result)"
        >
          <span class="line">
            <span v-if="result.linksHere" class="links-here" title="Links to what you searched for">↩</span>
            <span class="title">{{ result.title || result.id }}</span>
            <code class="id plain">{{ result.id }}</code>
            <span v-if="!result.public" class="badge">private</span>
          </span>
          <span v-if="result.excerpt" class="excerpt">{{ result.excerpt }}</span>
        </li>
        <li v-if="!shown.length" class="none">No notes found.</li>
      </ul>
      <footer>
        <span><kbd>↑</kbd><kbd>↓</kbd> choose</span>
        <span><kbd>Enter</kbd> {{ linkText ? 'link' : 'open' }}</span>
        <span><kbd>Esc</kbd> close</span>
      </footer>
    </div>
  </div>
</template>

<style scoped>
.backdrop { position: fixed; inset: 0; background: #000a; display: flex; justify-content: center; align-items: flex-start; padding: 12vh 16px 16px; z-index: 20; }
.palette { width: min(640px, 100%); max-height: 70vh; display: flex; flex-direction: column; overflow: hidden; }
.head { display: flex; flex-direction: column; gap: .5rem; padding: .8rem; border-bottom: 1px solid var(--border-weak); }
.head input { width: 100%; }
.mode { color: var(--fg-muted); font-size: .8rem; }
.mode q { color: var(--accent-cream); }
ul { list-style: none; margin: 0; padding: .3rem; overflow-y: auto; }
li { display: flex; flex-direction: column; gap: .15rem; padding: .45rem .6rem; border-radius: var(--radius-sm); cursor: pointer; border-left: 3px solid transparent; }
li.active { background: #ffffff10; border-left-color: var(--accent-lime); }
.line { display: flex; align-items: baseline; gap: .5rem; min-width: 0; }
.title { font-size: .9rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.id { color: var(--fg-muted); font-size: .7rem; flex-shrink: 0; }
.links-here { color: var(--accent-sky); }
.badge { margin-left: auto; font-size: .7rem; color: var(--fg-muted); border: 1px solid var(--border-weak); border-radius: var(--radius-sm); padding: 0 .35rem; }
.excerpt { color: var(--fg-muted); font-size: .75rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
li.none { color: var(--fg-muted); cursor: default; }
footer { display: flex; gap: 1rem; padding: .5rem .8rem; border-top: 1px solid var(--border-weak); color: var(--fg-muted); font-size: .75rem; }
kbd { font: .7rem var(--font-mono, monospace); border: 1px solid var(--border-weak); border-radius: 4px; padding: 0 .3rem; margin-right: .2rem; }
</style>
