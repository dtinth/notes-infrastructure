<script setup lang="ts">
import { markdown } from '@codemirror/lang-markdown'
import { oneDark } from '@codemirror/theme-one-dark'
import { EditorView, basicSetup } from 'codemirror'
import { keymap } from '@codemirror/view'
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'

const model = defineModel<string>({ required: true })
const emit = defineEmits<{ save: [] }>()
const host = ref<HTMLElement>()
let view: EditorView | undefined

onMounted(() => {
  view = new EditorView({
    parent: host.value!,
    doc: model.value,
    extensions: [
      basicSetup,
      markdown(),
      oneDark,
      EditorView.lineWrapping,
      keymap.of([{ key: 'Mod-s', preventDefault: true, run: () => (emit('save'), true) }]),
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
</script>

<template>
  <div ref="host" class="editor"></div>
</template>

<style scoped>
.editor { height: 100%; overflow: hidden; }
.editor :deep(.cm-editor) { height: 100%; font-size: 13.5px; }
.editor :deep(.cm-scroller) { font-family: ui-monospace, 'DejaVu Sans Mono', monospace; }
</style>
