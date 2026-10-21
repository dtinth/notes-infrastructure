<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, toRaw, watch } from 'vue'
import type { Preview } from '../api'

const props = defineProps<{
  /** The rendered note; `page` says which note, as another starts at the top. */
  preview: Preview & { page: string }
}>()

/**
 * Talks to the parent from inside the preview: reports scrolling, says when
 * the page has settled, and scrolls where it's told. (The frames are
 * sandboxed without same-origin access, so messages are the only way.)
 */
const bridge = `<script>
addEventListener('scroll', () => parent.postMessage({ previewScroll: scrollY }, '*'), { passive: true })
addEventListener('message', (e) => { if (typeof e.data?.scrollTo === 'number') scrollTo(0, e.data.scrollTo) })
addEventListener('load', () => setTimeout(() => parent.postMessage({ previewReady: true }, '*'), 150))
<\/script>`

// Edits to the same note hot-reload in place when the page supports it (its
// runtime says `notes-preview:ready`). Otherwise there are two frames: the new
// render loads in the hidden one, then they swap, which keeps the scroll and
// looks like a reload rather than a page load.
const frames = ref<HTMLIFrameElement[]>([])
const docs = ref(['', ''])
const pages = ['', '']
const hot = [false, false]
const shown = ref(0)
const loading = ref<number>()
let scrollY = 0

let fallback: ReturnType<typeof setTimeout> | undefined
function update() {
  const { html, compiled, page } = props.preview
  const frame = frameAt(shown.value)
  if (loading.value === undefined && hot[shown.value] && pages[shown.value] === page && frame) {
    frame.contentWindow?.postMessage({ type: 'notes-preview:update', compiled: toRaw(compiled) }, '*')
    // Load it the slow way if the page doesn't manage.
    clearTimeout(fallback)
    fallback = setTimeout(() => render(html, page), 3000)
    return
  }
  render(html, page)
}

function render(html: string, page: string) {
  const target = docs.value[shown.value] ? 1 - shown.value : shown.value
  if (page !== pages[shown.value]) scrollY = 0
  loading.value = target
  pages[target] = page
  hot[target] = false
  docs.value[target] = html.includes('</body>') ? html.replace('</body>', `${bridge}</body>`) : html + bridge
  // Swap anyway if the page never says it's ready.
  clearTimeout(fallback)
  fallback = setTimeout(() => swapTo(target), 3000)
}

const frameAt = (index: number) =>
  frames.value.find((frame) => Number(frame.dataset.index) === index)

function swapTo(index: number) {
  if (loading.value !== index) return
  clearTimeout(fallback)
  frameAt(index)?.contentWindow?.postMessage({ scrollTo: scrollY }, '*')
  requestAnimationFrame(() => {
    shown.value = index
    loading.value = undefined
  })
}

function onMessage(event: MessageEvent) {
  const frame = frames.value.find((frame) => frame.contentWindow === event.source)
  if (!frame) return
  const index = Number(frame.dataset.index)
  if (index === shown.value && typeof event.data?.previewScroll === 'number') {
    scrollY = event.data.previewScroll
  }
  if (event.data?.previewReady) swapTo(index)
  if (event.data?.type === 'notes-preview:ready') hot[index] = true
  if (event.data?.type === 'notes-preview:updated' && index === shown.value && loading.value === undefined) {
    clearTimeout(fallback)
  }
}

watch(() => props.preview, update)
onMounted(() => {
  addEventListener('message', onMessage)
  update()
})
onBeforeUnmount(() => {
  removeEventListener('message', onMessage)
  clearTimeout(fallback)
})
</script>

<template>
  <div class="frames">
    <template v-for="(doc, index) in docs" :key="index">
      <iframe
        v-if="doc"
        ref="frames"
        :srcdoc="doc"
        :data-index="index"
        :class="{ shown: index === shown }"
        :aria-hidden="index !== shown"
        :tabindex="index === shown ? 0 : -1"
        title="Preview"
        sandbox="allow-scripts allow-popups"
      ></iframe>
    </template>
  </div>
</template>

<style scoped>
/* Both frames share one grid cell. (Absolutely positioned, the shown frame
   sometimes didn't paint in Chromium until something restyled it.) */
.frames { display: grid; flex: 1; min-height: 0; }
iframe { grid-area: 1 / 1; width: 100%; height: 100%; border: 0; background: var(--bg-raised); opacity: 0; pointer-events: none; }
iframe.shown { opacity: 1; pointer-events: auto; z-index: 1; }
</style>
