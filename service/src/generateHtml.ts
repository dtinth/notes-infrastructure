export async function generateHtml(source: string, slug: string) {
  const compilerPath = 'notes-frontend/dist/lib/compiler/index.js'
  const compiler = await import(compilerPath)
  const result = await compiler.compileMarkdown(source, slug)
  const template = await Bun.file(
    'node_modules/notes-frontend/dist/index.html'
  ).text()
  const { compiled } = result
  const html = compiler.applyTemplate({ template, compiled })
  return html
}
