import { compileMarkdown } from '@notes/compiler/dist/compiler/index.js'
import { generateHtml } from '@notes/html-generator'

/**
 * Renders a note as the full dt.in.th page, for the backoffice preview.
 * A <base> makes the page load its scripts and styles from the live site,
 * so the preview looks exactly like the published page.
 */
export async function renderPreview(source: string, id: string) {
  const { compiled, errors } = await compileMarkdown(source, id)
  const html = generateHtml({ slug: id, compiled }).replace(
    '<head>',
    '<head><base href="https://dt.in.th/" target="_blank">',
  )
  return { html, errors: (errors ?? []).map(String) }
}
