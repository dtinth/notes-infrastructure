import { compileMarkdown } from '@notes/compiler/dist/compiler/index.js'
import { generateHtml } from '@notes/html-generator'

/**
 * Renders a note as the full dt.in.th page, for the backoffice preview.
 * A <base> makes the page load its scripts and styles from the live site,
 * so the preview looks exactly like the published page.
 *
 * Given the backoffice's origin, the page instead runs the frontend runtime
 * this server pins (served at /runtime/, as on the site), and is marked with
 * `data-preview-origin` so the runtime accepts hot reloads from there.
 */
export async function renderPreview(source: string, id: string, origin?: string) {
  const { compiled, errors } = await compileMarkdown(source, id)
  let html = generateHtml({ slug: id, compiled }).replace(
    '<head>',
    '<head><base href="https://dt.in.th/" target="_blank">',
  )
  if (origin) {
    html = html
      .replace('<html', `<html data-preview-origin="${origin}"`)
      .replaceAll('"/runtime/', `"${origin}/runtime/`)
  }
  return { html, compiled, errors: (errors ?? []).map(String) }
}
