import { HighlightStyle, syntaxHighlighting } from '@codemirror/language'
import { EditorView } from '@codemirror/view'
import { tags } from '@lezer/highlight'

/** CodeMirror in the dt.in.th design system's colors. */
export const editorTheme = [
  EditorView.theme(
    {
      '&': { color: 'var(--fg-warm)', backgroundColor: 'var(--bg-deep)', height: '100%' },
      '.cm-scroller': { fontFamily: 'var(--font-mono)', fontSize: '16px', lineHeight: '1.6' },
      '.cm-content': { caretColor: 'var(--accent-lime)', padding: '12px 0' },
      '.cm-cursor': { borderLeftColor: 'var(--accent-lime)' },
      '.cm-gutters': { backgroundColor: 'var(--bg-deep)', color: '#555453', border: 'none' },
      '.cm-activeLine, .cm-activeLineGutter': { backgroundColor: '#ffffff08' },
      '&.cm-focused .cm-selectionBackground, .cm-selectionBackground, ::selection': {
        backgroundColor: '#d7fc7033 !important',
      },
      '.cm-foldPlaceholder': { backgroundColor: 'var(--bg-elev)', border: 'none', color: 'var(--fg-muted)' },
    },
    { dark: true },
  ),
  syntaxHighlighting(
    HighlightStyle.define([
      { tag: tags.heading, color: 'var(--accent-pink)', fontWeight: '700' },
      { tag: [tags.link, tags.url], color: 'var(--accent-cream)' },
      { tag: tags.emphasis, fontStyle: 'italic' },
      { tag: tags.strong, fontWeight: '700', color: 'var(--fg-strong)' },
      { tag: [tags.monospace, tags.string], color: 'var(--accent-sky)' },
      { tag: [tags.processingInstruction, tags.meta, tags.comment], color: 'var(--fg-muted)' },
      { tag: [tags.keyword, tags.atom, tags.bool], color: 'var(--accent-lime)' },
      { tag: tags.quote, color: 'var(--fg-muted)', fontStyle: 'italic' },
    ]),
  ),
]
