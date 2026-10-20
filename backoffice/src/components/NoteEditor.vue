<script setup lang="ts">
import { markdown } from '@codemirror/lang-markdown'
import { EditorView, basicSetup } from 'codemirror'
import { keymap } from '@codemirror/view'
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { editorTheme } from '../editorTheme'

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
      editorTheme,
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
.editor { height: 100%; overflow: hidden; background: var(--bg-deep); }
.editor :deep(.cm-editor) { height: 100%; }
</style>
