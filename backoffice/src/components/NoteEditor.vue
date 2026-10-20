<script setup lang="ts">
import { markdown } from '@codemirror/lang-markdown'
import { EditorView, basicSetup } from 'codemirror'
import { Prec } from '@codemirror/state'
import { keymap } from '@codemirror/view'
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { editorTheme } from '../editorTheme'

const model = defineModel<string>({ required: true })
const emit = defineEmits<{ save: []; search: [selectedText: string] }>()
const host = ref<HTMLElement>()
let view: EditorView | undefined

onMounted(() => {
  view = new EditorView({
    parent: host.value!,
    doc: model.value,
    extensions: [
      basicSetup,
      markdown(),
      editorTheme,
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
