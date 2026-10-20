<script setup lang="ts">
import { markdown } from '@codemirror/lang-markdown'
import { EditorView, basicSetup } from 'codemirror'
import { EditorSelection, Prec } from '@codemirror/state'
import { keymap } from '@codemirror/view'
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { editorTheme } from '../editorTheme'

const model = defineModel<string>({ required: true })
const emit = defineEmits<{ save: []; search: [selectedText: string] }>()
const host = ref<HTMLElement>()

/**
 * Typing *, _ or ` with text selected wraps the selection instead of
 * replacing it, and keeps it selected, so ** makes it bold.
 */
const wrapSelection = EditorView.inputHandler.of((view, _from, _to, text) => {
  if (!['*', '_', '`'].includes(text)) return false
  const { state } = view
  if (state.selection.ranges.every((range) => range.empty)) return false
  view.dispatch(
    state.changeByRange((range) =>
      range.empty
        ? { changes: { from: range.from, insert: text }, range: EditorSelection.cursor(range.from + 1) }
        : {
            changes: [
              { from: range.from, insert: text },
              { from: range.to, insert: text },
            ],
            range: EditorSelection.range(range.from + 1, range.to + 1),
          },
    ),
    { userEvent: 'input' },
  )
  return true
})
let view: EditorView | undefined

onMounted(() => {
  view = new EditorView({
    parent: host.value!,
    doc: model.value,
    extensions: [
      basicSetup,
      markdown(),
      editorTheme,
      wrapSelection,
      EditorView.lineWrapping,
      Prec.high(
        keymap.of([
          { key: 'Mod-s', preventDefault: true, run: () => (emit('save'), true) },
          {
            key: 'Mod-k',
            preventDefault: true,
            run: (view) => {
              const { from, to } = view.state.selection.main
              emit('search', view.state.sliceDoc(from, to))
              return true
            },
          },
        ]),
      ),
      EditorView.updateListener.of((update) => {
        if (update.docChanged) model.value = update.state.doc.toString()
      }),
    ],
  })
})

// Loading another note replaces the document.
watch(model, (value) => {
  if (view && value !== view.state.doc.toString()) {
    view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: value } })
  }
})

onBeforeUnmount(() => view?.destroy())

defineExpose({
  /** Replaces the selection (e.g. with a link to it), then refocuses. */
  replaceSelection(text: string) {
    if (!view) return
    view.dispatch(view.state.replaceSelection(text))
    view.focus()
  },
  focus: () => view?.focus(),
})
</script>

<template>
  <div ref="host" class="editor"></div>
</template>

<style scoped>
.editor { height: 100%; overflow: hidden; background: var(--bg-deep); }
.editor :deep(.cm-editor) { height: 100%; }
</style>
